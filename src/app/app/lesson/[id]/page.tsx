import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { TheoryView } from "@/components/lesson/theory-view";
import { exercisesOfLesson, getLesson, getTopic } from "@/lib/course-index";
import { toClientExercise } from "@/lib/exercise-view";
import { loadCourseView } from "@/lib/progress";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Урок" };

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { profile } = await getAccount(user.id);
  if (!profile.onboardedAt) redirect("/app/onboarding");

  const lesson = getLesson(id);
  const topic = lesson ? getTopic(lesson.topicId) : undefined;
  if (!lesson || !topic) notFound();

  const { views } = await loadCourseView(user.id, profile.level);
  const view = views.find((v) => v.topic.id === topic.id)?.lessons.find((l) => l.lesson.id === lesson.id);
  // Закрытый урок недоступен по прямой ссылке.
  if (!view || view.state === "locked") redirect("/app/learn");

  if (lesson.type === "theory") {
    return (
      <TheoryView
        lessonId={lesson.id}
        topicTitle={topic.title}
        topicTitleRu={topic.titleRu}
        theory={topic.theory}
        isRevisit={view.state === "completed"}
      />
    );
  }

  // В браузер уходят задания без правильных ответов.
  const exercises = exercisesOfLesson(lesson.id).map((e) => toClientExercise(e.id, e.def));
  return (
    <LessonPlayer
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      topicTitle={topic.titleRu}
      lessonType={lesson.type}
      exercises={exercises}
    />
  );
}
