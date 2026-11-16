import "server-only";
import { buildCourse, TOPICS } from "@/content/course";
import { exerciseSchema, type ExerciseDef, type Theory } from "@/content/types";

/**
 * Курс в памяти: источник правды для структуры, теории и ответов — файлы src/content.
 * В базе (topics, lessons, exercises) те же строки лежат ради внешних ключей и отчётов,
 * поэтому после правок контента нужен `npm run db:seed`.
 */
const built = buildCourse(TOPICS);

export interface CourseTopic {
  id: string;
  title: string;
  titleRu: string;
  description: string;
  level: (typeof TOPICS)[number]["level"];
  track: "general" | "ielts";
  orderIndex: number;
  theory: Theory;
}

export interface CourseLesson {
  id: string;
  topicId: string;
  type: "theory" | "practice" | "test";
  title: string;
  orderIndex: number;
  globalOrder: number;
  xpReward: number;
}

export const courseTopics: CourseTopic[] = built.topics.map((t) => ({ ...t, theory: t.theory }));
export const courseLessons: CourseLesson[] = built.lessons;

const lessonById = new Map(courseLessons.map((l) => [l.id, l]));
const topicById = new Map(courseTopics.map((t) => [t.id, t]));

/** Определения упражнений вместе с ответами. Только для сервера. */
const exerciseById = new Map<string, { lessonId: string; orderIndex: number; def: ExerciseDef }>(
  built.exercises.map((e) => [
    e.id,
    { lessonId: e.lessonId, orderIndex: e.orderIndex, def: exerciseSchema.parse({ kind: e.kind, tag: e.tag, ...e.payload }) },
  ]),
);

export const getLesson = (id: string) => lessonById.get(id);
export const getTopic = (id: string) => topicById.get(id);
export const getExercise = (id: string) => exerciseById.get(id);

export function exercisesOfLesson(lessonId: string) {
  return [...exerciseById.entries()]
    .filter(([, e]) => e.lessonId === lessonId)
    .sort((a, b) => a[1].orderIndex - b[1].orderIndex)
    .map(([id, e]) => ({ id, ...e }));
}

export function lessonsOfTopic(topicId: string) {
  return courseLessons.filter((l) => l.topicId === topicId).sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Следующая тема курса после данной (или undefined, если это последняя). */
export function nextTopic(topicId: string): CourseTopic | undefined {
  const t = topicById.get(topicId);
  return t ? courseTopics.find((x) => x.orderIndex === t.orderIndex + 1) : undefined;
}
