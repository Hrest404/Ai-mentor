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

const twoDaysBefore = (date: string) => previousDate(previousDate(date));

/** Понедельник недели, в которую попадает дата (YYYY-MM-DD). Неделя считается с понедельника. */
export function weekStart(date: string): string {
  const day = new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay(); // 0 = воскресенье
  const back = (day + 6) % 7;
  return new Date(Date.parse(`${date}T00:00:00Z`) - back * DAY_MS).toISOString().slice(0, 10);
}

/** Заморозка серии: PRO получает одну на неделю, неиспользованные не копятся. */
export function grantWeeklyFreeze(
  state: { streakFreezes: number; freezeWeek: string | null },
  today: string,
  isPro: boolean,
): { streakFreezes: number; freezeWeek: string | null } {
  const week = weekStart(today);
  if (!isPro || state.freezeWeek === week) return state;
  return { streakFreezes: 1, freezeWeek: week };
}

export interface AdvancedStreak extends StreakState {
  freezes: number;
  /** Заморозка закрыла пропущенный день. */
  freezeUsed: boolean;
}

/**
 * Серия после активности сегодня: тот же день ничего не меняет, вчера продлевает, пропуск начинает заново.
 * Если пропущен ровно один день и есть заморозка, она закрывает его: серия продолжается, заморозка тратится.
 */
export function advanceStreak(state: StreakState, today: string, freezes: number): AdvancedStreak {
  if (state.lastActiveDate === today) return { ...state, freezes, freezeUsed: false };
  const missedOne = state.lastActiveDate === twoDaysBefore(today);
  const useFreeze = missedOne && freezes > 0 && state.streak > 0;
  const continues = state.lastActiveDate === previousDate(today) || useFreeze;
  const streak = continues ? state.streak + 1 : 1;
  return {
    streak,
    longestStreak: Math.max(state.longestStreak, streak),
    lastActiveDate: today,
    freezes: useFreeze ? freezes - 1 : freezes,
    freezeUsed: useFreeze,
  };
}

/** Серия после активности сегодня без заморозок. */
export function nextStreak(state: StreakState, today: string): StreakState {
  const { streak, longestStreak, lastActiveDate } = advanceStreak(state, today, 0);
  return { streak, longestStreak, lastActiveDate };
}

/**
 * Серия для показа: если не занимались ни вчера, ни сегодня, она уже прервана.
 * Пропущенный вчерашний день не рвёт серию, пока есть заморозка.
 */
export function effectiveStreak(
  state: Pick<StreakState, "streak" | "lastActiveDate"> & { streakFreezes?: number },
  today: string,
): number {
  if (state.lastActiveDate === today || state.lastActiveDate === previousDate(today)) return state.streak;
  if (state.lastActiveDate === twoDaysBefore(today) && (state.streakFreezes ?? 0) > 0) return state.streak;
  return 0;
}
