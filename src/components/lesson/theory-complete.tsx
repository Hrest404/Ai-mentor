"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeTheory } from "@/app/app/lesson/actions";
import { Button, ButtonLink } from "@/components/ui/button";

/** Кнопка под теорией: отмечает её прочитанной и ведёт к первому уроку темы. */
export function TheoryComplete({ lessonId, isRevisit }: { lessonId: string; isRevisit: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isRevisit) {
    return (
      <ButtonLink href="/app/learn" size="lg" className="w-full sm:w-fit">
        К карте курса
      </ButtonLink>
    );
  }

  async function done() {
    setLoading(true);
    setError(null);
    try {
      const res = await completeTheory({ lessonId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (!res.ok) throw new Error(res.error);
      router.push(res.nextLessonId ? `/app/lesson/${res.nextLessonId}` : "/app/learn");
      router.refresh();
    } catch {
      setError("Не получилось сохранить. Проверьте соединение и попробуйте ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
          {error}
        </p>
      )}
      <Button size="lg" loading={loading} onClick={done} className="w-full sm:w-fit">
        Понятно, к урокам
      </Button>
    </div>
  );
}
