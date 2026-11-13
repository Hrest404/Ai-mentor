/**
 * Сид учебного контента. Идемпотентный: строки вставляются по стабильным id,
 * при повторном запуске обновляются, дубликаты не появляются, прогресс пользователей не трогается.
 * Запуск: npm run db:seed
 */
import { count, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { buildCourse, TOPICS } from "../content/course";
import { SITUATIONS } from "../content/phrasebook";
import { theorySchema, validateExercise } from "../content/types";
import { client, db } from "./index";
import { exercises, lessons, phrases, phraseSituations, topics } from "./schema";

/** SET-часть для upsert: все колонки, кроме id, берутся из вставляемой строки. */
function excludedSet(table: SQLiteTable): Record<string, SQL> {
  const set: Record<string, SQL> = {};
  for (const [key, col] of Object.entries(getTableColumns(table))) {
    if (key !== "id") set[key] = sql.raw(`excluded."${col.name}"`);
  }
  return set;
}

function chunk<T>(rows: T[], size = 50): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function main() {
  const course = buildCourse();

  // Битый контент в базу не пускаем.
  const problems: string[] = [];
  for (const t of TOPICS) {
    const r = theorySchema.safeParse(t.theory);
    if (!r.success) problems.push(`${t.id}: теория не проходит схему`);
  }
  for (const e of course.exercises) {
    for (const p of validateExercise({ kind: e.kind, tag: e.tag, ...e.payload })) problems.push(`${e.id}: ${p}`);
  }
  if (problems.length) {
    console.error("Контент содержит ошибки, сид остановлен:\n" + problems.join("\n"));
    process.exit(1);
  }

  const situationRows = SITUATIONS.map((s, i) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    orderIndex: i + 1,
    isFree: s.isFree,
  }));
  const phraseRows = SITUATIONS.flatMap((s) =>
    s.phrases.map(([en, ru, note], i) => ({
      id: `${s.id}-${i + 1}`,
      situationId: s.id,
      orderIndex: i + 1,
      en,
      ru,
      note: note ?? null,
    })),
  );

  // Порядок важен из-за внешних ключей: темы → уроки → упражнения.
  await db.insert(topics).values(course.topics).onConflictDoUpdate({ target: topics.id, set: excludedSet(topics) });
  await db.insert(lessons).values(course.lessons).onConflictDoUpdate({ target: lessons.id, set: excludedSet(lessons) });
  for (const part of chunk(course.exercises)) {
    await db.insert(exercises).values(part).onConflictDoUpdate({ target: exercises.id, set: excludedSet(exercises) });
  }
  await db
    .insert(phraseSituations)
    .values(situationRows)
    .onConflictDoUpdate({ target: phraseSituations.id, set: excludedSet(phraseSituations) });
  for (const part of chunk(phraseRows)) {
    await db.insert(phrases).values(part).onConflictDoUpdate({ target: phrases.id, set: excludedSet(phrases) });
  }

  const n = async (t: SQLiteTable) => (await db.select({ c: count() }).from(t))[0].c;
  console.log("В базе:", {
    topics: await n(topics),
    lessons: await n(lessons),
    exercises: await n(exercises),
    situations: await n(phraseSituations),
    phrases: await n(phrases),
  });
  console.log("В контенте:", {
    topics: course.topics.length,
    lessons: course.lessons.length,
    exercises: course.exercises.length,
    situations: situationRows.length,
    phrases: phraseRows.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.close());
