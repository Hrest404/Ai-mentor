/** Чистая логика IELTS: слова, баллы, ограничения заданий и план подготовки. Без обращений к базе и модели. */

export const WRITING_LIMITS = {
  1: { minWords: 150, minutes: 20, maxChars: 3000 },
  2: { minWords: 250, minutes: 40, maxChars: 5000 },
} as const;

/** Предел длины текста для обычной проверки грамматики (не IELTS). */
export const WRITING_CHECK_MAX_CHARS = 1500;

/** Не больше проверок IELTS в сутки: оценка идёт сильной (дорогой) моделью. */
export const IELTS_CHECKS_PER_DAY = 20;

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Балл IELTS: шаг 0.5, от 0 до 9. */
export const clampBand = (x: number) => Math.min(9, Math.max(0, Math.round(x * 2) / 2));

/**
 * Общий балл: среднее четырёх критериев, округлённое до 0.5 по правилам экзамена
 * (0.25 округляется вверх до 0.5, 0.75 до целого).
 */
export function overallBand(criteria: number[]): number {
  if (criteria.length === 0) return 0;
  const mean = criteria.reduce((a, b) => a + b, 0) / criteria.length;
  return clampBand(mean);
}

export const WRITING_CRITERIA = [
  { key: "task", label: "Выполнение задания", short: "Task" },
  { key: "coherence", label: "Связность и структура", short: "Coherence" },
  { key: "lexical", label: "Лексика", short: "Vocabulary" },
  { key: "grammar", label: "Грамматика", short: "Grammar" },
] as const;

export const SPEAKING_CRITERIA = [
  { key: "fluency", label: "Беглость и связность", short: "Fluency" },
  { key: "lexical", label: "Лексика", short: "Vocabulary" },
  { key: "grammar", label: "Грамматика", short: "Grammar" },
  { key: "pronunciation", label: "Произношение (по распознаванию)", short: "Pronunciation" },
] as const;

/* ───────────── План подготовки ───────────── */

/** Ориентир: балл IELTS по уровню из теста при регистрации. */
export const LEVEL_TO_BAND: Record<string, number> = { A1: 3, A2: 4, B1: 5, B2: 6.5, C1: 7.5 };

export interface PlanWeek {
  week: number;
  /** Дата начала недели YYYY-MM-DD. */
  start: string;
  focus: string;
  /** Конкретные задачи недели. */
  tasks: string[];
}

export interface StudyPlan {
  daysLeft: number;
  weeksLeft: number;
  /** Сколько баллов не хватает до цели; 0, если цель достигнута. */
  gap: number;
  startBand: number;
  intensity: "light" | "regular" | "intense";
  weeks: PlanWeek[];
  /** Заметка про реалистичность срока. */
  warning: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FOCUS = [
  "Структура эссе Task 2: введение, два абзаца, вывод",
  "Лексика: тематические слова и связки",
  "Грамматика: точность и разнообразие конструкций",
  "Task 1: письма разного тона",
  "Speaking Part 2: рассказ на 1–2 минуты",
  "Speaking Part 3: аргументация и примеры",
];

const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildStudyPlan(input: {
  today: string;
  examDate: string;
  targetBand: number;
  /** Последняя известная оценка (среднее по проверкам) или ориентир по уровню. */
  currentBand: number;
}): StudyPlan | null {
  const todayMs = Date.parse(`${input.today}T00:00:00Z`);
  const examMs = Date.parse(`${input.examDate}T00:00:00Z`);
  if (Number.isNaN(todayMs) || Number.isNaN(examMs) || examMs < todayMs) return null;

  const daysLeft = Math.round((examMs - todayMs) / DAY_MS);
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));
  const gap = Math.max(0, clampBand(input.targetBand) - clampBand(input.currentBand));
  const intensity = gap >= 1.5 ? "intense" : gap >= 0.5 ? "regular" : "light";
  const essays = intensity === "intense" ? 3 : intensity === "regular" ? 2 : 1;
  const speaking = intensity === "light" ? 1 : 2;

  // Реалистично поднять балл примерно на 0.5 за 4–6 недель регулярной практики.
  const neededWeeks = Math.ceil(gap / 0.5) * 5;
  const warning =
    gap > 0 && weeksLeft < neededWeeks
      ? `До экзамена ${weeksLeft} нед., а чтобы поднять балл на ${gap}, обычно нужно около ${neededWeeks} нед. Занимайтесь чаще или рассмотрите цель пониже.`
      : null;

  const shown = Math.min(weeksLeft, 12);
  const weeks: PlanWeek[] = Array.from({ length: shown }, (_, k) => {
    const isLast = k === weeksLeft - 1;
    const start = dateOnly(todayMs + k * 7 * DAY_MS);
    const tasks = isLast
      ? ["Пробный экзамен: Task 1 и Task 2 за 60 минут", "Полная Speaking-сессия", "Повторить свои ошибки, без новых тем"]
      : [
          `${essays} ${essays === 1 ? "письменная работа" : essays < 5 ? "письменные работы" : "письменных работ"} с проверкой`,
          `${speaking} Speaking-${speaking === 1 ? "сессия" : "сессии"}`,
          "Повторение ошибок каждый день",
        ];
    return { week: k + 1, start, focus: isLast ? "Финальная неделя" : FOCUS[k % FOCUS.length], tasks };
  });

  return { daysLeft, weeksLeft, gap, startBand: clampBand(input.currentBand), intensity, weeks, warning };
}

/** Среднее по последним оценкам; если проверок нет, ориентир по уровню. */
export function currentBandEstimate(history: number[], level: string | null): number {
  const recent = history.slice(0, 5);
  if (recent.length > 0) return clampBand(recent.reduce((a, b) => a + b, 0) / recent.length);
  return LEVEL_TO_BAND[level ?? ""] ?? 4;
}

/** Самый слабый критерий по последним проверкам: на нём стоит сосредоточиться. */
export function weakestCriterion(
  rows: { criteria: Record<string, number> | null }[],
  labels: Record<string, string>,
): { key: string; label: string; avg: number } | null {
  const sums = new Map<string, { total: number; n: number }>();
  for (const r of rows.slice(0, 10)) {
    for (const [k, v] of Object.entries(r.criteria ?? {})) {
      if (!(k in labels) || typeof v !== "number") continue;
      const s = sums.get(k) ?? { total: 0, n: 0 };
      s.total += v;
      s.n += 1;
      sums.set(k, s);
    }
  }
  let best: { key: string; label: string; avg: number } | null = null;
  for (const [key, s] of sums) {
    const avg = s.total / s.n;
    if (!best || avg < best.avg) best = { key, label: labels[key], avg: Math.round(avg * 10) / 10 };
  }
  return best;
}
