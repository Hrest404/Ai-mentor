"use server";

import { z } from "zod";
import { generateJson, isAiConfigured } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { sanitizeUserText } from "@/lib/ai/safety";
import {
  buildWritingCheckPrompt,
  locateCorrections,
  writingCheckResponseSchema,
  writingCheckSchema,
  type LocatedCorrection,
} from "@/lib/ai/tools";
import { WRITING_CHECK_MAX_CHARS } from "@/lib/ielts";
import { aiFailure, checkPro } from "@/lib/pro-guard";
import { createLimiter } from "@/lib/rate-limit";

const limiter = createLimiter({ max: 6, windowMs: 60_000 });
const input = z.object({ text: z.string().min(1).max(WRITING_CHECK_MAX_CHARS * 2) });

export type WritingCheckResponse =
  | { ok: true; text: string; summary: string; corrected: string; corrections: LocatedCorrection[] }
  | { ok: false; code: "auth" | "pro" | "rate" | "unavailable" | "busy" | "error"; error: string };

/** Проверка грамматики и правописания свободного текста (PRO). */
export async function checkWriting(raw: unknown): Promise<WritingCheckResponse> {
  const access = await checkPro();
  if (!access.ok) return access;

  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error", error: "Некорректный запрос" };
  const text = sanitizeUserText(parsed.data.text, WRITING_CHECK_MAX_CHARS);
  if (text.length < 3) return { ok: false, code: "error", error: "Введите текст на английском" };

  const rate = limiter.check(access.userId);
  if (!rate.ok) return { ok: false, code: "rate", error: `Слишком часто. Подождите ${Math.ceil(rate.retryAfterMs / 1000)} с.` };
  if (!isAiConfigured()) return { ok: false, code: "unavailable", error: aiErrorMessage("unavailable") };

  try {
    const { system, prompt } = buildWritingCheckPrompt(text);
    const { data } = await generateJson({
      tier: "fast",
      system,
      prompt,
      schema: writingCheckResponseSchema,
      validate: writingCheckSchema,
      temperature: 0.2,
      maxOutputTokens: 4096,
      timeoutMs: 25_000,
      deadlineMs: 50_000,
    });
    return {
      ok: true,
      text,
      summary: data.summary,
      corrected: data.corrected,
      corrections: locateCorrections(text, data.corrections),
    };
  } catch (err) {
    return { ok: false, ...aiFailure("checkWriting", err) };
  }
}
