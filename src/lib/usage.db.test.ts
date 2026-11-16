import { mkdirSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Интеграционный тест квоты AI-разборов на настоящей SQLite-базе (отдельный файл, миграции применяются заново).
 * Главное: счётчик увеличивается атомарно, поэтому параллельные запросы не обходят лимит.
 */
const DIR = ".taste-skill/test-db";
const FILE = `${DIR}/usage-${process.pid}.db`;

let usage: typeof import("./usage");
let dbMod: typeof import("../db");
let schema: typeof import("../db/schema");

beforeAll(async () => {
  mkdirSync(DIR, { recursive: true });
  process.env.TURSO_DATABASE_URL = `file:${FILE}`;
  delete process.env.TURSO_AUTH_TOKEN;
  dbMod = await import("../db");
  schema = await import("../db/schema");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  await migrate(dbMod.db, { migrationsFolder: "./drizzle" });
  usage = await import("./usage");
  for (const id of ["u1", "u2", "u3"]) {
    await dbMod.db.insert(schema.user).values({ id, name: id, email: `${id}@example.test` });
  }
});

afterAll(() => {
  dbMod?.client.close();
  try {
    rmSync(FILE, { force: true });
  } catch {
    // Windows может ещё держать файл: он лежит в .taste-skill (вне git), удалим при следующем запуске
  }
});

const now = new Date("2026-11-16T12:00:00Z");

describe("квота AI-разборов Free: 5 в сутки", () => {
  it("первый разбор открывает окно, пять проходят, шестой отклонён с временем сброса", async () => {
    const left: (number | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await usage.reserveAiExplanation("u1", "free", now);
      expect(r.ok).toBe(true);
      if (r.ok) left.push(r.left);
    }
    expect(left).toEqual([4, 3, 2, 1, 0]);

    const sixth = await usage.reserveAiExplanation("u1", "free", now);
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.resetsAt.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
  });

  it("возврат после сбоя модели освобождает одно место", async () => {
    const usageNow = await usage.getUsage("u1", now);
    expect(usageNow.aiExplanations).toBe(5);
    await usage.releaseAiExplanation("u1", usageNow.windowStart);
    expect((await usage.getUsage("u1", now)).aiExplanations).toBe(4);
    expect((await usage.reserveAiExplanation("u1", "free", now)).ok).toBe(true);
    expect((await usage.reserveAiExplanation("u1", "free", now)).ok).toBe(false);
  });

  it("параллельные запросы не обходят лимит: из восьми проходят ровно пять", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => usage.reserveAiExplanation("u2", "free", now)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(3);
    expect((await usage.getUsage("u2", now)).aiExplanations).toBe(5);
  });

  it("возврат не уходит в минус", async () => {
    const u = await usage.getUsage("u2", now);
    for (let i = 0; i < 8; i++) await usage.releaseAiExplanation("u2", u.windowStart);
    expect((await usage.getUsage("u2", now)).aiExplanations).toBe(0);
  });

  it("через 24 часа окно сбрасывается: счётчик начинается заново", async () => {
    const later = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 1000);
    expect((await usage.getUsage("u1", later)).aiExplanations).toBe(0);
    const r = await usage.reserveAiExplanation("u1", "free", later);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.left).toBe(4);
  });

  it("PRO без ограничений: ничего не резервируется", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await usage.reserveAiExplanation("u3", "pro", now);
      expect(r).toEqual({ ok: true, windowStart: null, left: null });
    }
    expect((await usage.getUsage("u3", now)).aiExplanations).toBe(0);
  });
});

describe("время практики и квота делят одно окно", () => {
  it("практика в уже открытом окне прибавляется, без окна создаёт новое", async () => {
    const t = new Date("2026-11-20T09:00:00Z");
    // окна нет: запрос ничего не обновит, окно создаст finishPracticeCharge
    const first = await dbMod.db.batch([usage.practiceChargeQuery("u3", 30, t)]);
    expect(await usage.finishPracticeCharge("u3", first[0] as { practiceSeconds: number }[], 30, t)).toBe(30);
    // окно есть: секунды прибавляются
    const second = await dbMod.db.batch([usage.practiceChargeQuery("u3", 45, new Date(t.getTime() + 1000))]);
    expect(await usage.finishPracticeCharge("u3", second[0] as { practiceSeconds: number }[], 45, t)).toBe(75);
    // AI-разбор в том же окне не создаёт второго
    const r = await usage.reserveAiExplanation("u3", "free", new Date(t.getTime() + 2000));
    expect(r.ok).toBe(true);
    const u = await usage.getUsage("u3", new Date(t.getTime() + 3000));
    expect(u.practiceSeconds).toBe(75);
    expect(u.aiExplanations).toBe(1);
  });
});
