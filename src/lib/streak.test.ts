import { describe, expect, it } from "vitest";
import { effectiveStreak, isValidTimeZone, localDate, nextStreak, startOfLocalDay } from "./streak";

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
