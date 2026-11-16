import { describe, expect, it } from "vitest";
import { SPEAKING_SETS, WRITING_TASKS, speakingQuestions } from "@/content/ielts-tasks";
import { buildStudyPlan, clampBand, countWords, currentBandEstimate, overallBand, weakestCriterion } from "./ielts";

describe("countWords", () => {
  it("считает слова, сокращения и дефисные слова как одно слово", () => {
    expect(countWords("I don't know the well-known answer.")).toBe(6);
    expect(countWords("  ")).toBe(0);
    expect(countWords("One,two; three!")).toBe(3);
  });
});

describe("баллы IELTS", () => {
  it("округляет до 0.5 по правилам экзамена", () => {
    expect(overallBand([6, 6, 6, 7])).toBe(6.5); // 6.25 → 6.5
    expect(overallBand([6, 7, 7, 7])).toBe(7); // 6.75 → 7.0
    expect(overallBand([6, 6, 6, 6.5])).toBe(6); // 6.125 → 6.0
    expect(overallBand([5.5, 6, 6, 6])).toBe(6); // 5.875 → 6.0
    expect(overallBand([])).toBe(0);
  });

  it("ограничивает шкалой 0–9 с шагом 0.5", () => {
    expect(clampBand(9.7)).toBe(9);
    expect(clampBand(-1)).toBe(0);
    expect(clampBand(6.3)).toBe(6.5);
  });
});

describe("банк заданий", () => {
  it("идентификаторы уникальны, у заданий есть условие", () => {
    const ids = [...WRITING_TASKS.map((t) => t.id), ...SPEAKING_SETS.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(WRITING_TASKS.every((t) => t.prompt.length > 80)).toBe(true);
    expect(WRITING_TASKS.some((t) => t.task === 1)).toBe(true);
    expect(WRITING_TASKS.some((t) => t.task === 2)).toBe(true);
  });

  it("Speaking-сессия идёт по частям 1, 2, 3", () => {
    const q = speakingQuestions(SPEAKING_SETS[0]);
    expect(q.map((x) => x.part)).toEqual([1, 1, 1, 1, 2, 3, 3, 3]);
  });
});

describe("buildStudyPlan", () => {
  const base = { today: "2026-11-16", targetBand: 7, currentBand: 6 };

  it("считает дни и недели до экзамена", () => {
    const p = buildStudyPlan({ ...base, examDate: "2026-12-14" })!;
    expect(p.daysLeft).toBe(28);
    expect(p.weeksLeft).toBe(4);
    expect(p.weeks).toHaveLength(4);
    expect(p.weeks[3].focus).toBe("Финальная неделя");
    expect(p.weeks[0].start).toBe("2026-11-16");
  });

  it("интенсивность растёт с разрывом до цели", () => {
    expect(buildStudyPlan({ ...base, examDate: "2027-02-01", currentBand: 7 })!.intensity).toBe("light");
    expect(buildStudyPlan({ ...base, examDate: "2027-02-01", currentBand: 6 })!.intensity).toBe("regular");
    expect(buildStudyPlan({ ...base, examDate: "2027-02-01", currentBand: 5 })!.intensity).toBe("intense");
  });

  it("предупреждает, если срок короче реалистичного", () => {
    const p = buildStudyPlan({ today: "2026-11-16", examDate: "2026-11-30", targetBand: 7.5, currentBand: 5 })!;
    expect(p.warning).toContain("нед.");
    expect(buildStudyPlan({ ...base, examDate: "2027-06-01" })!.warning).toBeNull();
  });

  it("прошедшая или неверная дата экзамена даёт null; экзамен сегодня: одна неделя", () => {
    expect(buildStudyPlan({ ...base, examDate: "2026-11-01" })).toBeNull();
    expect(buildStudyPlan({ ...base, examDate: "bad" })).toBeNull();
    expect(buildStudyPlan({ ...base, examDate: "2026-11-16" })!.weeksLeft).toBe(1);
  });

  it("показывает не больше 12 недель", () => {
    expect(buildStudyPlan({ ...base, examDate: "2027-12-01" })!.weeks).toHaveLength(12);
  });
});

describe("оценка текущего балла и слабый критерий", () => {
  it("среднее по последним пяти проверкам, иначе ориентир по уровню", () => {
    expect(currentBandEstimate([6, 6.5, 7], "A2")).toBe(6.5);
    expect(currentBandEstimate([], "B2")).toBe(6.5);
    expect(currentBandEstimate([], null)).toBe(4);
  });

  it("находит критерий с самым низким средним", () => {
    const labels = { task: "Задание", grammar: "Грамматика" };
    const w = weakestCriterion(
      [{ criteria: { task: 7, grammar: 5.5 } }, { criteria: { task: 6.5, grammar: 6 } }, { criteria: null }],
      labels,
    );
    expect(w).toEqual({ key: "grammar", label: "Грамматика", avg: 5.8 });
    expect(weakestCriterion([], labels)).toBeNull();
  });
});
