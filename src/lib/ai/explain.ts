import { createHash } from "node:crypto";
import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import type { ExerciseDef } from "@/content/types";
import { checkAnswer, normalizeText } from "../answers";
import { UNTRUSTED_RULE, sanitizeUserText, wrapUntrusted } from "./safety";

/* ───────────── Что возвращает модель ───────────── */

const similarTask = z
  .object({
    prompt: z.string().min(3).max(220),
    options: z.array(z.string().min(1).max(80)).length(4),
    answer: z.string().min(1).max(80),
    explanation: z.string().min(5).max(320),
  })
  .superRefine((t, ctx) => {
    if (!t.options.includes(t.answer)) ctx.addIssue({ code: "custom", message: "ответа нет среди вариантов" });
    if (new Set(t.options.map((o) => o.toLowerCase())).size !== t.options.length)
      ctx.addIssue({ code: "custom", message: "варианты повторяются" });
  });

export const explanationSchema = z.object({
  why: z.string().min(10).max(800),
  rule: z.string().min(5).max(600),
  example: z.object({ en: z.string().min(3).max(220), ru: z.string().min(3).max(220) }),
  similar: z.array(similarTask).length(3),
});
export type Explanation = z.infer<typeof explanationSchema>;
export type SimilarTask = Explanation["similar"][number];

/** Та же структура в формате схемы Gemini. */
export const explanationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    why: { type: Type.STRING, description: "Почему ответ ученика неверен, по-русски, 2-3 предложения" },
    rule: { type: Type.STRING, description: "Правило, по-русски, 1-2 предложения" },
    example: {
      type: Type.OBJECT,
      properties: { en: { type: Type.STRING }, ru: { type: Type.STRING } },
      required: ["en", "ru"],
    },
    similar: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING, description: "Задание на английском, пропуск обозначен ___" },
          options: { type: Type.ARRAY, minItems: "4", maxItems: "4", items: { type: Type.STRING } },
          answer: { type: Type.STRING, description: "Верный вариант, дословно один из options" },
          explanation: { type: Type.STRING, description: "Короткое пояснение по-русски" },
        },
        required: ["prompt", "options", "answer", "explanation"],
      },
    },
  },
  required: ["why", "rule", "example", "similar"],
};

/* ───────────── Запрос ───────────── */

/** Задание словами, как его видел ученик. */
export function describeTask(def: ExerciseDef): string {
  switch (def.kind) {
    case "choice":
      return `${def.prompt} Варианты: ${def.options.join(" / ")}`;
    case "fill_blank":
      return `Вставить пропуск: ${def.sentence}`;
    case "build_sentence":
      return `Собрать предложение по-английски: «${def.ru}»`;
    case "translate":
      return `Перевести на английский: «${def.ru}»`;
    case "listening":
      return `${def.question} Прозвучало: «${def.audio}». Варианты: ${def.options.join(" / ")}`;
    case "dictation":
      return `Диктант, прозвучало: «${def.audio}»`;
    case "match_pairs":
      return `${def.instruction} Пары: ${def.pairs.map(([l, r]) => `${l} — ${r}`).join("; ")}`;
  }
}

export function buildExplainPrompt(opts: { def: ExerciseDef; tagLabel: string; userAnswer: string }) {
  const { def, tagLabel } = opts;
  const answer = sanitizeUserText(opts.userAnswer, 200) || "(пусто)";
  const correct = checkAnswer(def, null).correctAnswer;

  const system = [
    "Ты дружелюбный репетитор английского для русскоговорящих учеников.",
    "Объясняй по-русски, коротко и по делу, без воды и без похвал, обращаясь к ученику на «ты». Английские примеры естественные, уровня A1-B2.",
    "Отвечай только JSON по заданной схеме.",
    UNTRUSTED_RULE,
  ].join(" ");

  const prompt = [
    `Тема ошибки: ${tagLabel}.`,
    `Задание: ${describeTask(def)}`,
    `Верный ответ: ${correct}`,
    `Пояснение из курса: ${def.explanation}`,
    "Ответ ученика (неверный):",
    wrapUntrusted("user_answer", answer),
    "",
    "Сделай три вещи.",
    "1) why: объясни, почему ответ ученика неверен, и в чём логика верного ответа.",
    "2) rule: сформулируй правило и один новый пример (example.en и example.ru).",
    "3) similar: ровно три НОВЫХ задания на то же правило, не повторяя предложение из задания выше. Каждое задание: предложение на английском с пропуском ___ (prompt), ровно четыре варианта (options), один верный дословно из options (answer), короткое пояснение по-русски (explanation).",
  ].join("\n");

  return { system, prompt };
}

/** Ключ общего кеша: то же упражнение и тот же (нормализованный) неверный ответ. */
export function explainKey(exerciseId: string, userAnswer: string): string {
  return createHash("sha256").update(`${exerciseId}\n${normalizeText(userAnswer)}`).digest("hex");
}
