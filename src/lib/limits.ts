import { FREE_LIMITS } from "./plans";

/**
 * Лимиты тарифов: чистые функции без обращения к базе. Единое место для решений «можно ли».
 * Серверные действия и страницы вызывают их с данными из базы.
 */
export type Plan = "free" | "pro";

/** Окно лимита практики: 24 часа от первого ответа. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Запас сверх лимита, чтобы можно было дойти до конца начатого урока. */
export const PRACTICE_GRACE_SECONDS = 5 * 60;

const MIN_CHARGE_SECONDS = 5;
const MAX_CHARGE_SECONDS = 180;
const DEFAULT_CHARGE_SECONDS = 10;

interface SubscriptionLike {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: Date | null;
}

/** Действующий тариф: PRO только при активной подписке, срок которой не истёк. */
export function effectivePlan(sub: SubscriptionLike | null | undefined, now: Date = new Date()): Plan {
  if (!sub || sub.plan !== "pro") return "free";
  if (sub.status !== "active" && sub.status !== "trialing") return "free";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime()) return "free";
  return "pro";
}

/** Номер урока в курсе (сквозной) разрешён тарифу: Free только первые уроки. */
export function lessonAllowedForPlan(plan: Plan, globalOrder: number): boolean {
  return plan === "pro" || globalOrder <= FREE_LIMITS.lessons;
}

export const practiceLimitSeconds = FREE_LIMITS.practiceMinutesPerDay * 60;

export function isWindowActive(windowStart: Date, now: Date = new Date()): boolean {
  return now.getTime() - windowStart.getTime() < WINDOW_MS;
}

export function windowResetsAt(windowStart: Date): Date {
  return new Date(windowStart.getTime() + WINDOW_MS);
}

/** Сколько секунд практики засчитать за ответ: по времени из браузера, но не меньше и не больше разумного. */
export function chargeSeconds(timeMs: number | null | undefined): number {
  if (timeMs === null || timeMs === undefined || !Number.isFinite(timeMs)) return DEFAULT_CHARGE_SECONDS;
  return Math.min(MAX_CHARGE_SECONDS, Math.max(MIN_CHARGE_SECONDS, Math.round(timeMs / 1000)));
}

/** Сколько секунд практики осталось в окне; null: без ограничений (PRO). */
export function practiceSecondsLeft(plan: Plan, usedSeconds: number): number | null {
  if (plan === "pro") return null;
  return Math.max(0, practiceLimitSeconds - usedSeconds);
}

/** Лимит исчерпан: новый урок начинать нельзя. */
export function isPracticeExhausted(plan: Plan, usedSeconds: number): boolean {
  return plan === "free" && usedSeconds >= practiceLimitSeconds;
}

/** Запас тоже выбран: ответы больше не принимаются. */
export function isOverGrace(plan: Plan, usedSeconds: number): boolean {
  return plan === "free" && usedSeconds >= practiceLimitSeconds + PRACTICE_GRACE_SECONDS;
}

/** Сколько AI-разборов ошибок осталось в окне; null: без ограничений. */
export function aiExplanationsLeft(plan: Plan, used: number): number | null {
  if (plan === "pro") return null;
  return Math.max(0, FREE_LIMITS.aiExplanationsPerDay - used);
}

/** Использованное время в окне: если окно истекло, отсчёт начинается заново. */
export function usedInWindow(
  usage: { windowStart: Date; practiceSeconds: number } | null | undefined,
  now: Date = new Date(),
): number {
  return usage && isWindowActive(usage.windowStart, now) ? usage.practiceSeconds : 0;
}

/** Как показать время до сброса: «3 ч 12 мин», «45 мин», «менее минуты». */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.ceil(Math.max(0, ms) / 60000);
  if (totalMinutes < 1) return "менее минуты";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}
