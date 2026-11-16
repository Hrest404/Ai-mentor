import { describe, expect, it } from "vitest";
import { buildCourse } from "@/content/course";
import { exerciseSchema } from "@/content/types";
import { shuffled, toClientExercise } from "./exercise-view";

const all = buildCourse().exercises.map((e) => ({
  id: e.id,
  def: exerciseSchema.parse({ kind: e.kind, tag: e.tag, ...e.payload }),
}));

// Детерминированный «случайный» источник для воспроизводимых тестов.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("shuffled", () => {
  it("сохраняет элементы и не возвращает исходный порядок", () => {
    const src = [1, 2, 3, 4, 5];
    for (let s = 1; s <= 20; s++) {
      const out = shuffled(src, seeded(s));
      expect([...out].sort()).toEqual(src);
      expect(out).not.toEqual(src);
    }
    expect(shuffled([7])).toEqual([7]);
  });
});

describe("toClientExercise не раскрывает ответы", () => {
  it("нет полей answer, answers, explanation, tag, words, pairs", () => {
    for (const { id, def } of all) {
      const view = toClientExercise(id, def) as Record<string, unknown>;
      for (const key of ["answer", "answers", "explanation", "tag", "words", "pairs", "extra"]) {
        expect(view, `${id}: поле ${key}`).not.toHaveProperty(key);
      }
    }
  });

  it("в тексте запроса не встречается ответ (кроме диктанта, где текст нужен для озвучки)", () => {
    const leaks: string[] = [];
    for (const { id, def } of all) {
      const json = JSON.stringify(toClientExercise(id, def));
      if (def.kind === "fill_blank" && def.answers.some((a) => json.toLowerCase().includes(`"${a.toLowerCase()}"`))) {
        leaks.push(id);
      }
      if (def.kind === "translate" && def.answers.some((a) => json.includes(a))) leaks.push(id);
      if (def.kind === "build_sentence" && json.includes(def.words.join(" "))) leaks.push(id);
    }
    expect(leaks).toEqual([]);
  });

  it("сборка предложения: лишние слова в банке, порядок не совпадает с ответом", () => {
    const ex = all.find((e) => e.def.kind === "build_sentence" && e.def.extra.length > 0);
    if (!ex || ex.def.kind !== "build_sentence") throw new Error("нужно упражнение с лишними словами");
    const view = toClientExercise(ex.id, ex.def);
    if (view.kind !== "build_sentence") throw new Error("kind");
    expect(view.tokens).toHaveLength(ex.def.words.length + ex.def.extra.length);
    expect(view.tokens.map((t) => t.text).join(" ")).not.toBe(ex.def.words.join(" "));
  });

  it("пары: правая колонка перемешана, левые на месте", () => {
    const ex = all.find((e) => e.def.kind === "match_pairs");
    if (!ex || ex.def.kind !== "match_pairs") throw new Error("нужно упражнение match_pairs");
    const view = toClientExercise(ex.id, ex.def);
    if (view.kind !== "match_pairs") throw new Error("kind");
    expect(view.left).toEqual(ex.def.pairs.map((p) => p[0]));
    expect(view.right).not.toEqual(ex.def.pairs.map((p) => p[1]));
    expect([...view.right].sort()).toEqual(ex.def.pairs.map((p) => p[1]).sort());
  });
});
