"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { levelFromScore, scorePlacement } from "@/content/placement";
import type { Level } from "@/content/types";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getAccount, requireUser } from "@/lib/session";
import { isValidTimeZone } from "@/lib/streak";

const input = z.object({
  goal: z.enum(["general", "ielts"]),
  /** null: пользователь пропустил тест и начинает с нуля. */
  answers: z.record(z.string().max(10), z.string().max(60)).nullable(),
  /** Часовой пояс браузера (IANA), по нему считаются сутки и серия. */
  tz: z.string().max(64).optional(),
});

export async function completeOnboarding(raw: unknown): Promise<{ level: Level; score: number | null }> {
  const user = await requireUser();
  const { goal, answers, tz } = input.parse(raw);

  const score = answers ? scorePlacement(answers) : null;
  const level = score === null ? "A1" : levelFromScore(score);

  await getAccount(user.id); // гарантирует, что строка профиля существует
  await db
    .update(profiles)
    .set({ goal, level, onboardedAt: new Date(), ...(tz && isValidTimeZone(tz) ? { timezone: tz } : {}) })
    .where(eq(profiles.userId, user.id));

  // Без revalidatePath: иначе страница онбординга сразу перенаправит в кабинет и экран с результатом не покажется.
  return { level, score };
}
