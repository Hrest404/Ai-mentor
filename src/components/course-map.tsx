import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CourseLesson, CourseTopic } from "@/lib/course-index";
import { PASS_SCORE, type LessonState, type TopicView } from "@/lib/course-state";
import { cn } from "@/lib/cn";

const TYPE_LABEL = { theory: "Теория", practice: "Урок", test: "Итоговый тест" } as const;

function StateIcon({ state }: { state: LessonState }) {
  if (state === "completed") {
    return (
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "available") {
    return (
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-action text-action-ink">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-alt text-muted">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  );
}

const STATE_TEXT: Record<LessonState, string> = { completed: "пройден", available: "доступен", locked: "закрыт" };

export function CourseMap({
  views,
  nextLessonId,
}: {
  views: TopicView<CourseTopic, CourseLesson>[];
  nextLessonId: string | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      {views.map((v, i) => {
        const prev = views[i - 1];
        const total = v.lessons.length;
        return (
          <section key={v.topic.id} id={v.topic.id} aria-labelledby={`${v.topic.id}-title`}>
            <Card className={cn("flex flex-col gap-6 p-0", !v.open && "bg-surface-alt shadow-none")}>
              <div className="flex flex-col gap-4 p-6 pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>{v.topic.level}</Badge>
                  {v.topic.track === "ielts" && <Badge tone="action">IELTS</Badge>}
                  {v.testPassed && <Badge tone="success">Тема пройдена</Badge>}
                  {!v.open && <Badge>Закрыта</Badge>}
                </div>
                <div className="flex flex-col gap-1">
                  <h2 id={`${v.topic.id}-title`} className="text-2xl sm:text-3xl">
                    {i + 1}. {v.topic.titleRu}
                  </h2>
                  <p className={cn(v.open ? "text-muted" : "text-ink")}>
                    {v.open
                      ? v.topic.description
                      : `Откроется после итогового теста темы «${prev?.topic.titleRu}» на ${PASS_SCORE}% и выше.`}
                  </p>
                </div>
                {v.open && (
                  <div className="flex items-center gap-4">
                    <Progress value={v.completedCount} max={total} label={`Прогресс темы: ${v.topic.titleRu}`} className="flex-1" />
                    <span className="shrink-0 text-sm text-muted">
                      {v.completedCount} из {total}
                    </span>
                  </div>
                )}
              </div>

              <ul className="flex flex-col">
                {v.lessons.map(({ lesson, state, bestScore }) => {
                  const isNext = lesson.id === nextLessonId;
                  const row = (
                    <>
                      <StateIcon state={state} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate", state === "locked" ? "text-muted" : "font-medium")}>
                          {lesson.title}
                        </span>
                        <span className="block text-sm text-muted">
                          {TYPE_LABEL[lesson.type]}
                          <span className="sr-only">, {STATE_TEXT[state]}</span>
                        </span>
                      </span>
                      {state === "completed" && bestScore !== null && lesson.type !== "theory" && (
                        <Badge tone="success">{bestScore}%</Badge>
                      )}
                      {isNext && (
                        <span className="hidden shrink-0 rounded-md bg-action px-4 py-2 font-medium text-action-ink sm:inline">
                          {v.completedCount === 0 ? "Начать" : "Продолжить"}
                        </span>
                      )}
                    </>
                  );
                  const base = "flex min-h-16 items-center gap-4 border-t border-line px-6 py-3";
                  return (
                    <li key={lesson.id}>
                      {state === "locked" ? (
                        <div className={cn(base, "opacity-70")}>{row}</div>
                      ) : (
                        <Link
                          href={`/app/lesson/${lesson.id}`}
                          className={cn(base, "transition-colors hover:bg-surface-alt", isNext && "bg-action-soft hover:bg-action-soft")}
                        >
                          {row}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        );
      })}
      {nextLessonId === null && (
        <p className="text-muted">
          Все доступные уроки пройдены. <ButtonLink href="/app" variant="ghost">На главную</ButtonLink>
        </p>
      )}
    </div>
  );
}
