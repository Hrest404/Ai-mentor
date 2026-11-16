import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, lessonProgress } from "@/db/schema";
import { courseLessons, courseTopics } from "./course-index";
import { computeCourseState, findNextLesson, type ProgressRow } from "./course-state";
import type { Level } from "@/content/types";
import { startOfLocalDay } from "./streak";

/** Прогресс пользователя по урокам одним запросом. */
export async function loadProgress(userId: string): Promise<Map<string, ProgressRow>> {
  const rows = await db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
      score: lessonProgress.score,
      bestScore: lessonProgress.bestScore,
    })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));
  return new Map(rows.map((r) => [r.lessonId, { status: r.status, score: r.score, bestScore: r.bestScore }]));
}

/** Состояние всего курса (темы, уроки, замки) и следующий урок. */
export async function loadCourseView(userId: string, level: Level | null) {
  const progress = await loadProgress(userId);
  const views = computeCourseState(courseTopics, courseLessons, progress, level);
  return { progress, views, next: findNextLesson(views) };
}

/** Минуты практики сегодня (по локальным суткам пользователя): сумма времени ответов. */
export async function practiceMinutesToday(userId: string, timezone: string, now = new Date()): Promise<number> {
  const since = startOfLocalDay(now, timezone);
  const [row] = await db
    .select({ ms: sql<number>`coalesce(sum(${attempts.timeMs}), 0)` })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), gte(attempts.createdAt, since)));
  return Math.round(Number(row?.ms ?? 0) / 60000);
}
