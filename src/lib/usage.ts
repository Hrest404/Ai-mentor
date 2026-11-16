import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { dailyUsage } from "@/db/schema";
import { WINDOW_MS, windowResetsAt } from "./limits";

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
