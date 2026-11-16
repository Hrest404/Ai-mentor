"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { phraseFavorites } from "@/db/schema";
import { findPhrase, situationAllowed } from "@/lib/phrasebook";
import { createLimiter } from "@/lib/rate-limit";
import { getAccount, requireUser } from "@/lib/session";

// Защита от автоматических щелчков: избранное меняют вручную, десятками в минуту.
const limiter = createLimiter({ max: 60, windowMs: 60_000 });
const input = z.object({ phraseId: z.string().max(80), favorite: z.boolean() });

export type FavoriteResponse = { ok: true; favorite: boolean } | { ok: false; error: string };

/** Добавляет фразу в избранное или убирает её. Закрытые тарифом ситуации недоступны и по прямому запросу. */
export async function setFavorite(raw: unknown): Promise<FavoriteResponse> {
  const user = await requireUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Некорректный запрос" };

  const found = findPhrase(parsed.data.phraseId);
  if (!found) return { ok: false, error: "Фраза не найдена" };

  const { plan } = await getAccount(user.id);
  if (!situationAllowed(found.situation, plan)) return { ok: false, error: "Эта ситуация доступна в PRO" };

  if (!limiter.check(user.id).ok) return { ok: false, error: "Слишком часто. Подождите немного." };

  if (parsed.data.favorite) {
    await db.insert(phraseFavorites).values({ userId: user.id, phraseId: found.phrase.id }).onConflictDoNothing();
  } else {
    await db
      .delete(phraseFavorites)
      .where(and(eq(phraseFavorites.userId, user.id), eq(phraseFavorites.phraseId, found.phrase.id)));
  }
  return { ok: true, favorite: parsed.data.favorite };
}
