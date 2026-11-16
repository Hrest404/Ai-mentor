import "server-only";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyUsage } from "@/db/schema";
import { FREE_LIMITS } from "./plans";
import { WINDOW_MS, windowResetsAt, type Plan } from "./limits";

export interface Usage {
  /** Начало активного 24-часового окна; null, если практики в последние сутки не было. */
  windowStart: Date | null;
  practiceSeconds: number;
  aiExplanations: number;
  /** Когда лимит обнулится; null, если окна нет. */
  resetsAt: Date | null;
}

/** Использование лимитов в текущем окне. Истёкшее окно не считается: отсчёт начнётся с первого ответа. */
export async function getUsage(userId: string, now: Date = new Date()): Promise<Usage> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [row] = await db
    .select()
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), gt(dailyUsage.windowStart, since)))
    .orderBy(desc(dailyUsage.windowStart))
    .limit(1);
  if (!row) return { windowStart: null, practiceSeconds: 0, aiExplanations: 0, resetsAt: null };
  return {
    windowStart: row.windowStart,
    practiceSeconds: row.practiceSeconds,
    aiExplanations: row.aiExplanations,
    resetsAt: windowResetsAt(row.windowStart),
  };
}

/**
 * Открывает окно, только если активного ещё нет: один оператор, поэтому одновременные первые запросы
 * не создадут несколько окон. Возвращает true, если окно создано этим вызовом.
 */
async function openWindowIfNone(
  userId: string,
  now: Date,
  init: { practiceSeconds?: number; aiExplanations?: number },
): Promise<boolean> {
  const startSec = Math.floor(now.getTime() / 1000);
  const sinceSec = Math.floor((now.getTime() - WINDOW_MS) / 1000);
  const result = await db.run(sql`
    INSERT INTO daily_usage (id, user_id, window_start, practice_seconds, ai_explanations)
    SELECT ${crypto.randomUUID()}, ${userId}, ${startSec}, ${init.practiceSeconds ?? 0}, ${init.aiExplanations ?? 0}
    WHERE NOT EXISTS (SELECT 1 FROM daily_usage WHERE user_id = ${userId} AND window_start > ${sinceSec})
  `);
  return result.rowsAffected > 0;
}

/**
 * Запрос для batch: прибавляет секунды практики к действующему суточному окну и возвращает итог.
 * Если окна нет (первый ответ за сутки), результат пуст, и окно создаёт finishPracticeCharge.
 */
export function practiceChargeQuery(userId: string, seconds: number, now: Date) {
  return db
    .update(dailyUsage)
    .set({ practiceSeconds: sql`${dailyUsage.practiceSeconds} + ${seconds}` })
    .where(and(eq(dailyUsage.userId, userId), gt(dailyUsage.windowStart, new Date(now.getTime() - WINDOW_MS))))
    .returning({ practiceSeconds: dailyUsage.practiceSeconds });
}

/** Разбирает результат practiceChargeQuery; при отсутствии окна создаёт его. Возвращает использованные секунды. */
export async function finishPracticeCharge(
  userId: string,
  updated: { practiceSeconds: number }[],
  seconds: number,
  now: Date,
): Promise<number> {
  const used = updated[0]?.practiceSeconds;
  if (used !== undefined) return used;
  if (await openWindowIfNone(userId, now, { practiceSeconds: seconds })) return seconds;
  // Окно успел открыть параллельный запрос: добавляем секунды к нему.
  const [again] = await practiceChargeQuery(userId, seconds, now);
  return again?.practiceSeconds ?? seconds;
}

export type AiReservation =
  | { ok: true; windowStart: Date | null; left: number | null }
  | { ok: false; resetsAt: Date };

/**
 * Резервирует один AI-разбор в суточном окне. Free: не больше FREE_LIMITS.aiExplanationsPerDay,
 * проверка и увеличение счётчика одним запросом, поэтому параллельные запросы лимит не обойдут.
 * PRO без ограничений: ничего не резервируется.
 */
export async function reserveAiExplanation(userId: string, plan: Plan, now: Date = new Date()): Promise<AiReservation> {
  if (plan === "pro") return { ok: true, windowStart: null, left: null };
  const limit = FREE_LIMITS.aiExplanationsPerDay;
  const since = new Date(now.getTime() - WINDOW_MS);

  // Несколько попыток: гонка за открытие окна проигрывается не больше одного раза.
  for (let attempt = 0; attempt < 3; attempt++) {
    const [updated] = await db
      .update(dailyUsage)
      .set({ aiExplanations: sql`${dailyUsage.aiExplanations} + 1` })
      .where(and(eq(dailyUsage.userId, userId), gt(dailyUsage.windowStart, since), lt(dailyUsage.aiExplanations, limit)))
      .returning({ windowStart: dailyUsage.windowStart, aiExplanations: dailyUsage.aiExplanations });
    if (updated) return { ok: true, windowStart: updated.windowStart, left: limit - updated.aiExplanations };

    // Окно есть, но лимит выбран: отказ.
    const usage = await getUsage(userId, now);
    if (usage.windowStart && usage.resetsAt) return { ok: false, resetsAt: usage.resetsAt };

    // Окна нет: этот разбор открывает новые сутки.
    if (await openWindowIfNone(userId, now, { aiExplanations: 1 })) {
      return { ok: true, windowStart: new Date(Math.floor(now.getTime() / 1000) * 1000), left: limit - 1 };
    }
  }
  const usage = await getUsage(userId, now);
  return { ok: false, resetsAt: usage.resetsAt ?? new Date(now.getTime() + WINDOW_MS) };
}

/** Возвращает зарезервированный разбор, если модель не ответила: сбой не должен тратить лимит. */
export async function releaseAiExplanation(userId: string, windowStart: Date | null): Promise<void> {
  if (!windowStart) return;
  await db
    .update(dailyUsage)
    .set({ aiExplanations: sql`max(${dailyUsage.aiExplanations} - 1, 0)` })
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.windowStart, windowStart)));
}
