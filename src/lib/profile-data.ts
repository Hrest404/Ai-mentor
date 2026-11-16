import "server-only";
import { and, count, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, chatMessages, ieltsSubmissions, lessonProgress, mistakes, phraseFavorites, xpEvents } from "@/db/schema";
import { courseLessons, courseTopics, getLesson } from "./course-index";
import { PASS_SCORE } from "./course-state";
import {
  accuracyByTopic,
  buildActivity,
  buildXpSeries,
  computeAchievements,
  type Achievement,
  type DayActivity,
  type TopicAccuracy,
  type XpDay,
} from "./stats";

export interface ProfileData {
  activity: DayActivity[];
  xpSeries: XpDay[];
  topics: (TopicAccuracy & { title: string })[];
  achievements: Achievement[];
  totals: { answers: number; correct: number; lessonsCompleted: number; minutes: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Всё для вкладок статистики и достижений. Окно активности: 30 суток. */
export async function loadProfileData(
  userId: string,
  timeZone: string,
  stats: { xp: number; longestStreak: number },
  now = new Date(),
): Promise<ProfileData> {
  const since = new Date(now.getTime() - 31 * DAY_MS);
  const num = async <T extends { n: number }>(q: Promise<T[]>) => Number((await q)[0]?.n ?? 0);

  const [allAttempts, recent, xpRows, progress, resolved, ielts, favorites, chat] = await Promise.all([
    db.select({ lessonId: attempts.lessonId, isCorrect: attempts.isCorrect }).from(attempts).where(eq(attempts.userId, userId)),
    db
      .select({ createdAt: attempts.createdAt, timeMs: attempts.timeMs, isCorrect: attempts.isCorrect })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), gte(attempts.createdAt, since))),
    db.select({ createdAt: xpEvents.createdAt, amount: xpEvents.amount }).from(xpEvents).where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since))),
    db
      .select({ lessonId: lessonProgress.lessonId, status: lessonProgress.status, bestScore: lessonProgress.bestScore })
      .from(lessonProgress)
      .where(eq(lessonProgress.userId, userId)),
    num(db.select({ n: count() }).from(mistakes).where(and(eq(mistakes.userId, userId), isNotNull(mistakes.resolvedAt)))),
    num(db.select({ n: count() }).from(ieltsSubmissions).where(eq(ieltsSubmissions.userId, userId))),
    num(db.select({ n: count() }).from(phraseFavorites).where(eq(phraseFavorites.userId, userId))),
    num(db.select({ n: count() }).from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user")))),
  ]);

  const completed = progress.filter((p) => p.status === "completed");
  const testIds = new Map(courseLessons.filter((l) => l.type === "test").map((l) => [l.id, l.topicId]));
  const topicsCompleted = new Set(completed.filter((p) => testIds.has(p.lessonId) && (p.bestScore ?? 0) >= PASS_SCORE).map((p) => testIds.get(p.lessonId))).size;

  const activity = buildActivity(recent, now, timeZone);
  const topicTitle = new Map(courseTopics.map((t) => [t.id, t.titleRu]));
  const topics = accuracyByTopic(allAttempts, (lessonId) => getLesson(lessonId)?.topicId)
    .map((t) => ({ ...t, title: topicTitle.get(t.topicId) ?? t.topicId }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const correctAnswers = allAttempts.filter((a) => a.isCorrect).length;
  return {
    activity,
    xpSeries: buildXpSeries(xpRows, now, timeZone),
    topics,
    achievements: computeAchievements({
      lessonsCompleted: completed.length,
      topicsCompleted,
      totalAnswers: allAttempts.length,
      correctAnswers,
      longestStreak: stats.longestStreak,
      xp: stats.xp,
      mistakesResolved: resolved,
      ieltsChecks: ielts,
      favoritePhrases: favorites,
      chatMessages: chat,
    }),
    totals: {
      answers: allAttempts.length,
      correct: correctAnswers,
      lessonsCompleted: completed.length,
      minutes: Math.round(activity.reduce((n, d) => n + d.minutes, 0)),
    },
  };
}
