import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { SPEAKING_CRITERIA, WRITING_CRITERIA, clampBand } from "../ielts";
import { UNTRUSTED_RULE, wrapUntrusted } from "./safety";

/* ───────────── Проверка текста: грамматика и правописание ───────────── */

export const CORRECTION_CATEGORIES = ["grammar", "spelling", "punctuation", "vocabulary", "style"] as const;
export const CATEGORY_LABELS: Record<(typeof CORRECTION_CATEGORIES)[number], string> = {
  grammar: "Грамматика",
  spelling: "Правописание",
  punctuation: "Пунктуация",
  vocabulary: "Лексика",
  style: "Стиль",
};

export const writingCheckSchema = z.object({
  summary: z.string().min(3).max(500),
  corrected: z.string().min(1).max(6000),
  corrections: z
    .array(
      z.object({
        original: z.string().min(1).max(200),
        replacement: z.string().max(200),
        reason: z.string().min(3).max(400),
        category: z.enum(CORRECTION_CATEGORIES),
      }),
    )
    .max(25),
});
export type WritingCheck = z.infer<typeof writingCheckSchema>;

export const writingCheckResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Общий вывод по тексту по-русски, 1-2 предложения" },
    corrected: { type: Type.STRING, description: "Весь текст целиком с внесёнными исправлениями" },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "Фрагмент ошибки ДОСЛОВНО как в тексте ученика, как можно короче" },
          replacement: { type: Type.STRING, description: "Как правильно" },
          reason: { type: Type.STRING, description: "Почему, по-русски, одно предложение" },
          category: { type: Type.STRING, enum: [...CORRECTION_CATEGORIES] },
        },
        required: ["original", "replacement", "reason", "category"],
      },
    },
  },
  required: ["summary", "corrected", "corrections"],
};

export function buildWritingCheckPrompt(text: string) {
  const system = [
    "Ты внимательный преподаватель английского для русскоговорящих. Проверяешь короткие тексты учеников.",
    "Исправляй только настоящие ошибки: грамматику, правописание, пунктуацию, неверные слова. Не переписывай стиль без нужды и не меняй смысл.",
    "Каждое исправление: original ДОСЛОВНО скопирован из текста ученика (как можно короче, но так, чтобы встречался в тексте), replacement, причина по-русски одним предложением, категория.",
    "Если ошибок нет, верни пустой список corrections и corrected, равный исходному тексту.",
    "Отвечай только JSON по заданной схеме.",
    UNTRUSTED_RULE,
  ].join(" ");
  const prompt = ["Текст ученика:", wrapUntrusted("user_message", text)].join("\n");
  return { system, prompt };
}

export interface LocatedCorrection {
  start: number;
  end: number;
  original: string;
  replacement: string;
  reason: string;
  category: (typeof CORRECTION_CATEGORIES)[number];
}

/**
 * Находит правки в тексте: модель могла выдумать фрагмент или повторить его дважды. Берутся только те,
 * что реально есть в тексте; повторяющийся фрагмент привязывается к следующему вхождению; пересечения отбрасываются.
 */
export function locateCorrections(text: string, corrections: WritingCheck["corrections"]): LocatedCorrection[] {
  const used: [number, number][] = [];
  const cursorByOriginal = new Map<string, number>();
  const found: LocatedCorrection[] = [];

  for (const c of corrections) {
    if (c.original === c.replacement) continue;
    let from = cursorByOriginal.get(c.original) ?? 0;
    let start = -1;
    while ((start = text.indexOf(c.original, from)) >= 0) {
      const end = start + c.original.length;
      if (!used.some(([a, b]) => start < b && end > a)) {
        used.push([start, end]);
        cursorByOriginal.set(c.original, end);
        found.push({ ...c, start, end });
        break;
      }
      from = start + 1;
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/* ───────────── Произношение: советы по проблемным словам ───────────── */

export const pronunciationTipsSchema = z.object({
  summary: z.string().min(3).max(400),
  tips: z
    .array(
      z.object({
        word: z.string().min(1).max(40),
        transcription: z.string().max(40),
        tip: z.string().min(5).max(300),
      }),
    )
    .max(6),
});
export type PronunciationTips = z.infer<typeof pronunciationTipsSchema>;

export const pronunciationTipsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Короткий вывод по-русски, 1-2 предложения" },
    tips: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          transcription: { type: Type.STRING, description: "Транскрипция IPA, например /ˈwɔːtər/" },
          tip: { type: Type.STRING, description: "Как произнести, по-русски, 1-2 предложения, на что похож звук" },
        },
        required: ["word", "transcription", "tip"],
      },
    },
  },
  required: ["summary", "tips"],
};

export function buildPronunciationPrompt(opts: {
  reference: string;
  problems: { word: string; heard?: string }[];
  accuracy: number;
}) {
  const system = [
    "Ты репетитор по произношению английского для русскоговорящих.",
    "Тебе дают фразу, слова, которые распознавание речи не узнало или узнало неверно, и что услышано вместо них. Объясни, как правильно произнести каждое слово, на что похож трудный звук и типичную ошибку русскоговорящих. Коротко, по-русски.",
    "Распознавание может ошибаться само: не обвиняй ученика в том, чего не знаешь, формулируй как «похоже, что».",
    "Отвечай только JSON по заданной схеме.",
    UNTRUSTED_RULE,
  ].join(" ");
  const lines = opts.problems.map((p) => `- ${p.word}${p.heard ? ` (услышано: ${p.heard})` : " (не услышано)"}`);
  const prompt = [
    `Фраза: ${opts.reference}`,
    `Точность распознавания: ${opts.accuracy}%.`,
    "Проблемные слова:",
    wrapUntrusted("user_answer", lines.join("\n")),
  ].join("\n");
  return { system, prompt };
}

/* ───────────── IELTS: оценка ───────────── */

const band = z.number().min(0).max(9);
const notes = z.string().min(3).max(700);

export const writingAssessmentSchema = z.object({
  criteria: z.object({ task: band, coherence: band, lexical: band, grammar: band }),
  comments: z.object({ task: notes, coherence: notes, lexical: notes, grammar: notes }),
  strengths: z.array(z.string().min(3).max(300)).min(1).max(3),
  improvements: z.array(z.string().min(3).max(300)).min(1).max(4),
  improved: z.string().min(20).max(6000),
});
export type WritingAssessment = z.infer<typeof writingAssessmentSchema>;

const criterionProps = (keys: readonly string[], type: Type) =>
  Object.fromEntries(keys.map((k) => [k, { type }])) as Record<string, Schema>;

export const writingAssessmentResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.OBJECT,
      description: "Баллы 0-9 с шагом 0.5",
      properties: criterionProps(
        WRITING_CRITERIA.map((c) => c.key),
        Type.NUMBER,
      ),
      required: WRITING_CRITERIA.map((c) => c.key),
    },
    comments: {
      type: Type.OBJECT,
      description: "Обоснование каждого балла по-русски, 2-3 предложения, с примерами из текста",
      properties: criterionProps(
        WRITING_CRITERIA.map((c) => c.key),
        Type.STRING,
      ),
      required: WRITING_CRITERIA.map((c) => c.key),
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Сильные стороны по-русски, 1-3 пункта" },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Что улучшить по-русски, 1-4 пункта" },
    improved: { type: Type.STRING, description: "Улучшенная версия работы на английском, сохраняющая идеи ученика" },
  },
  required: ["criteria", "comments", "strengths", "improvements", "improved"],
};

export function buildWritingAssessmentPrompt(opts: { task: 1 | 2; taskPrompt: string; response: string; wordCount: number }) {
  const taskName = opts.task === 1 ? "IELTS General Training Writing Task 1 (letter)" : "IELTS Writing Task 2 (essay)";
  const system = [
    `Ты опытный экзаменатор IELTS. Оцениваешь работу: ${taskName}.`,
    "Критерии: task (Task Achievement / Task Response), coherence (Coherence and Cohesion), lexical (Lexical Resource), grammar (Grammatical Range and Accuracy). Каждый балл от 0 до 9 с шагом 0.5, строго по публичным дескрипторам IELTS.",
    "Будь честным и не завышай: работа с ошибками, мешающими пониманию, не получает выше 5. Слишком короткая работа (меньше минимума слов) штрафуется по критерию task.",
    "Обоснования и советы пиши по-русски, с цитатами из работы. Улучшенная версия на английском сохраняет идеи ученика, но исправляет ошибки и поднимает уровень языка на 1 балл.",
    "Отвечай только JSON по заданной схеме.",
    UNTRUSTED_RULE,
  ].join(" ");
  const prompt = [
    "Условие задания:",
    opts.taskPrompt,
    `Слов в работе: ${opts.wordCount}.`,
    "Работа ученика:",
    wrapUntrusted("user_message", opts.response),
  ].join("\n");
  return { system, prompt };
}

export const speakingAssessmentSchema = z.object({
  criteria: z.object({ fluency: band, lexical: band, grammar: band, pronunciation: band }),
  comments: z.object({ fluency: notes, lexical: notes, grammar: notes, pronunciation: notes }),
  strengths: z.array(z.string().min(3).max(300)).min(1).max(3),
  improvements: z.array(z.string().min(3).max(300)).min(1).max(4),
});
export type SpeakingAssessment = z.infer<typeof speakingAssessmentSchema>;

export const speakingAssessmentResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.OBJECT,
      description: "Баллы 0-9 с шагом 0.5",
      properties: criterionProps(
        SPEAKING_CRITERIA.map((c) => c.key),
        Type.NUMBER,
      ),
      required: SPEAKING_CRITERIA.map((c) => c.key),
    },
    comments: {
      type: Type.OBJECT,
      description: "Обоснование по-русски, 2-3 предложения, с примерами из ответов",
      properties: criterionProps(
        SPEAKING_CRITERIA.map((c) => c.key),
        Type.STRING,
      ),
      required: SPEAKING_CRITERIA.map((c) => c.key),
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["criteria", "comments", "strengths", "improvements"],
};

export interface SpeakingAnswer {
  part: 1 | 2 | 3;
  question: string;
  answer: string;
  /** Длительность ответа, секунды (по таймеру), если известна. */
  seconds?: number;
}

export function buildSpeakingAssessmentPrompt(answers: SpeakingAnswer[]) {
  const system = [
    "Ты опытный экзаменатор IELTS Speaking. Оцениваешь ответы по Parts 1-3 по расшифровке речи.",
    "Критерии: fluency (Fluency and Coherence), lexical (Lexical Resource), grammar (Grammatical Range and Accuracy), pronunciation (Pronunciation). Баллы 0-9 с шагом 0.5 по публичным дескрипторам.",
    "Расшифровка сделана автоматическим распознаванием речи: пунктуации и интонации в ней нет. Произношение по тексту оценить нельзя точно: оцени его осторожно, по тому, насколько речь была распознана и понятна, и прямо скажи об этом ограничении в комментарии. Не снижай другие критерии за отсутствие знаков препинания.",
    "Очень короткие ответы (Part 2 меньше нескольких предложений) снижают fluency и lexical. Будь честным, не завышай.",
    "Комментарии и советы пиши по-русски с цитатами из ответов. Отвечай только JSON по заданной схеме.",
    UNTRUSTED_RULE,
  ].join(" ");
  const body = answers
    .map(
      (a, i) =>
        `Part ${a.part}, вопрос ${i + 1}: ${a.question}\n${wrapUntrusted("user_answer", a.answer || "(ответа нет)")}${
          a.seconds ? `\n(длительность: ${a.seconds} с)` : ""
        }`,
    )
    .join("\n\n");
  return { system, prompt: body };
}

/** Баллы модели приводятся к шкале: шаг 0.5, не выше 9. */
export function normalizeCriteria<K extends string>(criteria: Record<K, number>): Record<K, number> {
  return Object.fromEntries(Object.entries<number>(criteria).map(([k, v]) => [k, clampBand(v)])) as Record<K, number>;
}

/* ───────────── Еженедельный отчёт ───────────── */

export interface WeeklyFacts {
  minutes: number;
  answers: number;
  /** 0..100 или null, если ответов не было. */
  accuracy: number | null;
  lessonsCompleted: number;
  xp: number;
  streak: number;
  activeDays: number;
  newMistakes: { topic: string; count: number }[];
  mistakesResolved: number;
  ieltsChecks: number;
  goal: string;
  level: string | null;
}

export const weeklyReportSchema = z.object({
  summary: z.string().min(10).max(700),
  wins: z.array(z.string().min(3).max(300)).min(1).max(3),
  focus: z.array(z.string().min(3).max(300)).min(1).max(3),
  plan: z.array(z.string().min(3).max(300)).min(2).max(4),
});
export type WeeklyReport = z.infer<typeof weeklyReportSchema>;

export const weeklyReportResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Итог недели по-русски, 2-3 предложения, на «вы»" },
    wins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 конкретных успеха недели" },
    focus: { type: Type.ARRAY, items: { type: Type.STRING }, description: "1-3 слабых места, на которые обратить внимание" },
    plan: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-4 конкретных шага на следующую неделю" },
  },
  required: ["summary", "wins", "focus", "plan"],
};

export function buildWeeklyReportPrompt(f: WeeklyFacts) {
  const system = [
    "Ты наставник по английскому. По цифрам недели ученика пишешь короткий честный отчёт по-русски.",
    "Опирайся только на переданные числа: ничего не выдумывай и не хвали без повода. Если активности почти не было, скажи об этом спокойно и предложи посильный шаг.",
    "Советы конкретны: что именно делать и сколько раз. Обращайся на «вы». Отвечай только JSON по заданной схеме.",
  ].join(" ");
  const mistakes = f.newMistakes.length > 0 ? f.newMistakes.map((m) => `${m.topic}: ${m.count}`).join("; ") : "нет";
  const prompt = [
    `Цель ученика: ${f.goal}. Уровень: ${f.level ?? "не определён"}.`,
    `За последние 7 дней:`,
    `- занимался дней: ${f.activeDays} из 7, минут практики: ${f.minutes}`,
    `- ответов: ${f.answers}, точность: ${f.accuracy === null ? "нет данных" : `${f.accuracy}%`}`,
    `- пройдено уроков: ${f.lessonsCompleted}, получено XP: ${f.xp}, серия дней: ${f.streak}`,
    `- новые ошибки по темам: ${mistakes}`,
    `- усвоено ошибок повторением: ${f.mistakesResolved}, проверок IELTS: ${f.ieltsChecks}`,
  ].join("\n");
  return { system, prompt };
}
