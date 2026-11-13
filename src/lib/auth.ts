import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, profiles, session, subscriptions, user, userStats, verification } from "@/db/schema";

export const MIN_PASSWORD_LENGTH = 8;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 дней
    updateAge: 60 * 60 * 24, // продлеваем не чаще раза в сутки
    // Подписанная копия сессии в cookie на 5 минут: проверка входа без запроса в базу.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        // Каждому новому пользователю: профиль, статистика и тариф Free.
        after: async (created) => {
          await db.insert(profiles).values({ userId: created.id }).onConflictDoNothing();
          await db.insert(userStats).values({ userId: created.id }).onConflictDoNothing();
          await db.insert(subscriptions).values({ userId: created.id, plan: "free" }).onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()], // должен быть последним
});
