import type { ExerciseDef } from "@/content/types";

/**
 * Приводит текст к виду для сравнения: без регистра, лишних пробелов и знаков препинания,
 * с единым апострофом и раскрытыми сокращениями (don't = do not, I'm = I am).
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/n't\b/g, " not")
    .replace(/'ll\b/g, " will")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'ve\b/g, " have")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ответ пользователя: строка, слова в выбранном порядке или пары «левое → правое». */
export type UserAnswer = string | string[] | Record<string, string>;

export interface CheckResult {
  correct: boolean;
  /** Эталонный ответ для показа после проверки. */
  correctAnswer: string;
}

const same = (a: string, b: string) => normalizeText(a) === normalizeText(b);

/** Проверяет ответ на сервере. Неверный формат ответа считается неверным ответом, а не ошибкой. */
export function checkAnswer(ex: ExerciseDef, answer: unknown): CheckResult {
  switch (ex.kind) {
    case "choice":
    case "listening": {
      return {
        correct: typeof answer === "string" && answer === ex.answer,
        correctAnswer: ex.answer,
      };
    }
    case "fill_blank": {
      // Подсказка в скобках после пропуска, например «___ (watch)», в эталоне не нужна.
      const display = ex.sentence.replace(/___(\s*\([^)]*\))?/, ex.answers[0]);
      return {
        correct: typeof answer === "string" && ex.answers.some((a) => same(a, answer)),
        correctAnswer: display,
      };
    }
    case "translate": {
      return {
        correct: typeof answer === "string" && ex.answers.some((a) => same(a, answer)),
        correctAnswer: ex.answers[0],
      };
    }
    case "dictation": {
      return {
        correct: typeof answer === "string" && same(ex.audio, answer),
        correctAnswer: ex.audio,
      };
    }
    case "build_sentence": {
      const expected = ex.words.join(" ");
      const given = Array.isArray(answer) && answer.every((w) => typeof w === "string") ? answer.join(" ") : null;
      return { correct: given !== null && same(expected, given), correctAnswer: expected };
    }
    case "match_pairs": {
      const given =
        answer && typeof answer === "object" && !Array.isArray(answer) ? (answer as Record<string, unknown>) : null;
      const correct =
        given !== null &&
        Object.keys(given).length === ex.pairs.length &&
        ex.pairs.every(([l, r]) => given[l] === r);
      return { correct, correctAnswer: ex.pairs.map(([l, r]) => `${l} — ${r}`).join("; ") };
    }
  }
}

/** Текстовый вид ответа для таблицы попыток. */
export function answerToText(answer: unknown): string {
  if (typeof answer === "string") return answer;
  if (Array.isArray(answer)) return answer.join(" ");
  return JSON.stringify(answer ?? null);
}
