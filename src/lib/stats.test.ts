import { describe, expect, it } from "vitest";
import { accuracyByTopic, buildActivity, buildXpSeries, computeAchievements, lastDates, type AchievementFacts } from "./stats";

const now = new Date("2026-11-16T12:00:00Z");

describe("lastDates", () => {
  it("даёт заданное число дат по порядку, заканчивая сегодняшней", () => {
    const d = lastDates(now, "UTC", 5);
    expect(d).toEqual(["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
  });

  it("учитывает часовой пояс при смене суток", () => {
    const late = new Date("2026-11-16T22:30:00Z");
    expect(lastDates(late, "Europe/Moscow", 2)).toEqual(["2026-11-16", "2026-11-17"]);
  });
});

describe("buildActivity", () => {
  it("складывает ответы и время по дням, пустые дни остаются нулями", () => {
    const rows = [
      { createdAt: new Date("2026-11-16T09:00:00Z"), timeMs: 30_000, isCorrect: true },
      { createdAt: new Date("2026-11-16T10:00:00Z"), timeMs: 90_000, isCorrect: false },
      { createdAt: new Date("2026-11-14T10:00:00Z"), timeMs: null, isCorrect: true },
      { createdAt: new Date("2026-10-01T10:00:00Z"), timeMs: 60_000, isCorrect: true }, // вне окна
    ];
    const a = buildActivity(rows, now, "UTC", 3);
    expect(a.map((x) => x.date)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(a[2]).toEqual({ date: "2026-11-16", minutes: 2, answers: 2, correct: 1 });
    expect(a[1]).toEqual({ date: "2026-11-15", minutes: 0, answers: 0, correct: 0 });
    expect(a[0].answers).toBe(1);
  });
});

describe("buildXpSeries", () => {
  it("считает XP по дням и накопленный итог", () => {
    const s = buildXpSeries(
      [
        { createdAt: new Date("2026-11-15T09:00:00Z"), amount: 8 },
        { createdAt: new Date("2026-11-16T09:00:00Z"), amount: 10 },
        { createdAt: new Date("2026-11-16T11:00:00Z"), amount: 5 },
      ],
      now,
      "UTC",
      3,
    );
    expect(s.map((x) => x.xp)).toEqual([0, 8, 15]);
    expect(s.map((x) => x.total)).toEqual([0, 8, 23]);
  });
});

describe("accuracyByTopic", () => {
  it("группирует по темам и округляет процент; неизвестные уроки пропускает", () => {
    const rows = [
      { lessonId: "a1", isCorrect: true },
      { lessonId: "a2", isCorrect: false },
      { lessonId: "a2", isCorrect: true },
      { lessonId: "b1", isCorrect: true },
      { lessonId: "zzz", isCorrect: true },
    ];
    const map: Record<string, string> = { a1: "A", a2: "A", b1: "B" };
    const r = accuracyByTopic(rows, (l) => map[l]);
    expect(r).toEqual([
      { topicId: "A", answers: 3, correct: 2, accuracy: 67 },
      { topicId: "B", answers: 1, correct: 1, accuracy: 100 },
    ]);
  });
});

describe("computeAchievements", () => {
  const none: AchievementFacts = {
    lessonsCompleted: 0,
    topicsCompleted: 0,
    totalAnswers: 0,
    correctAnswers: 0,
    longestStreak: 0,
    xp: 0,
    mistakesResolved: 0,
    ieltsChecks: 0,
    favoritePhrases: 0,
    chatMessages: 0,
  };

  it("в начале ничего не получено, прогресс нулевой", () => {
    const a = computeAchievements(none);
    expect(a.every((x) => !x.unlocked)).toBe(true);
    expect(a.find((x) => x.id === "ten-lessons")!.progress).toEqual([0, 10]);
  });

  it("достижение открывается ровно на границе, прогресс не выходит за цель", () => {
    const a = computeAchievements({ ...none, lessonsCompleted: 10, longestStreak: 6, totalAnswers: 250 });
    expect(a.find((x) => x.id === "first-lesson")!.unlocked).toBe(true);
    expect(a.find((x) => x.id === "ten-lessons")!.unlocked).toBe(true);
    expect(a.find((x) => x.id === "streak-3")!.unlocked).toBe(true);
    const s7 = a.find((x) => x.id === "streak-7")!;
    expect(s7.unlocked).toBe(false);
    expect(s7.progress).toEqual([6, 7]);
    expect(a.find((x) => x.id === "hundred-answers")!.progress).toEqual([100, 100]);
  });

  it("идентификаторы достижений уникальны", () => {
    const ids = computeAchievements(none).map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
