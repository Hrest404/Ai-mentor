import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { AppFrame } from "./app-frame";

/* Фрагменты интерфейса продукта для лендинга. Тексты взяты из реального курса (src/content). */

function Check({ done }: { done?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-[13px]",
        done ? "border-success bg-success-soft text-success" : "border-line text-muted",
      )}
    >
      {done ? "✓" : ""}
    </span>
  );
}

/** Карта одной темы: теория, четыре урока, итоговый тест. */
export function CourseMapMock({ rows }: { rows: { title: string; kind: string }[] }) {
  return (
    <AppFrame title="Present Simple" meta="Уровень A1">
      <ul className="flex flex-col">
        {rows.map((r, i) => {
          const state = i < 2 ? "done" : i === 2 ? "now" : "todo";
          return (
            <li
              key={r.title}
              className={cn(
                "flex min-h-[4.5rem] items-center gap-4 border-b border-line last:border-0",
                state === "now" && "font-medium",
              )}
            >
              <Check done={state === "done"} />
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="shrink-0 text-sm text-muted">{r.kind}</span>
            </li>
          );
        })}
      </ul>
    </AppFrame>
  );
}

/** Ошибка и её разбор: правило и три похожих задания. */
export function MistakeMock({
  prompt,
  yourAnswer,
  rightAnswer,
  explanation,
}: {
  prompt: string;
  yourAnswer: string;
  rightAnswer: string;
  explanation: string;
}) {
  return (
    <AppFrame title="Разбор ошибки" meta="Present Simple и Continuous">
      <div className="flex flex-col gap-5">
        <p lang="en" className="text-2xl font-medium tracking-tight">
          {prompt}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-danger-soft px-4 py-3">
            <p className="text-sm text-muted">Ваш ответ</p>
            <p lang="en" className="text-lg font-medium text-danger line-through decoration-1">
              {yourAnswer}
            </p>
          </div>
          <div className="rounded-md bg-success-soft px-4 py-3">
            <p className="text-sm text-muted">Верно</p>
            <p lang="en" className="text-lg font-medium text-success">
              {rightAnswer}
            </p>
          </div>
        </div>
        <p>{explanation}</p>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Badge tone="action">3 похожих задания</Badge>
          <Badge>Повторение завтра</Badge>
        </div>
      </div>
    </AppFrame>
  );
}

/** Редактор эссе IELTS Writing Task 2 и критерии оценки: слева задание и текст, справа критерии. */
export function EssayMock({ task, criteria }: { task: string; criteria: string[] }) {
  return (
    <AppFrame title="IELTS Writing, Task 2" meta="Не меньше 250 слов">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-4">
          <p lang="en" className="text-lg font-medium">
            {task}
          </p>
          <div
            lang="en"
            className="flex min-h-32 flex-1 items-start rounded-md border border-line bg-bg px-4 py-3 text-muted"
          >
            I completely agree that investment in public transport should be the priority…
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">Критерии оценки</p>
          <ul className="flex flex-col">
            {criteria.map((c) => (
              <li key={c} className="flex min-h-14 items-center justify-between gap-4 border-b border-line last:border-0">
                <span lang="en" className="font-medium">
                  {c}
                </span>
                <span className="shrink-0 text-sm text-muted">оценка 0–9</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppFrame>
  );
}

/** Карточки разговорника с озвучкой. */
export function PhrasebookMock({ title, items }: { title: string; items: { en: string; ru: string }[] }) {
  return (
    <AppFrame title="Разговорник" meta={title}>
      <ul className="flex flex-col">
        {items.map((p, i) => (
          <li key={p.en} className={cn("min-h-16 items-center gap-4 border-b border-line py-3 last:border-0", i >= 3 ? "hidden lg:flex" : "flex")}>
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-action-soft text-action"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span lang="en" className="block font-medium">
                {p.en}
              </span>
              <span className="block text-muted">{p.ru}</span>
            </span>
          </li>
        ))}
      </ul>
    </AppFrame>
  );
}
