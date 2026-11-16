"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSpeakingSet, getWritingTask, speakingQuestions } from "@/content/ielts-tasks";
import { db } from "@/db";
import { ieltsSubmissions, profiles } from "@/db/schema";
import { generateJson, isAiConfigured } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { sanitizeUserText } from "@/lib/ai/safety";
import {
  buildSpeakingAssessmentPrompt,
  buildWritingAssessmentPrompt,
  normalizeCriteria,
  speakingAssessmentResponseSchema,
  speakingAssessmentSchema,
  writingAssessmentResponseSchema,
  writingAssessmentSchema,
  type SpeakingAssessment,
  type WritingAssessment,
} from "@/lib/ai/tools";
import { IELTS_CHECKS_PER_DAY, WRITING_LIMITS, countWords, overallBand } from "@/lib/ielts";
import { aiFailure, checkPro } from "@/lib/pro-guard";
import { createLimiter } from "@/lib/rate-limit";
import { localDate } from "@/lib/streak";

const limiter = createLimiter({ max: 3, windowMs: 60_000 });
/** Оценка идёт сильной моделью: при высокой нагрузке она отвечает 30-45 с. */
const ASSESS = { tier: "strong" as const, timeoutMs: 55_000, deadlineMs: 110_000, retriesPerModel: 2, temperature: 0.2 };

/** Минимум слов, с которого работу вообще есть смысл оценивать. */
const MIN_WORDS_TO_ASSESS = 40;

type Fail = { ok: false; code: "auth" | "pro" | "rate" | "daily" | "unavailable" | "busy" | "error"; error: string };

async function checksToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ieltsSubmissions)
    .where(and(eq(ieltsSubmissions.userId, userId), gt(ieltsSubmissions.createdAt, since)));
  return Number(row?.n ?? 0);
}

/** Общие проверки перед обращением к модели: доступ, частота, суточный потолок, ключ. */
async function gate(): Promise<Fail | { ok: true; userId: string }> {
  const access = await checkPro();
  if (!access.ok) return access;
  const rate = limiter.check(access.userId);
  if (!rate.ok) return { ok: false, code: "rate", error: `Слишком часто. Подождите ${Math.ceil(rate.retryAfterMs / 1000)} с.` };
  if ((await checksToday(access.userId)) >= IELTS_CHECKS_PER_DAY) {
    return { ok: false, code: "daily", error: "На сегодня лимит проверок IELTS исчерпан. Продолжите завтра." };
  }
  if (!isAiConfigured()) return { ok: false, code: "unavailable", error: aiErrorMessage("unavailable") };
  return { ok: true, userId: access.userId };
}

/* ───────────── Writing ───────────── */

const writingInput = z.object({ taskId: z.string().max(60), response: z.string().min(1).max(12_000) });

export type WritingAssessmentResponse =
  | { ok: true; id: string; band: number; wordCount: number; criteria: WritingAssessment["criteria"]; assessment: WritingAssessment; model: string }
  | Fail;

export async function assessWriting(raw: unknown): Promise<WritingAssessmentResponse> {
  const parsed = writingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error", error: "Некорректный запрос" };
  const task = getWritingTask(parsed.data.taskId);
  if (!task) return { ok: false, code: "error", error: "Задание не найдено" };

  const response = sanitizeUserText(parsed.data.response, WRITING_LIMITS[task.task].maxChars);
  const wordCount = countWords(response);
  if (wordCount < MIN_WORDS_TO_ASSESS) {
    return { ok: false, code: "error", error: `Работа слишком короткая для оценки: нужно хотя бы ${MIN_WORDS_TO_ASSESS} слов, сейчас ${wordCount}.` };
  }

  const passed = await gate();
  if (!passed.ok) return passed;

  try {
    const { system, prompt } = buildWritingAssessmentPrompt({ task: task.task, taskPrompt: task.prompt, response, wordCount });
    const { data, model } = await generateJson({
      ...ASSESS,
      system,
      prompt,
      schema: writingAssessmentResponseSchema,
      validate: writingAssessmentSchema,
      maxOutputTokens: 6000,
    });
    // Итог считаем сами: модель не должна «договариваться» с шкалой.
    const criteria = normalizeCriteria(data.criteria);
    const band = overallBand(Object.values(criteria));
    const id = crypto.randomUUID();
    await db.insert(ieltsSubmissions).values({
      id,
      userId: passed.userId,
      task: task.task === 1 ? "writing1" : "writing2",
      prompt: task.id,
      response,
      wordCount,
      bandOverall: band,
      criteria,
      feedback: { comments: data.comments, strengths: data.strengths, improvements: data.improvements, improved: data.improved, model },
    });
    revalidatePath("/app/pro/ielts");
    return { ok: true, id, band, wordCount, criteria, assessment: { ...data, criteria }, model };
  } catch (err) {
    return { ok: false, ...aiFailure("assessWriting", err) };
  }
}

/* ───────────── Speaking ───────────── */

const speakingInput = z.object({
  setId: z.string().max(60),
  answers: z
    .array(z.object({ answer: z.string().max(2500), seconds: z.number().int().min(0).max(900).optional() }))
    .min(1)
    .max(12),
});

export type SpeakingAssessmentResponse =
  | { ok: true; id: string; band: number; criteria: SpeakingAssessment["criteria"]; assessment: SpeakingAssessment; model: string }
  | Fail;

export async function assessSpeaking(raw: unknown): Promise<SpeakingAssessmentResponse> {
  const parsed = speakingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "error", error: "Некорректный запрос" };
  const set = getSpeakingSet(parsed.data.setId);
  if (!set) return { ok: false, code: "error", error: "Набор вопросов не найден" };

  // Вопросы берём из банка по номеру: клиент присылает только ответы.
  const questions = speakingQuestions(set);
  if (parsed.data.answers.length !== questions.length) return { ok: false, code: "error", error: "Ответов должно быть столько же, сколько вопросов" };
  const answers = questions.map((q, i) => ({
    part: q.part,
    question: q.text,
    answer: sanitizeUserText(parsed.data.answers[i].answer, 2000),
    seconds: parsed.data.answers[i].seconds,
  }));
  if (answers.filter((a) => countWords(a.answer) >= 3).length < 3) {
    return { ok: false, code: "error", error: "Ответьте хотя бы на три вопроса, чтобы получить оценку." };
  }

  const passed = await gate();
  if (!passed.ok) return passed;

  try {
    const { system, prompt } = buildSpeakingAssessmentPrompt(answers);
    const { data, model } = await generateJson({
      ...ASSESS,
      system,
      prompt,
      schema: speakingAssessmentResponseSchema,
      validate: speakingAssessmentSchema,
      maxOutputTokens: 4000,
    });
    const criteria = normalizeCriteria(data.criteria);
    const band = overallBand(Object.values(criteria));
    const id = crypto.randomUUID();
    const transcript = answers.map((a) => `Part ${a.part}. ${a.question}\n${a.answer || "(ответа нет)"}`).join("\n\n");
    await db.insert(ieltsSubmissions).values({
      id,
      userId: passed.userId,
      task: "speaking",
      prompt: set.id,
      response: transcript,
      wordCount: countWords(answers.map((a) => a.answer).join(" ")),
      bandOverall: band,
      criteria,
      feedback: { comments: data.comments, strengths: data.strengths, improvements: data.improvements, model },
    });
    revalidatePath("/app/pro/ielts");
    return { ok: true, id, band, criteria, assessment: { ...data, criteria }, model };
  } catch (err) {
    return { ok: false, ...aiFailure("assessSpeaking", err) };
  }
}

/* ───────────── Цель и дата экзамена ───────────── */

const goalsInput = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetBand: z.number().min(4).max(9),
});

export async function saveIeltsGoals(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await checkPro();
  if (!access.ok) return access;
  const parsed = goalsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Проверьте дату и целевой балл" };

  const { examDate, targetBand } = parsed.data;
  const today = localDate(new Date(), access.profile.timezone);
  const parsedMs = Date.parse(`${examDate}T00:00:00Z`);
  if (Number.isNaN(parsedMs) || new Date(parsedMs).toISOString().slice(0, 10) !== examDate) return { ok: false, error: "Такой даты нет" };
  if (examDate < today) return { ok: false, error: "Дата экзамена уже прошла" };
  if (parsedMs - Date.parse(`${today}T00:00:00Z`) > 2 * 366 * 24 * 60 * 60 * 1000) return { ok: false, error: "Дата слишком далеко: не позже чем через два года" };
  if (Math.round(targetBand * 2) !== targetBand * 2) return { ok: false, error: "Балл выбирается с шагом 0.5" };

  await db.update(profiles).set({ examDate, targetBand, goal: "ielts" }).where(eq(profiles.userId, access.userId));
  revalidatePath("/app/pro/ielts");
  return { ok: true };
}
