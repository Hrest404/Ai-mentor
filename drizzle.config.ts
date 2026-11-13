import { defineConfig } from "drizzle-kit";

// Node 22: подхватываем .env.local сами (drizzle-kit его не читает). Уже заданные переменные не перезаписываются.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* файла нет, значит работаем с локальной базой */
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
});
