import { startOfLocalDay } from "./streak";

/**
 * Интервальное повторение ошибок (система коробок Лейтнера).
 * Ошибка попадает в коробку 0 и доступна сразу. Верный ответ при повторении двигает её вверх
 * с растущей паузой, неверный возвращает в коробку 0 с короткой паузой. После верного ответа
 * в последней коробке ошибка считается усвоенной.
 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_BOX = REVIEW_INTERVAL_DAYS.length;
/** Пауза после неверного повторения: ошибка вернётся позже, но не зациклит сессию. */
export const RETRY_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewOutcome {
  box: number;
  dueAt: Date;
  resolved: boolean;
}

export function reviewOutcome(input: { box: number; correct: boolean; now?: Date }): ReviewOutcome {
  const now = input.now ?? new Date();
  const box = Math.min(Math.max(0, Math.floor(input.box)), MAX_BOX);

  if (!input.correct) return { box: 0, dueAt: new Date(now.getTime() + RETRY_DELAY_MS), resolved: false };
  if (box >= MAX_BOX) return { box: MAX_BOX, dueAt: now, resolved: true };

  const next = box + 1;
  return { box: next, dueAt: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[next - 1] * DAY_MS), resolved: false };
}

export interface MistakeSchedule {
  dueAt: Date;
  box: number;
  resolvedAt: Date | null;
}

/** Пора повторять: не усвоена и срок наступил. */
export function isDue(m: MistakeSchedule, now: Date = new Date()): boolean {
  return m.resolvedAt === null && m.dueAt.getTime() <= now.getTime();
}

/** Нужно повторить сегодня (по локальным суткам пользователя), включая то, что созреет позже в этот день. */
export function isDueToday(m: MistakeSchedule, now: Date, timeZone: string): boolean {
  if (m.resolvedAt !== null) return false;
  const nextMidnight = startOfLocalDay(now, timeZone).getTime() + DAY_MS;
  return m.dueAt.getTime() < nextMidnight;
}

/** Очередь: сначала самые просроченные, при равенстве те, что в младших коробках. */
export function sortReviewQueue<T extends MistakeSchedule>(items: T[]): T[] {
  return [...items].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime() || a.box - b.box);
}

/** Когда следующее повторение: «сейчас», «через 10 мин», «завтра», «через 3 дня». */
export function describeNextReview(dueAt: Date, now: Date = new Date(), timeZone = "UTC"): string {
  const diff = dueAt.getTime() - now.getTime();
  if (diff <= 0) return "сейчас";
  if (diff < 60 * 60 * 1000) return `через ${Math.max(1, Math.round(diff / 60000))} мин`;

  const today = startOfLocalDay(now, timeZone).getTime();
  const dueDay = startOfLocalDay(dueAt, timeZone).getTime();
  const days = Math.round((dueDay - today) / DAY_MS);
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  const m10 = days % 10;
  const m100 = days % 100;
  const word = m10 === 1 && m100 !== 11 ? "день" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "дня" : "дней";
  return `через ${days} ${word}`;
}
