import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { profiles, subscriptions, userStats } from "@/db/schema";
import { auth } from "./auth";

/** Сессия текущего запроса (или null). Кешируется на время одного рендера. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Пользователь или редирект на вход. Настоящая проверка доступа: middleware смотрит только на наличие cookie. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** Профиль, статистика и тариф. Строки создаются при регистрации; на случай сбоя досоздаём. */
export const getAccount = cache(async (userId: string) => {
  const load = () =>
    Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
      db.query.userStats.findFirst({ where: eq(userStats.userId, userId) }),
      db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) }),
    ]);

  let [profile, stats, subscription] = await load();
  if (!profile || !stats || !subscription) {
    await db.insert(profiles).values({ userId }).onConflictDoNothing();
    await db.insert(userStats).values({ userId }).onConflictDoNothing();
    await db.insert(subscriptions).values({ userId, plan: "free" }).onConflictDoNothing();
    [profile, stats, subscription] = await load();
  }
  return { profile: profile!, stats: stats!, subscription: subscription! };
});
