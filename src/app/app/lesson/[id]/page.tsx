import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LimitScreen, PaywallScreen } from "@/components/gate/screens";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { TheoryView } from "@/components/lesson/theory-view";
import { createLessonToken } from "@/lib/access-token";
import { exercisesOfLesson, getLesson, getTopic } from "@/lib/course-index";
import { toClientExercise } from "@/lib/exercise-view";
import { isPracticeExhausted, lessonAllowedForPlan } from "@/lib/limits";
import { loadCourseView } from "@/lib/progress";
import { getAccount, requireUser } from "@/lib/session";
import { getUsage } from "@/lib/usage";

export const metadata: Metadata = { title: "Урок" };

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { profile, plan } = await getAccount(user.id);
  if (!profile.onboardedAt) redirect("/app/onboarding");

  const lesson = getLesson(id);
  const topic = lesson ? getTopic(lesson.topicId) : undefined;
  if (!lesson || !topic) notFound();

  // Пейволл: Free открыты только первые уроки курса.
  if (!lessonAllowedForPlan(plan, lesson.globalOrder)) return <PaywallScreen />;

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

  // Дневной лимит практики Free: новый урок начать нельзя до сброса.
  const usage = await getUsage(user.id);
  if (isPracticeExhausted(plan, usage.practiceSeconds) && usage.resetsAt) {
    return <LimitScreen resetsAtMs={usage.resetsAt.getTime()} />;
  }

  // В браузер уходят задания без правильных ответов и токен, по которому принимаются ответы.
  const exercises = exercisesOfLesson(lesson.id).map((e) => toClientExercise(e.id, e.def));
  const token = createLessonToken({ userId: user.id, lessonId: lesson.id, plan });
  return (
    <LessonPlayer
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      topicTitle={topic.titleRu}
      lessonType={lesson.type}
      exercises={exercises}
      token={token}
    />
  );
}
