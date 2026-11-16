"use server";

import { and, count, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tagLabel } from "@/content/tags";
import { db } from "@/db";
import {
  attempts,
  chatConversations,
  chatMessages,
  dailyUsage,
  ieltsSubmissions,
  lessonProgress,
  mistakes,
  phraseFavorites,
  profiles,
  subscriptions,
  user as userTable,
  userStats,
  weeklyReports,
  xpEvents,
} from "@/db/schema";
import { DELETE_CONFIRM_WORD } from "@/lib/account";
import { auth, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { generateJson, isAiConfigured } from "@/lib/ai/client";
import { aiErrorMessage } from "@/lib/ai/errors";
import { buildWeeklyReportPrompt, weeklyReportResponseSchema, weeklyReportSchema, type WeeklyFacts, type WeeklyReport } from "@/lib/ai/tools";
import { aiFailure, checkPro } from "@/lib/pro-guard";
import { createLimiter } from "@/lib/rate-limit";
import { getAccount, requireUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { effectiveStreak, localDate, weekStart } from "@/lib/streak";

type Result = { ok: true } | { ok: false; error: string };

/* ───────────── Профиль ───────────── */

const profileInput = z.object({
  name: z.string().trim().min(1, "Введите имя").max(60, "Имя не длиннее 60 символов"),
  goal: z.enum(["general", "ielts"]),
  level: z.enum(["A1", "A2", "B1", "B2", "C1"]).nullable(),
  dailyGoalMinutes: z.number().int().min(5).max(120),
});

export async function updateProfile(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const { name, goal, level, dailyGoalMinutes } = parsed.data;

  await db.update(profiles).set({ goal, level, dailyGoalMinutes, updatedAt: new Date() }).where(eq(profiles.userId, user.id));
  // Через better-auth, чтобы обновилась и подписанная копия сессии в cookie: иначе старое имя держалось бы до пяти минут.
  try {
    await auth.api.updateUser({ body: { name }, headers: await headers() });
  } catch {
    await db.update(userTable).set({ name }).where(eq(userTable.id, user.id));
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/* ───────────── Пароль ───────────── */

const passwordLimiter = createLimiter({ max: 5, windowMs: 10 * 60_000 });
const passwordInput = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль").max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Новый пароль не короче ${MIN_PASSWORD_LENGTH} символов`).max(128, "Пароль слишком длинный"),
});

export async function changePassword(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = passwordInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  if (parsed.data.currentPassword === parsed.data.newPassword) return { ok: false, error: "Новый пароль совпадает с текущим" };
  if (!passwordLimiter.check(user.id).ok) return { ok: false, error: "Слишком много попыток. Попробуйте через несколько минут." };

  try {
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Текущий пароль неверен" };
  }
}

/* ───────────── Удаление аккаунта ───────────── */

const deleteLimiter = createLimiter({ max: 5, windowMs: 10 * 60_000 });
const deleteInput = z.object({ password: z.string().min(1).max(200), confirm: z.literal(DELETE_CONFIRM_WORD) });

/**
 * Полное удаление аккаунта и всех данных. Сначала проверяется пароль, затем отменяется платная подписка
 * (если отменить не удалось, аккаунт не удаляется: иначе списания продолжились бы без владельца).
 */
export async function deleteAccount(raw: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = deleteInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `Введите слово ${DELETE_CONFIRM_WORD} и пароль` };
  if (!deleteLimiter.check(user.id).ok) return { ok: false, error: "Слишком много попыток. Попробуйте через несколько минут." };

  try {
    await auth.api.verifyPassword({ body: { password: parsed.data.password }, headers: await headers() });
  } catch {
    return { ok: false, error: "Пароль неверен" };
  }

  const { subscription } = await getAccount(user.id);
  if (subscription.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(subscription.status)) {
    const stripe = getStripe();
    if (!stripe) return { ok: false, error: "Не удалось отменить подписку: оплата не настроена. Обратитесь в поддержку." };
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "resource_missing") {
        console.error("[stripe] отмена при удалении аккаунта:", err instanceof Error ? err.message : err);
        return { ok: false, error: "Не удалось отменить подписку, аккаунт не удалён. Попробуйте ещё раз или отмените подписку на странице «Подписка»." };
      }
    }
  }

  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  // Явное удаление по таблицам: не полагаемся на каскады, которые SQLite выполняет только при включённых внешних ключах.
  const id = user.id;
  await db.batch([
    db.delete(weeklyReports).where(eq(weeklyReports.userId, id)),
    db.delete(xpEvents).where(eq(xpEvents.userId, id)),
    db.delete(ieltsSubmissions).where(eq(ieltsSubmissions.userId, id)),
    db.delete(chatMessages).where(eq(chatMessages.userId, id)),
    db.delete(chatConversations).where(eq(chatConversations.userId, id)),
    db.delete(phraseFavorites).where(eq(phraseFavorites.userId, id)),
    db.delete(dailyUsage).where(eq(dailyUsage.userId, id)),
    db.delete(mistakes).where(eq(mistakes.userId, id)),
    db.delete(attempts).where(eq(attempts.userId, id)),
    db.delete(lessonProgress).where(eq(lessonProgress.userId, id)),
    db.delete(subscriptions).where(eq(subscriptions.userId, id)),
    db.delete(userStats).where(eq(userStats.userId, id)),
    db.delete(profiles).where(eq(profiles.userId, id)),
    db.delete(userTable).where(eq(userTable.id, id)),
  ]);
  redirect("/?account=deleted");
}

/* ───────────── Еженедельный отчёт (PRO) ───────────── */

const reportLimiter = createLimiter({ max: 3, windowMs: 60 * 60_000 });
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportResponse =
  | { ok: true; report: WeeklyReport; weekStart: string; generatedAtMs: number; cached: boolean }
  | { ok: false; code: "auth" | "pro" | "rate" | "unavailable" | "busy" | "error"; error: string };

async function collectFacts(userId: string, now: Date, timeZone: string, goal: string, level: string | null, streak: number): Promise<WeeklyFacts> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [att, newMist, resolved, xp, lessons, ielts] = await Promise.all([
    db
      .select({ createdAt: attempts.createdAt, timeMs: attempts.timeMs, isCorrect: attempts.isCorrect })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), gte(attempts.createdAt, since))),
    db.select({ tag: mistakes.tag, n: count() }).from(mistakes).where(and(eq(mistakes.userId, userId), gte(mistakes.createdAt, since))).groupBy(mistakes.tag),
    db.select({ n: count() }).from(mistakes).where(and(eq(mistakes.userId, userId), gte(mistakes.lastReviewedAt, since), sql`${mistakes.resolvedAt} is not null`)),
    db.select({ n: sql<number>`coalesce(sum(${xpEvents.amount}), 0)` }).from(xpEvents).where(and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, since))),
    db.select({ n: count() }).from(lessonProgress).where(and(eq(lessonProgress.userId, userId), gte(lessonProgress.completedAt, since))),
    db.select({ n: count() }).from(ieltsSubmissions).where(and(eq(ieltsSubmissions.userId, userId), gte(ieltsSubmissions.createdAt, since))),
  ]);
  const days = new Set(att.map((a) => localDate(a.createdAt, timeZone)));
  return {
    minutes: Math.round(att.reduce((n, a) => n + (a.timeMs ?? 0), 0) / 60000),
    answers: att.length,
    accuracy: att.length === 0 ? null : Math.round((att.filter((a) => a.isCorrect).length / att.length) * 100),
    lessonsCompleted: Number(lessons[0]?.n ?? 0),
    xp: Number(xp[0]?.n ?? 0),
    streak,
    activeDays: days.size,
    newMistakes: newMist.map((m) => ({ topic: tagLabel(m.tag), count: Number(m.n) })).sort((a, b) => b.count - a.count).slice(0, 5),
    mistakesResolved: Number(resolved[0]?.n ?? 0),
    ieltsChecks: Number(ielts[0]?.n ?? 0),
    goal: goal === "ielts" ? "подготовка к IELTS" : "общий английский",
    level,
  };
}

/** Отчёт за неделю: из кеша, если он уже есть; refresh пересчитывает (не чаще трёх раз в час). */
export async function getWeeklyReport(raw: unknown): Promise<ReportResponse> {
  const access = await checkPro();
  if (!access.ok) return access;
  const refresh = z.object({ refresh: z.boolean().optional() }).safeParse(raw).data?.refresh === true;

  const now = new Date();
  const tz = access.profile.timezone;
  const week = weekStart(localDate(now, tz));
  const userId = access.userId;

  if (!refresh) {
    const [cached] = await db.select().from(weeklyReports).where(and(eq(weeklyReports.userId, userId), eq(weeklyReports.weekStart, week)));
    const ok = cached && weeklyReportSchema.safeParse(cached.payload);
    if (cached && ok && ok.success) return { ok: true, report: ok.data, weekStart: week, generatedAtMs: cached.createdAt.getTime(), cached: true };
  }

  if (!reportLimiter.check(userId).ok) return { ok: false, code: "rate", error: "Отчёт можно пересчитывать не чаще трёх раз в час." };
  if (!isAiConfigured()) return { ok: false, code: "unavailable", error: aiErrorMessage("unavailable") };

  try {
    const { stats } = await getAccount(userId);
    const facts = await collectFacts(userId, now, tz, access.profile.goal, access.profile.level, effectiveStreak(stats, localDate(now, tz)));
    const { system, prompt } = buildWeeklyReportPrompt(facts);
    const { data, model } = await generateJson({
      tier: "fast",
      system,
      prompt,
      schema: weeklyReportResponseSchema,
      validate: weeklyReportSchema,
      temperature: 0.4,
      maxOutputTokens: 1500,
      timeoutMs: 25_000,
      deadlineMs: 50_000,
      retriesPerModel: 2,
    });
    await db
      .insert(weeklyReports)
      .values({ userId, weekStart: week, payload: data, model, createdAt: now })
      .onConflictDoUpdate({ target: [weeklyReports.userId, weeklyReports.weekStart], set: { payload: data, model, createdAt: now } });
    return { ok: true, report: data, weekStart: week, generatedAtMs: now.getTime(), cached: false };
  } catch (err) {
    return { ok: false, ...aiFailure("getWeeklyReport", err) };
  }
}
