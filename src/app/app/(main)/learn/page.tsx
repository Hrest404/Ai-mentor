import type { Metadata } from "next";
import { CourseMap } from "@/components/course-map";
import { loadCourseView } from "@/lib/progress";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Обучение" };

export default async function LearnPage() {
  const user = await requireUser();
  const { profile } = await getAccount(user.id);
  const { views, next } = await loadCourseView(user.id, profile.level);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Курс</h1>
        <p className="text-muted">
          В каждой теме теория, четыре урока и итоговый тест. Результат теста от 80% открывает следующую тему.
        </p>
      </div>
      <CourseMap views={views} nextLessonId={next?.lesson.id ?? null} />
    </div>
  );
}
