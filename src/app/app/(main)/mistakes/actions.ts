"use server";

import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { tagLabel } from "@/content/tags";
import { db } from "@/db";
import { aiExplanationCache, attempts, mistakes } from "@/db/schema";
import { answerToText, checkAnswer } from "@/lib/answers";
import { AiError, aiErrorMessage, type AiErrorCode } from "@/lib/ai/errors";
import { generateJson, isAiConfigured } from "@/lib/ai/client";
import { buildExplainPrompt, explainKey, explanationResponseSchema, explanationSchema, type Explanation } from "@/lib/ai/explain";
import { getExercise } from "@/lib/course-index";
import { chargeSeconds, isPracticeExhausted } from "@/lib/limits";
import { createLimiter } from "@/lib/rate-limit";
import { getAccount, requireUser } from "@/lib/session";
import { describeNextReview, reviewOutcome } from "@/lib/srs";
import { finishPracticeCharge, getUsage, practiceChargeQuery, releaseAiExplanation, reserveAiExplanation } from "@/lib/usage";

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

/* ───────────── AI-разбор ошибки ───────────── */

// Не чаще 6 разборов в минуту на пользователя (в пределах процесса); суточный лимит считается в базе.
const explainLimiter = createLimiter({ max: 6, windowMs: 60_000 });

export type ExplainResponse =
  | { ok: true; explanation: Explanation; /** сколько разборов осталось в сутки; null: без ограничений */ left: number | null; charged: boolean }
  | {
      ok: false;
      code: "limit" | "rate" | "no-mistake" | "unavailable" | "busy" | "error";
      error: string;
      resetsAtMs?: number;
    };

interface StoredExplanation {
  key: string;
  payload: unknown;
  model?: string;
}

const explainInput = z.object({ exerciseId: z.string().max(120) });

/** Подробный разбор своей ошибки: правило, пример и три похожих задания. */
export async function explainMistake(raw: unknown): Promise<ExplainResponse> {
  const user = await requireUser();
  const parsed = explainInput.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error", error: "Некорректный запрос" };

  const ex = getExercise(parsed.data.exerciseId);
  if (!ex) return { ok: false, code: "error", error: "Упражнение не найдено" };

  const [mistake] = await db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.userId, user.id), eq(mistakes.exerciseId, parsed.data.exerciseId)));
  // Разбирать можно только свою ошибку: так модель не превратить в бесплатный генератор по чужим запросам.
  if (!mistake) return { ok: false, code: "no-mistake", error: "Этой ошибки у вас нет" };

  const key = explainKey(parsed.data.exerciseId, mistake.lastAnswer);

  // Уже разбирали именно этот ответ: показываем сохранённое бесплатно.
  const stored = mistake.aiExplanation as StoredExplanation | null;
  if (stored?.key === key) {
    const ok = explanationSchema.safeParse(stored.payload);
    if (ok.success) return { ok: true, explanation: ok.data, left: null, charged: false };
  }

  const rate = explainLimiter.check(user.id);
  if (!rate.ok) {
    return { ok: false, code: "rate", error: `Слишком часто. Подождите ${Math.ceil(rate.retryAfterMs / 1000)} с.` };
  }
  if (!isAiConfigured()) return { ok: false, code: "unavailable", error: aiErrorMessage("unavailable") };

  const { plan } = await getAccount(user.id);
  const reservation = await reserveAiExplanation(user.id, plan);
  if (!reservation.ok) {
    return {
      ok: false,
      code: "limit",
      error: "Бесплатные AI-разборы на сегодня закончились",
      resetsAtMs: reservation.resetsAt.getTime(),
    };
  }

  try {
    let explanation: Explanation | null = null;
    let model = "cache";

    const [cached] = await db.select().from(aiExplanationCache).where(eq(aiExplanationCache.key, key));
    if (cached) {
      const ok = explanationSchema.safeParse(cached.payload);
      if (ok.success) {
        explanation = ok.data;
        model = cached.model;
      }
    }

    if (!explanation) {
      const { system, prompt } = buildExplainPrompt({
        def: ex.def,
        tagLabel: tagLabel(ex.def.tag),
        userAnswer: mistake.lastAnswer,
      });
      const generated = await generateJson({
        tier: "fast",
        system,
        prompt,
        schema: explanationResponseSchema,
        validate: explanationSchema,
        temperature: 0.3,
        maxOutputTokens: 2048,
      });
      explanation = generated.data;
      model = generated.model;
      await db.insert(aiExplanationCache).values({ key, payload: explanation, model }).onConflictDoNothing();
    }

    const toStore: StoredExplanation = { key, payload: explanation, model };
    await db.update(mistakes).set({ aiExplanation: toStore }).where(eq(mistakes.id, mistake.id));

    return { ok: true, explanation, left: reservation.left, charged: reservation.left !== null };
  } catch (err) {
    // Модель не ответила: лимит возвращаем.
    await releaseAiExplanation(user.id, reservation.windowStart).catch(() => {});
    const code: AiErrorCode = err instanceof AiError ? err.code : "busy";
    console.error("[ai] explainMistake:", err instanceof AiError ? `${err.code}: ${String(err.cause ?? err.message).slice(0, 300)}` : err);
    if (code === "unavailable" || code === "auth") return { ok: false, code: "unavailable", error: aiErrorMessage(code) };
    return { ok: false, code: "busy", error: aiErrorMessage(code) };
  }
}

/* ───────────── Повторение ошибок ───────────── */

const reviewInput = z.object({
  exerciseId: z.string().max(120),
  answer: z.union([
    z.string().max(500),
    z.array(z.string().max(100)).max(40),
    z.record(z.string().max(100), z.string().max(100)),
  ]),
  timeMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
});

export type ReviewResponse =
  | {
      ok: true;
      correct: boolean;
      correctAnswer: string;
      explanation: string;
      /** «завтра», «через 3 дня», «через 10 мин» или «усвоено» */
      nextReview: string;
      resolved: boolean;
    }
  | { ok: false; code?: "limit"; error: string; resetsAtMs?: number };

/** Проверяет ответ при повторении и сдвигает ошибку по графику. Повторение тратит время практики, как и урок. */
export async function checkReviewAnswer(raw: unknown): Promise<ReviewResponse> {
  const user = await requireUser();
  const parsed = reviewInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };
  const { exerciseId, answer, timeMs } = parsed.data;

  const ex = getExercise(exerciseId);
  if (!ex) return { ok: false, error: "Упражнение не найдено" };

  const [[mistake], account, usage] = await Promise.all([
    db
      .select()
      .from(mistakes)
      .where(and(eq(mistakes.userId, user.id), eq(mistakes.exerciseId, exerciseId))),
    getAccount(user.id),
    getUsage(user.id),
  ]);
  if (!mistake) return { ok: false, error: "Этой ошибки у вас нет" };

  if (isPracticeExhausted(account.plan, usage.practiceSeconds) && usage.resetsAt) {
    return { ok: false, code: "limit", error: "Лимит практики на сегодня исчерпан", resetsAtMs: usage.resetsAt.getTime() };
  }

  const now = new Date();
  const result = checkAnswer(ex.def, answer);
  const outcome = reviewOutcome({ box: mistake.box, correct: result.correct, now });
  const charge = chargeSeconds(timeMs);

  const queries: Batch = [
    practiceChargeQuery(user.id, charge, now),
    db.insert(attempts).values({
      userId: user.id,
      exerciseId,
      lessonId: ex.lessonId,
      answer: answerToText(answer).slice(0, 500),
      isCorrect: result.correct,
      timeMs: timeMs ?? null,
    }),
    db
      .update(mistakes)
      .set({
        box: outcome.box,
        dueAt: outcome.dueAt,
        lastReviewedAt: now,
        resolvedAt: outcome.resolved ? now : null,
        ...(result.correct ? {} : { lastAnswer: answerToText(answer).slice(0, 500) }),
      })
      .where(eq(mistakes.id, mistake.id)),
  ];
  const results = (await db.batch(queries)) as unknown[];
  await finishPracticeCharge(user.id, results[0] as { practiceSeconds: number }[], charge, now);

  return {
    ok: true,
    correct: result.correct,
    correctAnswer: result.correctAnswer,
    explanation: ex.def.explanation,
    nextReview: outcome.resolved ? "усвоено" : describeNextReview(outcome.dueAt, now, account.profile.timezone),
    resolved: outcome.resolved,
  };
}
