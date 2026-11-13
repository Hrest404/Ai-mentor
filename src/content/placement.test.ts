import { describe, expect, it } from "vitest";
import { levelFromScore, PLACEMENT, scorePlacement } from "./placement";

describe("тест уровня", () => {
  it("12 вопросов, верный ответ есть среди вариантов, id уникальны", () => {
    expect(PLACEMENT).toHaveLength(12);
    expect(new Set(PLACEMENT.map((q) => q.id)).size).toBe(12);
    for (const q of PLACEMENT) {
      expect(q.options, q.id).toContain(q.answer);
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
    }
  });

  it("считает только верные ответы, чужие id игнорирует", () => {
    expect(scorePlacement({})).toBe(0);
    expect(scorePlacement({ q1: "is", q2: "drinks", zzz: "is" })).toBe(1);
    expect(scorePlacement(Object.fromEntries(PLACEMENT.map((q) => [q.id, q.answer])))).toBe(12);
  });

  it("границы уровней", () => {
    expect([0, 2, 3, 5, 6, 8, 9, 10, 11, 12].map(levelFromScore)).toEqual(
      ["A1", "A1", "A2", "A2", "B1", "B1", "B2", "B2", "C1", "C1"],
    );
  });
});
