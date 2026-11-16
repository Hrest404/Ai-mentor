"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { db } from "@/db";
import { attempts, lessonProgress, mistakes, profiles, userStats } from "@/db/schema";
import { verifyLessonToken } from "@/lib/access-token";
import { answerToText, checkAnswer } from "@/lib/answers";
import { exercisesOfLesson, getExercise, getLesson, getTopic, lessonsOfTopic, nextTopic } from "@/lib/course-index";
import { PASS_SCORE, xpForResult } from "@/lib/course-state";
import { chargeSeconds, isOverGrace, isPracticeExhausted, lessonAllowedForPlan } from "@/lib/limits";
import { loadCourseView } from "@/lib/progress";
import { getAccount, requireUser } from "@/lib/session";
import { isValidTimeZone, localDate, nextStreak } from "@/lib/streak";
import { finishPracticeCharge, getUsage, practiceChargeQuery } from "@/lib/usage";

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

const answerSchema = z.union([
  z.string().max(500),
  z.array(z.string().max(100)).max(40),
  z.record(z.string().max(100), z.string().max(100)),
]);

const checkInput = z.object({
  /** Токен доступа, выданный страницей урока после проверки тарифа, замков и лимитов. */
  token: z.string().max(2000),
  lessonId: z.string().max(100),
  exerciseId: z.string().max(120),
  answer: answerSchema,
  timeMs: z.number().int().min(0).max(10 * 60 * 1000).optional(),
});

export type CheckResponse =
  | {
      ok: true;
      attemptId: string;
      correct: boolean;
      correctAnswer: string;
      explanation: string;
      /** Лимит практики Free исчерпан: этот урок можно закончить, новый уже нет. */
      limitReached: boolean;
    }
  | { ok: false; error: string; code?: "limit" | "expired" | "forbidden"; resetsAtMs?: number };

/**
 * Проверяет один ответ на сервере и записывает попытку. Неверный ответ попадает в «Мои ошибки».
 * Ответы берутся из кода курса, поэтому проверка стоит одной записи в базу.
 */
export async function checkExercise(raw: unknown): Promise<CheckResponse> {
  const user = await requireUser();
  const parsed = checkInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };
  const { token, lessonId, exerciseId, answer, timeMs } = parsed.data;

  // Замки, пейволл и лимит уже проверены при входе в урок: без подписанного токена ответ не принимается.
  const access = verifyLessonToken(token, { userId: user.id, lessonId });
  if (!access.ok) {
    return access.reason === "expired"
      ? { ok: false, code: "expired", error: "Сессия урока устарела. Обновите страницу и начните урок заново." }
      : { ok: false, code: "forbidden", error: "Нет доступа к этому уроку" };
  }
  const plan = access.plan;

  const ex = getExercise(exerciseId);
  const lesson = getLesson(lessonId);
  if (!ex || !lesson || ex.lessonId !== lessonId || lesson.type === "theory") {
    return { ok: false, error: "Упражнение не найдено" };
  }
  if (!lessonAllowedForPlan(plan, lesson.globalOrder)) {
    return { ok: false, code: "forbidden", error: "Урок доступен в PRO" };
  }

  const result = checkAnswer(ex.def, answer);
  const attemptId = crypto.randomUUID();
  const now = new Date();
  const charge = chargeSeconds(timeMs);

  const queries: Batch = [
    // Время практики: прибавляем к действующему суточному окну и сразу читаем итог.
    practiceChargeQuery(user.id, charge, now),
    db.insert(attempts).values({
      id: attemptId,
      userId: user.id,
      exerciseId,
      lessonId,
      answer: answerToText(answer).slice(0, 500),
      isCorrect: result.correct,
      timeMs: timeMs ?? null,
    }),
  ];
  if (!result.correct) {
    queries.push(
      db
        .insert(mistakes)
        .values({
          userId: user.id,
          exerciseId,
          topicId: lesson.topicId,
          tag: ex.def.tag,
          lastAnswer: answerToText(answer).slice(0, 500),
          dueAt: now,
        })
        .onConflictDoUpdate({
          target: [mistakes.userId, mistakes.exerciseId],
          set: {
            timesWrong: sql`${mistakes.timesWrong} + 1`,
            lastAnswer: answerToText(answer).slice(0, 500),
            box: 0,
            dueAt: now,
            resolvedAt: null,
          },
        }),
    );
  }
  const results = (await db.batch(queries)) as unknown[];

  // Первый ответ в новом окне: окна ещё нет, создаём его, отсчёт 24 часов идёт отсюда.
  const used = await finishPracticeCharge(user.id, results[0] as { practiceSeconds: number }[], charge, now);

  if (isOverGrace(plan, used)) {
    const usage = await getUsage(user.id);
    return { ok: false, code: "limit", error: "Лимит практики на сегодня исчерпан", resetsAtMs: usage.resetsAt?.getTime() };
  }
  return {
    ok: true,
    attemptId,
    correct: result.correct,
    correctAnswer: result.correctAnswer,
    explanation: ex.def.explanation,
    limitReached: isPracticeExhausted(plan, used),
  };
}

/** Серия и XP после активности: запросы для общего batch. */
async function activityQueries(opts: {
  userId: string;
  xpGain: number;
  tz: string | undefined;
  profileTimezone: string;
}): Promise<{ queries: BatchItem<"sqlite">[]; streak: number; xp: number }> {
  const { userId, xpGain, tz } = opts;
  const timezone = tz && isValidTimeZone(tz) ? tz : opts.profileTimezone;
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
  const current = stats ?? { xp: 0, streak: 0, longestStreak: 0, lastActiveDate: null, streakFreezes: 0 };
  const today = localDate(new Date(), timezone);
  const next = nextStreak(current, today);
  const xp = current.xp + xpGain;

  const queries: BatchItem<"sqlite">[] = [
    db
      .insert(userStats)
      .values({ userId, xp, streak: next.streak, longestStreak: next.longestStreak, lastActiveDate: next.lastActiveDate })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { xp, streak: next.streak, longestStreak: next.longestStreak, lastActiveDate: next.lastActiveDate },
      }),
  ];
  if (timezone !== opts.profileTimezone) {
    queries.push(db.update(profiles).set({ timezone }).where(eq(profiles.userId, userId)));
  }
  return { queries, streak: next.streak, xp };
}

const finishInput = z.object({
  lessonId: z.string().max(100),
  attemptIds: z.array(z.string().max(60)).max(60),
  tz: z.string().max(64).optional(),
});

export type FinishResponse =
  | {
      ok: true;
      score: number;
      correctCount: number;
      total: number;
      /** Для итогового теста: набран ли проходной балл. Для обычных уроков всегда true. */
      passed: boolean;
      xpGain: number;
      streak: number;
      totalXp: number;
      unlockedTopic: string | null;
      nextLessonId: string | null;
    }
  | { ok: false; error: string };

/** Завершает урок. Результат считается по записанным на сервере попыткам, а не по словам браузера. */
export async function finishLesson(raw: unknown): Promise<FinishResponse> {
  const user = await requireUser();
  const parsed = finishInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };
  const { lessonId, attemptIds, tz } = parsed.data;

  const lesson = getLesson(lessonId);
  if (!lesson || lesson.type === "theory") return { ok: false, error: "Урок не найден" };

  const { profile, plan } = await getAccount(user.id);
  if (!lessonAllowedForPlan(plan, lesson.globalOrder)) return { ok: false, error: "Урок доступен в PRO" };
  const { progress, views } = await loadCourseView(user.id, profile.level);
  const topicView = views.find((v) => v.topic.id === lesson.topicId);
  const lessonView = topicView?.lessons.find((l) => l.lesson.id === lessonId);
  if (!topicView || !lessonView || lessonView.state === "locked") return { ok: false, error: "Урок пока закрыт" };

  const required = exercisesOfLesson(lessonId);
  const unique = [...new Set(attemptIds)];
  if (unique.length !== required.length) return { ok: false, error: "Не все ответы засчитаны" };

  const rows = await db
    .select({ exerciseId: attempts.exerciseId, isCorrect: attempts.isCorrect })
    .from(attempts)
    .where(and(eq(attempts.userId, user.id), eq(attempts.lessonId, lessonId), inArray(attempts.id, unique)));
  const byExercise = new Map(rows.map((r) => [r.exerciseId, r.isCorrect]));
  if (rows.length !== required.length || !required.every((e) => byExercise.has(e.id))) {
    return { ok: false, error: "Не все ответы засчитаны" };
  }

  const correctCount = required.filter((e) => byExercise.get(e.id)).length;
  const total = required.length;
  const score = Math.round((correctCount / total) * 100);
  const passed = lesson.type === "test" ? score >= PASS_SCORE : true;

  const prev = progress.get(lessonId);
  const prevBest = prev?.bestScore ?? null;
  const wasCompleted = prev?.status === "completed";
  const bestScore = Math.max(prevBest ?? 0, score);
  const status = wasCompleted || passed ? "completed" : "in_progress";
  const xpGain = xpForResult(lesson.xpReward, score, prevBest);

  const activity = await activityQueries({ userId: user.id, xpGain, tz, profileTimezone: profile.timezone });
  const queries: Batch = [
    db
      .insert(lessonProgress)
      .values({
        userId: user.id,
        lessonId,
        status,
        score,
        bestScore,
        completedAt: status === "completed" ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: {
          status,
          score,
          bestScore,
          ...(status === "completed" && !wasCompleted ? { completedAt: new Date() } : {}),
        },
      }),
    ...activity.queries,
  ];
  await db.batch(queries);

  // Тема открывается только что пройденным тестом, если раньше она была закрыта.
  let unlockedTopic: string | null = null;
  if (lesson.type === "test" && passed) {
    const following = nextTopic(lesson.topicId);
    const followingView = views.find((v) => v.topic.id === following?.id);
    if (following && followingView && !followingView.open) unlockedTopic = following.titleRu;
  }

  const nextLesson = passed ? lessonsOfTopic(lesson.topicId).find((l) => l.orderIndex === lesson.orderIndex + 1) : undefined;
  return {
    ok: true,
    score,
    correctCount,
    total,
    passed,
    xpGain,
    streak: activity.streak,
    totalXp: activity.xp,
    unlockedTopic,
    nextLessonId: nextLesson?.id ?? null,
  };
}

const theoryInput = z.object({ lessonId: z.string().max(100), tz: z.string().max(64).optional() });

export type TheoryResponse =
  | { ok: true; xpGain: number; nextLessonId: string | null }
  | { ok: false; error: string };

/** Отмечает теорию прочитанной: открывает уроки темы. */
export async function completeTheory(raw: unknown): Promise<TheoryResponse> {
  const user = await requireUser();
  const parsed = theoryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };
  const { lessonId, tz } = parsed.data;

  const lesson = getLesson(lessonId);
  if (!lesson || lesson.type !== "theory" || !getTopic(lesson.topicId)) return { ok: false, error: "Урок не найден" };

  const { profile, plan } = await getAccount(user.id);
  if (!lessonAllowedForPlan(plan, lesson.globalOrder)) return { ok: false, error: "Урок доступен в PRO" };
  const { progress, views } = await loadCourseView(user.id, profile.level);
  const lessonView = views.find((v) => v.topic.id === lesson.topicId)?.lessons.find((l) => l.lesson.id === lessonId);
  if (!lessonView || lessonView.state === "locked") return { ok: false, error: "Тема пока закрыта" };

  const prev = progress.get(lessonId);
  const xpGain = xpForResult(lesson.xpReward, 100, prev?.bestScore ?? null);
  const activity = await activityQueries({ userId: user.id, xpGain, tz, profileTimezone: profile.timezone });

  const queries: Batch = [
    db
      .insert(lessonProgress)
      .values({ userId: user.id, lessonId, status: "completed", score: 100, bestScore: 100, completedAt: new Date() })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { status: "completed", score: 100, bestScore: 100 },
      }),
    ...activity.queries,
  ];
  await db.batch(queries);

  const next = lessonsOfTopic(lesson.topicId).find((l) => l.orderIndex === lesson.orderIndex + 1);
  return { ok: true, xpGain, nextLessonId: next?.id ?? null };
}
