"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { assessWriting, type WritingAssessmentResponse } from "@/app/app/(main)/pro/ielts/actions";
import { BandResult } from "@/components/pro/band-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WritingTask } from "@/content/ielts-tasks";
import { cn } from "@/lib/cn";
import { WRITING_CRITERIA, WRITING_LIMITS, countWords } from "@/lib/ielts";

const mmss = (s: number) => `${String(Math.floor(Math.abs(s) / 60)).padStart(2, "0")}:${String(Math.abs(s) % 60).padStart(2, "0")}`;

export function WritingPractice({ tasks }: { tasks: WritingTask[] }) {
  const [task, setTask] = useState<WritingTask | null>(null);
  const [text, setText] = useState("");
  const [started, setStarted] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<WritingAssessmentResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (started === null || !task) return;
    const limit = WRITING_LIMITS[task.task].minutes * 60;
    const update = () => setLeft(limit - Math.floor((Date.now() - started) / 1000));
    update();
    tick.current = setInterval(update, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [started, task]);

  function pick(t: WritingTask) {
    setTask(t);
    setText("");
    setResult(null);
    setStarted(Date.now());
  }

  function leave() {
    setTask(null);
    setStarted(null);
    setResult(null);
  }

  function submit() {
    if (!task) return;
    if (tick.current) clearInterval(tick.current);
    startTransition(async () => {
      try {
        setResult(await assessWriting({ taskId: task.id, response: text }));
      } catch {
        setResult({ ok: false, code: "error", error: "Не получилось получить оценку. Проверьте соединение и попробуйте ещё раз." });
      }
    });
  }

  if (!task) {
    return (
      <div className="flex flex-col gap-6">
        {([1, 2] as const).map((n) => (
          <section key={n} className="flex flex-col gap-3">
            <h2 className="text-xl">
              Task {n}: {n === 1 ? "письмо" : "эссе"}{" "}
              <span className="text-base font-normal text-muted">
                ({WRITING_LIMITS[n].minutes} минут, от {WRITING_LIMITS[n].minWords} слов)
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {tasks
                .filter((t) => t.task === n)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(t)}
                    className="lift rounded-lg border border-line bg-surface p-5 text-left shadow-card hover:bg-surface-alt"
                  >
                    <span className="block text-lg font-medium">{t.title}</span>
                    <span lang="en" className="mt-1 line-clamp-2 text-muted">
                      {t.prompt.split("\n")[0]}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const limits = WRITING_LIMITS[task.task];
  const words = countWords(text);
  const enough = words >= limits.minWords;
  const over = left < 0;

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="secondary" className="w-fit" onClick={leave}>
          Выбрать другое задание
        </Button>
        <BandResult
          band={result.band}
          criteria={result.criteria}
          comments={result.assessment.comments}
          labels={WRITING_CRITERIA}
          strengths={result.assessment.strengths}
          improvements={result.assessment.improvements}
          improved={result.assessment.improved}
          note={`В работе ${result.wordCount} слов. Результат сохранён в истории.`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">{task.title}</h2>
          <Badge tone={over ? "danger" : left < 300 ? "xp" : "neutral"}>
            <span role="timer" aria-label="Оставшееся время">
              {over ? `Время вышло, +${mmss(left)}` : mmss(left)}
            </span>
          </Badge>
        </div>
        <p lang="en" className="whitespace-pre-wrap text-lg">
          {task.prompt}
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <label htmlFor="ielts-writing" className="text-base font-medium">
          Ваша работа
        </label>
        <textarea
          id="ielts-writing"
          lang="en"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={limits.maxChars}
          rows={14}
          className="min-h-72 resize-y rounded-md border border-line bg-surface px-4 py-3 text-lg text-ink hover:border-muted"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("font-medium", enough ? "text-success" : "text-muted")}>
            {words} {words === 1 ? "слово" : "слов"} из {limits.minWords} минимум
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={leave} disabled={pending}>
              Выйти
            </Button>
            <Button onClick={submit} loading={pending} disabled={words < 5}>
              Получить оценку
            </Button>
          </div>
        </div>
        {!enough && words >= 5 && (
          <p className="text-sm text-muted">Меньше минимума слов: оценка по критерию «Выполнение задания» будет снижена.</p>
        )}
      </Card>

      {pending && (
        <p role="status" className="text-muted">
          Экзаменатор читает работу. Это занимает до минуты, не закрывайте страницу.
        </p>
      )}
      {result && !result.ok && (
        <Card role="alert" className="border-danger">
          <p className="font-medium">{result.error}</p>
        </Card>
      )}
    </div>
  );
}
