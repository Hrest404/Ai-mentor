import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date());

/* ───────────── Авторизация (better-auth) ─────────────
   Имена таблиц и полей соответствуют ожиданиям better-auth (user, session, account, verification). */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"), // только хеш
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────── Профиль, статистика, подписка ───────────── */

export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  goal: text("goal", { enum: ["general", "ielts"] }).notNull().default("general"),
  level: text("level", { enum: ["A1", "A2", "B1", "B2", "C1"] }),
  targetBand: real("target_band"),
  examDate: text("exam_date"), // YYYY-MM-DD
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(15),
  timezone: text("timezone").notNull().default("UTC"), // IANA, например Europe/Moscow: по нему считаются сутки и серия
  onboardedAt: integer("onboarded_at", { mode: "timestamp" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userStats = sqliteTable("user_stats", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"), // YYYY-MM-DD
  streakFreezes: integer("streak_freezes").notNull().default(0),
  freezeWeek: text("freeze_week"), // понедельник недели (YYYY-MM-DD), за которую выдана заморозка
  updatedAt: updatedAt(),
});

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["free", "pro"] }).notNull().default("free"),
    status: text("status").notNull().default("active"), // active | past_due | canceled …
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("subscriptions_stripe_customer_idx").on(t.stripeCustomerId)],
);

/* ───────────── Курс ───────────── */

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(), // slug, например "present-simple"
    title: text("title").notNull(), // English
    titleRu: text("title_ru").notNull(),
    description: text("description").notNull(),
    level: text("level", { enum: ["A1", "A2", "B1", "B2", "C1"] }).notNull(),
    track: text("track", { enum: ["general", "ielts"] }).notNull().default("general"),
    orderIndex: integer("order_index").notNull(),
    theory: text("theory", { mode: "json" }).notNull(), // см. src/content/types.ts (Theory)
  },
  (t) => [uniqueIndex("topics_order_idx").on(t.orderIndex)],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(), // "present-simple-p1"
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["theory", "practice", "test"] }).notNull(),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull(), // порядок внутри темы
    globalOrder: integer("global_order").notNull(), // сквозной порядок по курсу (для лимита Free)
    xpReward: integer("xp_reward").notNull().default(10),
  },
  (t) => [
    uniqueIndex("lessons_global_idx").on(t.globalOrder),
    uniqueIndex("lessons_topic_order_idx").on(t.topicId, t.orderIndex),
  ],
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(), // "present-simple-p1-e1"
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    kind: text("kind", {
      enum: ["choice", "fill_blank", "build_sentence", "translate", "listening", "dictation", "match_pairs"],
    }).notNull(),
    tag: text("tag").notNull(), // грамматическая категория, по ней группируются ошибки
    payload: text("payload", { mode: "json" }).notNull(), // см. src/content/types.ts (ExercisePayload)
  },
  (t) => [uniqueIndex("exercises_lesson_order_idx").on(t.lessonId, t.orderIndex)],
);

/* ───────────── Прогресс пользователя ───────────── */

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["in_progress", "completed"] }).notNull().default("in_progress"),
    score: integer("score"), // последний результат, 0..100
    bestScore: integer("best_score"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    timeMs: integer("time_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    index("attempts_user_created_idx").on(t.userId, t.createdAt),
    index("attempts_user_exercise_idx").on(t.userId, t.exerciseId),
  ],
);

export const mistakes = sqliteTable(
  "mistakes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    lastAnswer: text("last_answer").notNull(),
    timesWrong: integer("times_wrong").notNull().default(1),
    aiExplanation: text("ai_explanation", { mode: "json" }), // кеш разбора (этап 7)
    box: integer("box").notNull().default(0), // ступень интервального повторения (SRS)
    dueAt: integer("due_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("mistakes_user_exercise_idx").on(t.userId, t.exerciseId),
    index("mistakes_user_due_idx").on(t.userId, t.dueAt),
  ],
);

/** Окно лимитов Free: 24 часа от начала практики (этап 6). */
export const dailyUsage = sqliteTable(
  "daily_usage",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
    practiceSeconds: integer("practice_seconds").notNull().default(0),
    aiExplanations: integer("ai_explanations").notNull().default(0),
    lessonsCompleted: integer("lessons_completed").notNull().default(0),
  },
  (t) => [index("daily_usage_user_window_idx").on(t.userId, t.windowStart)],
);

/* ───────────── Разговорник ───────────── */

export const phraseSituations = sqliteTable("phrase_situations", {
  id: text("id").primaryKey(), // "restaurant"
  title: text("title").notNull(), // по-русски
  description: text("description").notNull(),
  orderIndex: integer("order_index").notNull(),
  isFree: integer("is_free", { mode: "boolean" }).notNull().default(false),
});

export const phrases = sqliteTable(
  "phrases",
  {
    id: text("id").primaryKey(), // "restaurant-1"
    situationId: text("situation_id")
      .notNull()
      .references(() => phraseSituations.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    en: text("en").notNull(),
    ru: text("ru").notNull(),
    note: text("note"),
  },
  (t) => [index("phrases_situation_idx").on(t.situationId, t.orderIndex)],
);

export const phraseFavorites = sqliteTable(
  "phrase_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    phraseId: text("phrase_id")
      .notNull()
      .references(() => phrases.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.phraseId] })],
);

/* ───────────── AI ───────────── */

/** Общий кеш разборов ошибок: одинаковая ошибка (то же упражнение и тот же ответ) разбирается моделью один раз. */
export const aiExplanationCache = sqliteTable("ai_explanation_cache", {
  key: text("key").primaryKey(), // sha256(упражнение | нормализованный ответ)
  payload: text("payload", { mode: "json" }).notNull(),
  model: text("model").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Оплата ───────────── */

/** Обработанные события Stripe: повторная доставка того же события ничего не меняет. */
export const stripeEvents = sqliteTable("stripe_events", {
  id: text("id").primaryKey(), // evt_...
  type: text("type").notNull(),
  createdAt: createdAt(),
});

/* ───────────── Статистика и отчёты ───────────── */

/** Журнал начисления XP: по нему строится динамика. Старые начисления до появления журнала в нём отсутствуют. */
export const xpEvents = sqliteTable(
  "xp_events",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("xp_events_user_created_idx").on(t.userId, t.createdAt)],
);

/** Еженедельный AI-отчёт (PRO): один на пользователя и неделю, чтобы повторный просмотр не тратил запрос к модели. */
export const weeklyReports = sqliteTable(
  "weekly_reports",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(), // понедельник, YYYY-MM-DD
    payload: text("payload", { mode: "json" }).notNull(),
    model: text("model").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);

/* ───────────── PRO: чат и IELTS ───────────── */

export const chatConversations = sqliteTable(
  "chat_conversations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scenario: text("scenario").notNull(), // id сценария из src/lib/chat-scenarios.ts
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("chat_conv_user_idx").on(t.userId, t.updatedAt)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_user_conv_idx").on(t.userId, t.conversationId, t.createdAt)],
);

export const ieltsSubmissions = sqliteTable(
  "ielts_submissions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    task: text("task", { enum: ["writing1", "writing2", "speaking1", "speaking2", "speaking3", "speaking"] }).notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    wordCount: integer("word_count"),
    bandOverall: real("band_overall"),
    criteria: text("criteria", { mode: "json" }), // оценки по 4 критериям
    feedback: text("feedback", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [index("ielts_user_created_idx").on(t.userId, t.createdAt)],
);
