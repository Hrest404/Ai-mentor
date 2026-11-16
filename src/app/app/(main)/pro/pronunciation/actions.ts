"use server";

import { z } from "zod";
import { generateJson, isAiConfigured } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { sanitizeUserText } from "@/lib/ai/safety";
import {
  buildPronunciationPrompt,
  pronunciationTipsResponseSchema,
  pronunciationTipsSchema,
  type PronunciationTips,
} from "@/lib/ai/tools";
import { aiFailure, checkPro } from "@/lib/pro-guard";
import { createLimiter } from "@/lib/rate-limit";
import { compareSpeech, type PronunciationResult } from "@/lib/pronunciation";

const limiter = createLimiter({ max: 8, windowMs: 60_000 });
const input = z.object({
  reference: z.string().min(1).max(300),
  spoken: z.string().max(600),
});

export type PronunciationTipsResponse =
  | { ok: true; result: PronunciationResult; tips: PronunciationTips | null; /** Советы AI не получены: сравнение по словам всё равно верно. */ tipsError?: string }
  | { ok: false; code: "auth" | "pro" | "rate" | "unavailable" | "busy" | "error"; error: string };

/**
 * Разбор произношения: сравнение со словами эталона считается на сервере заново, а AI-советы даются
 * только по проблемным словам. Если всё распознано верно, модель не вызывается.
 */
export async function getPronunciationTips(raw: unknown): Promise<PronunciationTipsResponse> {
  const access = await checkPro();
  if (!access.ok) return access;

  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error", error: "Некорректный запрос" };
  const reference = sanitizeUserText(parsed.data.reference, 300);
  const spoken = sanitizeUserText(parsed.data.spoken, 600);
  if (!reference) return { ok: false, code: "error", error: "Нет фразы для сравнения" };

  const result = compareSpeech(reference, spoken);
  const problems = result.words.filter((w) => w.status !== "ok").slice(0, 8);
  if (problems.length === 0) return { ok: true, result, tips: null };

  const rate = limiter.check(access.userId);
  if (!rate.ok) return { ok: false, code: "rate", error: `Слишком часто. Подождите ${Math.ceil(rate.retryAfterMs / 1000)} с.` };
  if (!isAiConfigured()) return { ok: false, code: "unavailable", error: aiErrorMessage("unavailable") };

  try {
    const { system, prompt } = buildPronunciationPrompt({
      reference,
      accuracy: result.accuracy,
      problems: problems.map((p) => ({ word: p.word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""), heard: p.heard })),
    });
    const { data } = await generateJson({
      tier: "fast",
      system,
      prompt,
      schema: pronunciationTipsResponseSchema,
      validate: pronunciationTipsSchema,
      temperature: 0.3,
      maxOutputTokens: 1500,
      timeoutMs: 20_000,
      deadlineMs: 40_000,
    });
    return { ok: true, result, tips: data };
  } catch (err) {
    // Сравнение по словам уже посчитано: показываем его, а советы AI предлагаем получить позже.
    return { ok: true, result, tips: null, tipsError: aiFailure("getPronunciationTips", err).error };
  }
}
