import { localDate } from "./streak";

/** Чистая логика статистики и достижений: на вход строки из базы, на выход готовые ряды. Без обращений к базе. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Последние `days` календарных дат по часовому поясу пользователя, от старой к новой. */
export function lastDates(now: Date, timeZone: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(localDate(new Date(now.getTime() - i * DAY_MS), timeZone));
  // Перевод часов может дать повтор или пропуск даты: оставляем уникальные.
  return [...new Set(out)];
}

export interface DayActivity {
  date: string;
  minutes: number;
  answers: number;
  correct: number;
}

export function buildActivity(
  rows: { createdAt: Date; timeMs: number | null; isCorrect: boolean }[],
  now: Date,
  timeZone: string,
  days = 30,
): DayActivity[] {
  const dates = lastDates(now, timeZone, days);
  const byDate = new Map<string, DayActivity>(dates.map((date) => [date, { date, minutes: 0, answers: 0, correct: 0 }]));
  const ms = new Map<string, number>();
  for (const r of rows) {
    const d = localDate(r.createdAt, timeZone);
    const day = byDate.get(d);
    if (!day) continue;
    day.answers += 1;
    if (r.isCorrect) day.correct += 1;
    ms.set(d, (ms.get(d) ?? 0) + (r.timeMs ?? 0));
  }
  for (const [d, total] of ms) byDate.get(d)!.minutes = Math.round(total / 600) / 100; // минуты с точностью до сотых
  return dates.map((d) => byDate.get(d)!);
}

export interface XpDay {
  date: string;
  xp: number;
  /** Накопленный XP за показанный период. */
  total: number;
}

export function buildXpSeries(events: { createdAt: Date; amount: number }[], now: Date, timeZone: string, days = 30): XpDay[] {
  const dates = lastDates(now, timeZone, days);
  const sums = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const e of events) {
    const d = localDate(e.createdAt, timeZone);
    if (sums.has(d)) sums.set(d, sums.get(d)! + e.amount);
  }
  let total = 0;
  return dates.map((date) => {
    const xp = sums.get(date)!;
    total += xp;
    return { date, xp, total };
  });
}

export interface TopicAccuracy {
  topicId: string;
  answers: number;
  correct: number;
  /** 0..100 */
  accuracy: number;
}

/** Точность по темам: уроки сопоставляются с темами через переданную функцию. Темы без ответов не показываются. */
export function accuracyByTopic(
  rows: { lessonId: string; isCorrect: boolean }[],
  topicOfLesson: (lessonId: string) => string | undefined,
): TopicAccuracy[] {
  const by = new Map<string, { answers: number; correct: number }>();
  for (const r of rows) {
    const topicId = topicOfLesson(r.lessonId);
    if (!topicId) continue;
    const s = by.get(topicId) ?? { answers: 0, correct: 0 };
    s.answers += 1;
    if (r.isCorrect) s.correct += 1;
    by.set(topicId, s);
  }
  return [...by.entries()].map(([topicId, s]) => ({ topicId, ...s, accuracy: Math.round((s.correct / s.answers) * 100) }));
}

/* ───────────── Достижения ───────────── */

export interface AchievementFacts {
  lessonsCompleted: number;
  topicsCompleted: number;
  totalAnswers: number;
  correctAnswers: number;
  longestStreak: number;
  xp: number;
  mistakesResolved: number;
  ieltsChecks: number;
  favoritePhrases: number;
  chatMessages: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** Прогресс к цели для ещё не полученных: [текущее, цель]. */
  progress: [number, number];
}

const GOALS: { id: string; title: string; description: string; goal: number; value: (f: AchievementFacts) => number }[] = [
  { id: "first-lesson", title: "Первый шаг", description: "Пройти первый урок", goal: 1, value: (f) => f.lessonsCompleted },
  { id: "ten-lessons", title: "Втянулись", description: "Пройти 10 уроков", goal: 10, value: (f) => f.lessonsCompleted },
  { id: "first-topic", title: "Тема закрыта", description: "Закончить целую тему вместе с итоговым тестом", goal: 1, value: (f) => f.topicsCompleted },
  { id: "hundred-answers", title: "Сотня ответов", description: "Дать 100 ответов в упражнениях", goal: 100, value: (f) => f.totalAnswers },
  { id: "five-hundred-correct", title: "Точность", description: "Дать 500 верных ответов", goal: 500, value: (f) => f.correctAnswers },
  { id: "streak-3", title: "Три дня подряд", description: "Серия занятий 3 дня", goal: 3, value: (f) => f.longestStreak },
  { id: "streak-7", title: "Неделя без пропусков", description: "Серия занятий 7 дней", goal: 7, value: (f) => f.longestStreak },
  { id: "streak-30", title: "Месяц дисциплины", description: "Серия занятий 30 дней", goal: 30, value: (f) => f.longestStreak },
  { id: "xp-500", title: "500 XP", description: "Набрать 500 опыта", goal: 500, value: (f) => f.xp },
  { id: "mistakes-10", title: "Работа над ошибками", description: "Усвоить 10 ошибок повторением", goal: 10, value: (f) => f.mistakesResolved },
  { id: "phrases-5", title: "Своя коллекция", description: "Сохранить 5 фраз в избранное", goal: 5, value: (f) => f.favoritePhrases },
  { id: "ielts-first", title: "Проба экзамена", description: "Пройти первую проверку IELTS", goal: 1, value: (f) => f.ieltsChecks },
  { id: "chat-20", title: "Разговорчивый", description: "Отправить 20 сообщений ментору в чате", goal: 20, value: (f) => f.chatMessages },
];

export function computeAchievements(facts: AchievementFacts): Achievement[] {
  return GOALS.map((g) => {
    const value = g.value(facts);
    return {
      id: g.id,
      title: g.title,
      description: g.description,
      unlocked: value >= g.goal,
      progress: [Math.min(value, g.goal), g.goal],
    };
  });
}
