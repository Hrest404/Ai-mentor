import { describe, expect, it } from "vitest";
import { buildCourse, TOPICS } from "./course";
import { SITUATIONS } from "./phrasebook";
import { theorySchema, validateExercise, type ExerciseKind } from "./types";

const course = buildCourse();

describe("курс", () => {
  it("6 тем, в каждой теория, 4 практических урока и итоговый тест", () => {
    expect(TOPICS).toHaveLength(6);
    for (const t of TOPICS) {
      expect(theorySchema.safeParse(t.theory).success, t.id).toBe(true);
      expect(t.lessons.filter((l) => l.type === "practice"), t.id).toHaveLength(4);
      expect(t.lessons.filter((l) => l.type === "test"), t.id).toHaveLength(1);
      expect(t.lessons.at(-1)?.type, `${t.id}: тест идёт последним`).toBe("test");
    }
  });

  it("id уникальны, сквозной порядок уроков без пропусков", () => {
    const ids = [...course.topics, ...course.lessons, ...course.exercises].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(course.lessons.map((l) => l.globalOrder)).toEqual(course.lessons.map((_, i) => i + 1));
  });

  it("каждая тема начинается с урока теории", () => {
    for (const t of course.topics) {
      const first = course.lessons.find((l) => l.topicId === t.id && l.orderIndex === 1);
      expect(first?.type, t.id).toBe("theory");
    }
  });

  it("каждое упражнение корректно", () => {
    const problems = course.exercises.flatMap((e) =>
      validateExercise({ kind: e.kind, tag: e.tag, ...e.payload }).map((p) => `${e.id}: ${p}`),
    );
    expect(problems).toEqual([]);
  });

  it("не меньше 150 упражнений, используются все семь типов", () => {
    expect(course.exercises.length).toBeGreaterThanOrEqual(150);
    const kinds = new Set<ExerciseKind>(course.exercises.map((e) => e.kind));
    expect([...kinds].sort()).toEqual(
      ["build_sentence", "choice", "dictation", "fill_blank", "listening", "match_pairs", "translate"],
    );
  });

  it("в каждом уроке с упражнениями их не меньше пяти", () => {
    for (const l of course.lessons.filter((x) => x.type !== "theory")) {
      const n = course.exercises.filter((e) => e.lessonId === l.id).length;
      expect(n, l.id).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("validateExercise ловит ошибки", () => {
  const base = { tag: "t", explanation: "e" };
  it("верного ответа нет среди вариантов", () => {
    expect(validateExercise({ ...base, kind: "choice", prompt: "p", options: ["a", "b"], answer: "c" })).not.toEqual([]);
  });
  it("два пропуска в предложении", () => {
    expect(validateExercise({ ...base, kind: "fill_blank", sentence: "___ and ___", answers: ["x"] })).not.toEqual([]);
  });
  it("лишнее слово совпадает со словом ответа", () => {
    expect(
      validateExercise({ ...base, kind: "build_sentence", ru: "р", words: ["I", "do"], extra: ["do"] }),
    ).not.toEqual([]);
  });
  it("неоднозначные пары", () => {
    expect(
      validateExercise({
        ...base, kind: "match_pairs", instruction: "i", pairs: [["a", "x"], ["b", "x"], ["c", "y"]],
      }),
    ).not.toEqual([]);
  });
});

describe("разговорник", () => {
  it("8 ситуаций, не меньше 120 фраз, две ситуации бесплатные", () => {
    expect(SITUATIONS).toHaveLength(8);
    expect(SITUATIONS.flatMap((s) => s.phrases).length).toBeGreaterThanOrEqual(120);
    expect(SITUATIONS.filter((s) => s.isFree)).toHaveLength(2);
  });

  it("id ситуаций уникальны, фразы не пустые и не повторяются", () => {
    expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length);
    const en = SITUATIONS.flatMap((s) => s.phrases.map((p) => p[0].toLowerCase()));
    expect(new Set(en).size).toBe(en.length);
    for (const s of SITUATIONS) for (const [e, r] of s.phrases) expect(e && r, s.id).toBeTruthy();
  });
});
