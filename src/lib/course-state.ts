import { LEVELS, type Level } from "@/content/types";

/** Порог итогового теста, при котором тема считается пройденной и открывается следующая. */
export const PASS_SCORE = 80;

export type LessonState = "locked" | "available" | "completed";

export interface ProgressRow {
  status: "in_progress" | "completed";
  score: number | null;
  bestScore: number | null;
}

interface TopicInput {
  id: string;
  level: Level;
  orderIndex: number;
}
interface LessonInput {
  id: string;
  topicId: string;
  type: "theory" | "practice" | "test";
  orderIndex: number;
}

export interface LessonView<L extends LessonInput> {
  lesson: L;
  state: LessonState;
  bestScore: number | null;
}

export interface TopicView<T extends TopicInput, L extends LessonInput> {
  topic: T;
  open: boolean;
  /** Почему тема открыта: первая, пройден предыдущий тест или уровень пользователя. */
  openedBy: "first" | "previous-test" | "level" | null;
  lessons: LessonView<L>[];
  completedCount: number;
  testPassed: boolean;
}

const levelRank = (l: Level | null | undefined) => (l ? LEVELS.indexOf(l) : 0);

/** Тест пройден, если он завершён с результатом не ниже порога. */
export function isTestPassed(p: ProgressRow | undefined): boolean {
  return p?.status === "completed" && (p.bestScore ?? 0) >= PASS_SCORE;
}

/** Урок считается завершённым: тест только при проходном балле, остальные при любом завершении. */
function isCompleted(lesson: LessonInput, p: ProgressRow | undefined): boolean {
  if (!p || p.status !== "completed") return false;
  return lesson.type === "test" ? isTestPassed(p) : true;
}

/**
 * Состояние курса для пользователя.
 * Тема открыта, если она первая, если пройден итоговый тест предыдущей или если её уровень строго ниже уровня пользователя
 * (знакомое пропускаем, темы своего уровня идут по порядку).
 * Внутри открытой темы уроки идут по порядку: следующий доступен после завершения предыдущего.
 */
export function computeCourseState<T extends TopicInput, L extends LessonInput>(
  topics: T[],
  lessons: L[],
  progress: Map<string, ProgressRow>,
  userLevel: Level | null,
): TopicView<T, L>[] {
  const sortedTopics = [...topics].sort((a, b) => a.orderIndex - b.orderIndex);
  const views: TopicView<T, L>[] = [];

  for (const [i, topic] of sortedTopics.entries()) {
    const topicLessons = lessons.filter((l) => l.topicId === topic.id).sort((a, b) => a.orderIndex - b.orderIndex);
    const prev = views[i - 1];

    let openedBy: TopicView<T, L>["openedBy"] = null;
    if (i === 0) openedBy = "first";
    else if (prev?.testPassed) openedBy = "previous-test";
    else if (userLevel !== null && levelRank(topic.level) < levelRank(userLevel)) openedBy = "level";
    const open = openedBy !== null;

    let previousDone = true;
    const lessonViews: LessonView<L>[] = topicLessons.map((lesson) => {
      const p = progress.get(lesson.id);
      const done = isCompleted(lesson, p);
      let state: LessonState = "locked";
      if (done) state = "completed";
      else if (open && previousDone) state = "available";
      previousDone = previousDone && done;
      return { lesson, state, bestScore: p?.bestScore ?? null };
    });

    const testLesson = topicLessons.find((l) => l.type === "test");
    views.push({
      topic,
      open,
      openedBy,
      lessons: lessonViews,
      completedCount: lessonViews.filter((l) => l.state === "completed").length,
      testPassed: testLesson ? isTestPassed(progress.get(testLesson.id)) : false,
    });
  }
  return views;
}

/** Первый доступный и ещё не завершённый урок в порядке курса. */
export function findNextLesson<T extends TopicInput, L extends LessonInput>(
  views: TopicView<T, L>[],
): { topic: T; lesson: L } | null {
  for (const v of views) {
    const next = v.lessons.find((l) => l.state === "available");
    if (next) return { topic: v.topic, lesson: next.lesson };
  }
  return null;
}

/** XP за завершение урока: растёт только при улучшении лучшего результата, повторы не дают очков. */
export function xpForResult(xpReward: number, score: number, previousBest: number | null): number {
  const prev = Math.max(0, previousBest ?? 0);
  const gain = Math.round((xpReward * Math.max(score, prev)) / 100) - Math.round((xpReward * prev) / 100);
  return Math.max(0, gain);
}
