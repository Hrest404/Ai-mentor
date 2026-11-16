import { and, asc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";
import { AiError, aiErrorMessage } from "@/lib/ai/errors";
import { buildChatSystem, buildChatTurns } from "@/lib/ai/chat";
import { isAiConfigured, streamChat } from "@/lib/ai/client";
import { sanitizeUserText } from "@/lib/ai/safety";
import { CHAT_MESSAGES_PER_DAY, CHAT_MESSAGES_PER_MINUTE, CHAT_MESSAGE_MAX_LENGTH, getScenario } from "@/lib/chat-scenarios";
import { createLimiter } from "@/lib/rate-limit";
import { getAccount, getSession } from "@/lib/session";
import { startOfLocalDay } from "@/lib/streak";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createLimiter({ max: CHAT_MESSAGES_PER_MINUTE, windowMs: 60_000 });
const HISTORY_LIMIT = 20;

const body = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH * 2),
});

const json = (status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

/**
 * Ответ чата-ментора потоком текста. Доступ: вошедший пользователь с PRO, своим диалогом,
 * в пределах частоты и суточного лимита. Сообщение пользователя сохраняется, когда модель уже начала отвечать.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return json(401, "Войдите в аккаунт");
  const userId = session.user.id;

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Некорректный запрос");

  const { profile, plan } = await getAccount(userId);
  if (plan !== "pro") return json(403, "Чат-ментор доступен в PRO", { code: "pro" });

  const rate = limiter.check(userId);
  if (!rate.ok) {
    return json(429, "Слишком быстро. Подождите немного.", { code: "rate" }, { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) });
  }

  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.id, parsed.data.conversationId), eq(chatConversations.userId, userId)));
  if (!conversation) return json(404, "Диалог не найден");
  const scenario = getScenario(conversation.scenario);
  if (!scenario) return json(404, "Сценарий не найден");

  if (!isAiConfigured()) return json(503, aiErrorMessage("unavailable"), { code: "unavailable" });

  // Суточный потолок по локальным суткам: защита от злоупотреблений и непредвиденного счёта за модель.
  const since = startOfLocalDay(new Date(), profile.timezone);
  const [{ n: sentToday }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user"), gte(chatMessages.createdAt, since)));
  if (Number(sentToday) >= CHAT_MESSAGES_PER_DAY) {
    return json(429, "На сегодня лимит сообщений в чате исчерпан. Продолжите завтра.", { code: "daily" });
  }

  const message = sanitizeUserText(parsed.data.message, CHAT_MESSAGE_MAX_LENGTH);
  if (!message) return json(400, "Пустое сообщение");

  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.conversationId, conversation.id)))
    .orderBy(asc(chatMessages.createdAt), sql`rowid`);
  const recent = history.slice(-HISTORY_LIMIT);

  const iterator = streamChat({
    system: buildChatSystem(scenario, profile.level),
    turns: buildChatTurns(recent, message),
    signal: req.signal,
  })[Symbol.asyncIterator]();

  // Первый фрагмент получаем до ответа клиенту: так сбой модели превращается в понятную ошибку, а не в оборванный поток.
  let first: IteratorResult<{ text: string; model: string }>;
  try {
    first = await iterator.next();
  } catch (err) {
    const code = err instanceof AiError ? err.code : "busy";
    console.error("[ai] chat:", err instanceof AiError ? `${err.code}: ${String(err.cause ?? err.message).slice(0, 300)}` : err);
    return json(503, aiErrorMessage(code === "auth" ? "auth" : code), { code });
  }
  if (first.done) return json(502, aiErrorMessage("bad_response"), { code: "bad_response" });

  await db.insert(chatMessages).values({ userId, conversationId: conversation.id, role: "user", content: message });

  const encoder = new TextEncoder();
  let full = first.value.text;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(first.value.text));
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          full += next.value.text;
          controller.enqueue(encoder.encode(next.value.text));
        }
      } catch (err) {
        console.error("[ai] chat stream interrupted:", err instanceof Error ? err.message : err);
      } finally {
        // Сохраняем то, что успело прийти: история диалога остаётся цельной.
        if (full.trim()) {
          await db
            .insert(chatMessages)
            .values({ userId, conversationId: conversation.id, role: "assistant", content: full.trim() })
            .catch((e) => console.error("[chat] не удалось сохранить ответ:", e));
          await db
            .update(chatConversations)
            .set({ updatedAt: new Date() })
            .where(eq(chatConversations.id, conversation.id))
            .catch(() => {});
        }
        try {
          controller.close();
        } catch {
          /* клиент уже закрыл соединение */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
