import type { ExerciseDef } from "@/content/types";
import { checkAnswer } from "./answers";

/** Короткая формулировка задания для списка ошибок. */
export function mistakeTitle(def: ExerciseDef): string {
  switch (def.kind) {
    case "choice":
      return def.prompt;
    case "fill_blank":
      return def.sentence;
    case "build_sentence":
    case "translate":
      return def.ru;
    case "listening":
      return def.question;
    case "dictation":
      return "Диктант";
    case "match_pairs":
      return def.instruction;
  }
}

/** Эталонный ответ для показа: ученик его уже видел после ошибки. */
export const mistakeAnswer = (def: ExerciseDef): string => checkAnswer(def, null).correctAnswer;

export interface TagStat {
  tag: string;
  active: number;
  times: number;
}

/** Слабые места: категории с наибольшим числом неусвоенных ошибок (при равенстве по числу промахов). */
export function weakestTags(rows: { tag: string; resolvedAt: Date | null; timesWrong: number }[], limit = 5): TagStat[] {
  const by = new Map<string, TagStat>();
  for (const r of rows) {
    if (r.resolvedAt) continue;
    const s = by.get(r.tag) ?? { tag: r.tag, active: 0, times: 0 };
    s.active += 1;
    s.times += r.timesWrong;
    by.set(r.tag, s);
  }
  return [...by.values()].sort((a, b) => b.active - a.active || b.times - a.times || a.tag.localeCompare(b.tag)).slice(0, limit);
}

/**
 * Умное повторение: активные ошибки из двух самых слабых категорий независимо от срока.
 * Сначала те, в которых ученик ошибался чаще, затем из младших коробок.
 */
export function weakReviewQueue<T extends { tag: string; resolvedAt: Date | null; timesWrong: number; box: number }>(
  rows: T[],
  limit = 10,
): T[] {
  const tags = new Set(weakestTags(rows, 2).map((t) => t.tag));
  return rows
    .filter((r) => !r.resolvedAt && tags.has(r.tag))
    .sort((a, b) => b.timesWrong - a.timesWrong || a.box - b.box)
    .slice(0, limit);
}
