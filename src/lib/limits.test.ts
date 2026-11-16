import { describe, expect, it } from "vitest";
import {
  PRACTICE_GRACE_SECONDS,
  WINDOW_MS,
  aiExplanationsLeft,
  chargeSeconds,
  effectivePlan,
  formatDuration,
  isOverGrace,
  isPracticeExhausted,
  isWindowActive,
  lessonAllowedForPlan,
  practiceLimitSeconds,
  practiceSecondsLeft,
  usedInWindow,
  windowResetsAt,
} from "./limits";

const now = new Date("2026-11-16T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const HOUR = 60 * 60 * 1000;

describe("effectivePlan", () => {
  it("без подписки и для free: Free", () => {
    expect(effectivePlan(undefined, now)).toBe("free");
    expect(effectivePlan(null, now)).toBe("free");
    expect(effectivePlan({ plan: "free", status: "active", currentPeriodEnd: null }, now)).toBe("free");
  });

  it("активная PRO: PRO; без срока окончания тоже", () => {
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: null }, now)).toBe("pro");
    expect(effectivePlan({ plan: "pro", status: "trialing", currentPeriodEnd: new Date(now.getTime() + HOUR) }, now)).toBe("pro");
  });

  it("истёкший срок или проблемный статус: снова Free", () => {
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: ago(1) }, now)).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: now }, now)).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "canceled", currentPeriodEnd: null }, now)).toBe("free");
    expect(effectivePlan({ plan: "pro", status: "past_due", currentPeriodEnd: null }, now)).toBe("free");
  });
});

describe("lessonAllowedForPlan: 7-й и 8-й урок", () => {
  it("Free: уроки 1–7 открыты, с 8-го пейволл", () => {
    expect(lessonAllowedForPlan("free", 1)).toBe(true);
    expect(lessonAllowedForPlan("free", 7)).toBe(true);
    expect(lessonAllowedForPlan("free", 8)).toBe(false);
    expect(lessonAllowedForPlan("free", 36)).toBe(false);
  });

  it("PRO: любые уроки", () => {
    expect(lessonAllowedForPlan("pro", 8)).toBe(true);
    expect(lessonAllowedForPlan("pro", 36)).toBe(true);
  });
});

describe("лимит практики: граница 20 минут", () => {
  it("20 минут = 1200 секунд", () => {
    expect(practiceLimitSeconds).toBe(1200);
  });

  it("до границы практика доступна, на границе закрывается", () => {
    expect(isPracticeExhausted("free", 1199)).toBe(false);
    expect(isPracticeExhausted("free", 1200)).toBe(true);
    expect(isPracticeExhausted("free", 5000)).toBe(true);
  });

  it("остаток секунд не уходит в минус; PRO без ограничений", () => {
    expect(practiceSecondsLeft("free", 0)).toBe(1200);
    expect(practiceSecondsLeft("free", 1100)).toBe(100);
    expect(practiceSecondsLeft("free", 9999)).toBe(0);
    expect(practiceSecondsLeft("pro", 9999)).toBeNull();
    expect(isPracticeExhausted("pro", 999999)).toBe(false);
    expect(isOverGrace("pro", 999999)).toBe(false);
  });

  it("запас позволяет дойти до конца урока, потом ответы не принимаются", () => {
    expect(isOverGrace("free", 1200 + PRACTICE_GRACE_SECONDS - 1)).toBe(false);
    expect(isOverGrace("free", 1200 + PRACTICE_GRACE_SECONDS)).toBe(true);
  });
});

describe("сброс через 24 часа", () => {
  it("окно активно меньше суток и истекает ровно через 24 часа", () => {
    expect(isWindowActive(ago(WINDOW_MS - 1), now)).toBe(true);
    expect(isWindowActive(ago(WINDOW_MS), now)).toBe(false);
    expect(isWindowActive(ago(25 * HOUR), now)).toBe(false);
  });

  it("время до сброса считается от начала окна", () => {
    const start = ago(5 * HOUR);
    expect(windowResetsAt(start).getTime() - now.getTime()).toBe(19 * HOUR);
  });

  it("израсходованное в истёкшем окне не учитывается, в активном учитывается", () => {
    expect(usedInWindow({ windowStart: ago(2 * HOUR), practiceSeconds: 1300 }, now)).toBe(1300);
    expect(usedInWindow({ windowStart: ago(25 * HOUR), practiceSeconds: 1300 }, now)).toBe(0);
    expect(usedInWindow(null, now)).toBe(0);
    // после сброса снова доступна практика
    expect(isPracticeExhausted("free", usedInWindow({ windowStart: ago(25 * HOUR), practiceSeconds: 1300 }, now))).toBe(false);
  });
});

describe("chargeSeconds", () => {
  it("округляет секунды, держит рамки 5–180, без данных 10", () => {
    expect(chargeSeconds(12400)).toBe(12);
    expect(chargeSeconds(0)).toBe(5);
    expect(chargeSeconds(800)).toBe(5);
    expect(chargeSeconds(10 * 60 * 1000)).toBe(180);
    expect(chargeSeconds(undefined)).toBe(10);
    expect(chargeSeconds(null)).toBe(10);
    expect(chargeSeconds(Number.NaN)).toBe(10);
  });
});

describe("AI-разборы ошибок: 5 в сутки", () => {
  it("Free: считаются до нуля, PRO без ограничений", () => {
    expect(aiExplanationsLeft("free", 0)).toBe(5);
    expect(aiExplanationsLeft("free", 4)).toBe(1);
    expect(aiExplanationsLeft("free", 5)).toBe(0);
    expect(aiExplanationsLeft("free", 9)).toBe(0);
    expect(aiExplanationsLeft("pro", 99)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("читаемое время до сброса", () => {
    expect(formatDuration(3 * HOUR + 12 * 60 * 1000)).toBe("3 ч 12 мин");
    expect(formatDuration(2 * HOUR)).toBe("2 ч");
    expect(formatDuration(45 * 60 * 1000)).toBe("45 мин");
    expect(formatDuration(20 * 1000)).toBe("1 мин");
    expect(formatDuration(0)).toBe("менее минуты");
    expect(formatDuration(-5)).toBe("менее минуты");
  });
});
