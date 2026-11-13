import { z } from "zod";

export const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];

/* ───────────── Теория ───────────── */

export const theorySchema = z.object({
  intro: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        examples: z.array(z.object({ en: z.string().min(1), ru: z.string().min(1) })),
        table: z
          .object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) })
          .optional(),
      }),
    )
    .min(1),
  tips: z.array(z.string().min(1)),
});
export type Theory = z.infer<typeof theorySchema>;

/* ───────────── Упражнения ─────────────
   kind и tag хранятся в отдельных колонках таблицы exercises, остальное — в payload (JSON). */

const base = { tag: z.string().min(1), explanation: z.string().min(1) };

export const exerciseSchema = z.discriminatedUnion("kind", [
  /** Выбор одного ответа. answer — текст верного варианта. */
  z.object({
    kind: z.literal("choice"),
    ...base,
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.string().min(1),
  }),
  /** Пропуск в предложении отмечен «___». answers — все допустимые варианты. */
  z.object({
    kind: z.literal("fill_blank"),
    ...base,
    sentence: z.string().min(1),
    answers: z.array(z.string().min(1)).min(1),
  }),
  /** Собрать предложение из слов. words — верный порядок, extra — лишние слова. */
  z.object({
    kind: z.literal("build_sentence"),
    ...base,
    ru: z.string().min(1),
    words: z.array(z.string().min(1)).min(2),
    extra: z.array(z.string().min(1)),
  }),
  /** Перевод с русского. answers — допустимые переводы (без учёта регистра и пунктуации). */
  z.object({
    kind: z.literal("translate"),
    ...base,
    ru: z.string().min(1),
    answers: z.array(z.string().min(1)).min(1),
  }),
  /** Аудирование: текст озвучивает браузер, затем вопрос с вариантами. */
  z.object({
    kind: z.literal("listening"),
    ...base,
    audio: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.string().min(1),
  }),
  /** Диктант: записать услышанное. Верный ответ — сам текст audio. */
  z.object({
    kind: z.literal("dictation"),
    ...base,
    audio: z.string().min(1),
  }),
  /** Сопоставить пары [левая часть, правая часть]. */
  z.object({
    kind: z.literal("match_pairs"),
    ...base,
    instruction: z.string().min(1),
    pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(3),
  }),
]);
export type ExerciseDef = z.infer<typeof exerciseSchema>;
export type ExerciseKind = ExerciseDef["kind"];

/** Проверки, которые не выразить схемой. Возвращает список проблем (пустой, если всё в порядке). */
export function validateExercise(input: unknown): string[] {
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const e = parsed.data;
  const problems: string[] = [];
  const dup = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase())).size !== xs.length;

  if (e.kind === "choice" || e.kind === "listening") {
    if (!e.options.includes(e.answer)) problems.push("верного ответа нет среди вариантов");
    if (dup(e.options)) problems.push("повторяющиеся варианты");
  }
  if (e.kind === "fill_blank") {
    if (e.sentence.split("___").length !== 2) problems.push("в предложении должен быть ровно один пропуск ___");
    if (dup(e.answers)) problems.push("повторяющиеся ответы");
  }
  if (e.kind === "translate" && dup(e.answers)) problems.push("повторяющиеся ответы");
  if (e.kind === "build_sentence") {
    const words = e.words.map((w) => w.toLowerCase());
    if (e.extra.some((x) => words.includes(x.toLowerCase())))
      problems.push("лишнее слово совпадает со словом из ответа");
  }
  if (e.kind === "match_pairs") {
    if (dup(e.pairs.map((p) => p[0])) || dup(e.pairs.map((p) => p[1])))
      problems.push("пары неоднозначны: повторяется левая или правая часть");
  }
  return problems;
}

/* ───────────── Короткие конструкторы для файлов с контентом ───────────── */

export const ch = (tag: string, prompt: string, options: string[], answer: string, explanation: string): ExerciseDef => ({
  kind: "choice", tag, prompt, options, answer, explanation,
});
export const fb = (tag: string, sentence: string, answers: string[], explanation: string): ExerciseDef => ({
  kind: "fill_blank", tag, sentence, answers, explanation,
});
/** sentence — верное предложение без точки; разбивается на слова по пробелам. */
export const bs = (tag: string, ru: string, sentence: string, extra: string[], explanation: string): ExerciseDef => ({
  kind: "build_sentence", tag, ru, words: sentence.split(" "), extra, explanation,
});
export const tr = (tag: string, ru: string, answers: string[], explanation: string): ExerciseDef => ({
  kind: "translate", tag, ru, answers, explanation,
});
export const li = (
  tag: string, audio: string, question: string, options: string[], answer: string, explanation: string,
): ExerciseDef => ({ kind: "listening", tag, audio, question, options, answer, explanation });
export const di = (tag: string, audio: string, explanation: string): ExerciseDef => ({
  kind: "dictation", tag, audio, explanation,
});
export const mp = (tag: string, instruction: string, pairs: [string, string][], explanation: string): ExerciseDef => ({
  kind: "match_pairs", tag, instruction, pairs, explanation,
});

/* ───────────── Тема ───────────── */

export interface LessonDef {
  /** Суффикс id урока внутри темы: "p1"…"p4" или "test". */
  key: string;
  type: "practice" | "test";
  title: string;
  exercises: ExerciseDef[];
}

export interface TopicDef {
  id: string;
  title: string;
  titleRu: string;
  description: string;
  level: Level;
  track: "general" | "ielts";
  theory: Theory;
  lessons: LessonDef[];
}
