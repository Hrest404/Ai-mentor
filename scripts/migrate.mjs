// Применяет миграции из ./drizzle и печатает причину сбоя понятным текстом.
// Нужен для сборки на хостинге: drizzle-kit в логах CI прячет текст ошибки за индикатором выполнения.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
if (process.env.VERCEL && url.startsWith("file:")) {
  console.error("TURSO_DATABASE_URL не задан или указывает на локальный файл: на хостинге нужна база libsql://…");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(`Миграции применены (${url.startsWith("file:") ? "локальный файл" : new URL(url.replace("libsql:", "https:")).host}).`);
} catch (err) {
  console.error("Миграции не применились:", err instanceof Error ? `${err.message}${err.cause ? ` | причина: ${String(err.cause)}` : ""}` : err);
  process.exit(1);
} finally {
  client.close();
}
