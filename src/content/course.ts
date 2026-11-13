import { articles } from "./topics/articles";
import { futureForms } from "./topics/future-forms";
import { ieltsWritingTask2 } from "./topics/ielts-writing-task2";
import { pastSimple } from "./topics/past-simple";
import { presentContinuous } from "./topics/present-continuous";
import { presentSimple } from "./topics/present-simple";
import type { ExerciseDef, TopicDef } from "./types";

/** Порядок тем в курсе. */
export const TOPICS: TopicDef[] = [
  presentSimple,
  presentContinuous,
  pastSimple,
  articles,
  futureForms,
  ieltsWritingTask2,
];

const XP = { theory: 5, practice: 10, test: 20 } as const;

/**
 * Разворачивает темы в плоские строки для БД со стабильными id:
 * урок «<тема>-theory | -p1 | -test», упражнение «<урок>-e<номер>».
 * Стабильные id позволяют пересеивать контент, не теряя прогресс пользователей.
 */
export function buildCourse(topicDefs: TopicDef[] = TOPICS) {
  const topics = [];
  const lessons = [];
  const exercises = [];
  let globalOrder = 0;

  for (const [ti, t] of topicDefs.entries()) {
    topics.push({
      id: t.id,
      title: t.title,
      titleRu: t.titleRu,
      description: t.description,
      level: t.level,
      track: t.track,
      orderIndex: ti + 1,
      theory: t.theory,
    });

    lessons.push({
      id: `${t.id}-theory`,
      topicId: t.id,
      type: "theory" as const,
      title: `Теория: ${t.titleRu}`,
      orderIndex: 1,
      globalOrder: ++globalOrder,
      xpReward: XP.theory,
    });

    for (const [li, l] of t.lessons.entries()) {
      const lessonId = `${t.id}-${l.key}`;
      lessons.push({
        id: lessonId,
        topicId: t.id,
        type: l.type,
        title: l.title,
        orderIndex: li + 2,
        globalOrder: ++globalOrder,
        xpReward: XP[l.type],
      });
      for (const [ei, e] of l.exercises.entries()) {
        const { kind, tag, ...payload } = e as ExerciseDef;
        exercises.push({ id: `${lessonId}-e${ei + 1}`, lessonId, orderIndex: ei + 1, kind, tag, payload });
      }
    }
  }

  return { topics, lessons, exercises };
}
