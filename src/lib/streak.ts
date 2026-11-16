/** Дата YYYY-MM-DD в часовом поясе пользователя. Неизвестный пояс заменяется на UTC. */
export function localDate(now: Date, timeZone: string): string {
  try {
    // en-CA даёт формат YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Момент локальной полуночи для переданного пояса (без учёта перевода часов внутри суток). */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sinceMidnightMs = ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000;
  return new Date(now.getTime() - sinceMidnightMs - now.getMilliseconds());
}

const DAY_MS = 24 * 60 * 60 * 1000;

function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

export interface StreakState {
  streak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

/** Серия после активности сегодня: тот же день ничего не меняет, вчера продлевает, пропуск начинает заново. */
export function nextStreak(state: StreakState, today: string): StreakState {
  if (state.lastActiveDate === today) return state;
  const streak = state.lastActiveDate === previousDate(today) ? state.streak + 1 : 1;
  return { streak, longestStreak: Math.max(state.longestStreak, streak), lastActiveDate: today };
}

/** Серия для показа: если не занимались ни вчера, ни сегодня, она уже прервана. */
export function effectiveStreak(state: Pick<StreakState, "streak" | "lastActiveDate">, today: string): number {
  if (state.lastActiveDate === today || state.lastActiveDate === previousDate(today)) return state.streak;
  return 0;
}
