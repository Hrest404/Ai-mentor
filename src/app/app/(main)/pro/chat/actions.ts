"use server";

import { z } from "zod";
import { db } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";
import { getScenario } from "@/lib/chat-scenarios";
import { getAccount, requireUser } from "@/lib/session";

const input = z.object({ scenario: z.string().max(40) });

export type StartChatResponse =
  | { ok: true; conversationId: string; scenario: string; opening: string }
  | { ok: false; error: string };

/** Начинает новый диалог: создаёт его и сохраняет первую реплику роли (без обращения к модели). */
export async function startConversation(raw: unknown): Promise<StartChatResponse> {
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };

  const { plan } = await getAccount(user.id);
  if (plan !== "pro") return { ok: false, error: "Чат-ментор доступен в PRO" };

  const scenario = getScenario(parsed.data.scenario);
  if (!scenario) return { ok: false, error: "Сценарий не найден" };

  const conversationId = crypto.randomUUID();
  await db.insert(chatConversations).values({ id: conversationId, userId: user.id, scenario: scenario.id });
  await db.insert(chatMessages).values({
    userId: user.id,
    conversationId,
    role: "assistant",
    content: scenario.opening,
  });
  return { ok: true, conversationId, scenario: scenario.id, opening: scenario.opening };
}
