import { describe, expect, it } from "vitest";
import { advanceStreak, effectiveStreak, grantWeeklyFreeze, isValidTimeZone, localDate, nextStreak, startOfLocalDay, weekStart } from "./streak";

describe("localDate", () => {
  it("учитывает часовой пояс на границе суток", () => {
    const t = new Date("2026-11-16T22:30:00Z");
    expect(localDate(t, "UTC")).toBe("2026-11-16");
    expect(localDate(t, "Europe/Moscow")).toBe("2026-11-17"); // UTC+3
    expect(localDate(t, "America/New_York")).toBe("2026-11-16");
  });

  it("неизвестный пояс заменяется на UTC", () => {
    expect(localDate(new Date("2026-11-16T22:30:00Z"), "Not/AZone")).toBe("2026-11-16");
    expect(isValidTimeZone("Europe/Moscow")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("startOfLocalDay", () => {
  it("возвращает локальную полночь", () => {
    const now = new Date("2026-11-16T22:30:15.500Z");
    expect(startOfLocalDay(now, "UTC").toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(startOfLocalDay(now, "Europe/Moscow").toISOString()).toBe("2026-11-16T21:00:00.000Z");
  });
});

describe("nextStreak", () => {
  const base = { streak: 3, longestStreak: 5, lastActiveDate: "2026-11-16" };

  it("в тот же день серия не меняется", () => {
    expect(nextStreak(base, "2026-11-16")).toEqual(base);
  });

  it("на следующий день серия растёт, рекорд обновляется", () => {
    expect(nextStreak(base, "2026-11-17")).toEqual({ streak: 4, longestStreak: 5, lastActiveDate: "2026-11-17" });
    expect(nextStreak({ ...base, streak: 5 }, "2026-11-17").longestStreak).toBe(6);
  });

  it("после пропуска серия начинается заново, рекорд сохраняется", () => {
    expect(nextStreak(base, "2026-11-18")).toEqual({ streak: 1, longestStreak: 5, lastActiveDate: "2026-11-18" });
  });

  it("первая активность даёт серию 1; переход через границу месяца и года", () => {
    expect(nextStreak({ streak: 0, longestStreak: 0, lastActiveDate: null }, "2026-11-16").streak).toBe(1);
    expect(nextStreak({ streak: 2, longestStreak: 2, lastActiveDate: "2026-11-30" }, "2026-12-01").streak).toBe(3);
    expect(nextStreak({ streak: 2, longestStreak: 2, lastActiveDate: "2026-12-31" }, "2027-01-01").streak).toBe(3);
  });
});

describe("effectiveStreak", () => {
  it("серия живёт сегодня и вчера, позавчера уже прервана", () => {
    expect(effectiveStreak({ streak: 4, lastActiveDate: "2026-11-16" }, "2026-11-16")).toBe(4);
    expect(effectiveStreak({ streak: 4, lastActiveDate: "2026-11-15" }, "2026-11-16")).toBe(4);
    expect(effectiveStreak({ streak: 4, lastActiveDate: "2026-11-14" }, "2026-11-16")).toBe(0);
    expect(effectiveStreak({ streak: 0, lastActiveDate: null }, "2026-11-16")).toBe(0);
  });
});

describe("заморозка серии", () => {
  const state = { streak: 4, longestStreak: 4, lastActiveDate: "2026-11-13" };

  it("неделя считается с понедельника", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // понедельник
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // воскресенье
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });

  it("PRO получает одну заморозку в неделю, Free ни одной, неиспользованные не копятся", () => {
    const fresh = { streakFreezes: 0, freezeWeek: null };
    expect(grantWeeklyFreeze(fresh, "2026-11-16", true)).toEqual({ streakFreezes: 1, freezeWeek: "2026-11-16" });
    expect(grantWeeklyFreeze(fresh, "2026-11-16", false)).toEqual(fresh);
    const granted = { streakFreezes: 1, freezeWeek: "2026-11-16" };
    expect(grantWeeklyFreeze(granted, "2026-11-20", true)).toEqual(granted);
    expect(grantWeeklyFreeze(granted, "2026-11-24", true)).toEqual({ streakFreezes: 1, freezeWeek: "2026-11-23" });
    // потраченная заморозка на той же неделе не возвращается
    expect(grantWeeklyFreeze({ streakFreezes: 0, freezeWeek: "2026-11-16" }, "2026-11-20", true).streakFreezes).toBe(0);
  });

  it("один пропущенный день закрывается заморозкой: серия растёт, заморозка тратится", () => {
    const r = advanceStreak(state, "2026-11-15", 1);
    expect(r).toMatchObject({ streak: 5, longestStreak: 5, freezes: 0, freezeUsed: true });
  });

  it("без заморозки пропуск обнуляет серию", () => {
    expect(advanceStreak(state, "2026-11-15", 0)).toMatchObject({ streak: 1, freezeUsed: false });
  });

  it("два пропущенных дня заморозка не спасает и не тратится", () => {
    expect(advanceStreak(state, "2026-11-16", 1)).toMatchObject({ streak: 1, freezes: 1, freezeUsed: false });
  });

  it("обычное продление и тот же день заморозку не трогают", () => {
    expect(advanceStreak(state, "2026-11-14", 1)).toMatchObject({ streak: 5, freezes: 1, freezeUsed: false });
    expect(advanceStreak(state, "2026-11-13", 1)).toMatchObject({ streak: 4, freezes: 1, freezeUsed: false });
  });

  it("effectiveStreak сохраняет серию после одного пропуска, пока есть заморозка", () => {
    expect(effectiveStreak({ ...state, streakFreezes: 1 }, "2026-11-15")).toBe(4);
    expect(effectiveStreak({ ...state, streakFreezes: 0 }, "2026-11-15")).toBe(0);
    expect(effectiveStreak({ ...state, streakFreezes: 1 }, "2026-11-16")).toBe(0);
  });
});
