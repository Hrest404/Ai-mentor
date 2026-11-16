"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkExercise, finishLesson, type FinishResponse } from "@/app/app/lesson/actions";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/gate/countdown";
import { Button, ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PASS_SCORE } from "@/lib/course-state";
import { cn } from "@/lib/cn";
import type { ClientExercise } from "@/lib/exercise-view";
import { stopSpeaking } from "@/lib/tts";
import {
  ExerciseView,
  initialValue,
  isReady,
  promptText,
  toServerAnswer,
  type AnswerValue,
  type ExerciseFeedback,
} from "./exercises";

interface Props {
  lessonId: string;
  lessonTitle: string;
  topicTitle: string;
  lessonType: "practice" | "test";
  exercises: ClientExercise[];
  /** Подписанный токен доступа к уроку: без него сервер не принимает ответы. */
  token: string;
}

type Phase = "answer" | "checking" | "feedback" | "finishing" | "done";
interface Result {
  exercise: ClientExercise;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
}
type Summary = Extract<FinishResponse, { ok: true }>;

const MAX_TIME_MS = 10 * 60 * 1000;

export function LessonPlayer({ lessonId, lessonTitle, topicTitle, lessonType, exercises, token }: Props) {
  const total = exercises.length;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [value, setValue] = useState<AnswerValue>(() => initialValue(exercises[0]));
  const [feedback, setFeedback] = useState<(ExerciseFeedback & { explanation: string }) | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [attemptIds, setAttemptIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Лимит исчерпан в середине урока: этот урок ещё можно закончить. */
  const [limitNote, setLimitNote] = useState(false);
  /** Дальше заниматься нельзя: лимит или доступ закончились. */
  const [blocked, setBlocked] = useState<{ message: string; resetsAtMs?: number } | null>(null);
  const shownAt = useRef(0);

  const ex = exercises[index];
  const ready = isReady(ex, value);
  const isLast = index + 1 === total;

  useEffect(() => {
    shownAt.current = Date.now();
    return () => stopSpeaking();
  }, [index]);

  const check = useCallback(async () => {
    if (phase !== "answer" || !isReady(ex, value)) return;
    setPhase("checking");
    setError(null);
    try {
      const res = await checkExercise({
        token,
        lessonId,
        exerciseId: ex.id,
        answer: toServerAnswer(ex, value),
        timeMs: Math.min(MAX_TIME_MS, Math.max(0, Date.now() - shownAt.current)),
      });
      if (!res.ok) {
        if (res.code) {
          setBlocked({ message: res.error, resetsAtMs: res.resetsAtMs });
          setPhase("answer");
          return;
        }
        throw new Error(res.error);
      }
      if (res.limitReached) setLimitNote(true);
      setFeedback({ correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation });
      setResults((r) => [...r, { exercise: ex, correct: res.correct, correctAnswer: res.correctAnswer, explanation: res.explanation }]);
      setAttemptIds((a) => [...a, res.attemptId]);
      setPhase("feedback");
    } catch {
      setError("Не получилось проверить ответ. Проверьте соединение и попробуйте ещё раз.");
      setPhase("answer");
    }
  }, [phase, ex, value, lessonId, token]);

  const finish = useCallback(
    async (ids: string[]) => {
      setPhase("finishing");
      setError(null);
      try {
        const res = await finishLesson({ lessonId, attemptIds: ids, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
        if (!res.ok) throw new Error(res.error);
        setSummary(res);
        setPhase("done");
        // Без router.refresh(): повторный рендер страницы урока подменил бы экран итогов экраном лимита.
        // Кабинет и так читает свежие данные при переходе.
      } catch {
        setError("Не получилось сохранить результат. Нажмите «Повторить», ответы не потеряны.");
        setPhase("feedback");
      }
    },
    [lessonId],
  );

  const next = useCallback(() => {
    if (phase !== "feedback") return;
    if (isLast) {
      void finish(attemptIds);
      return;
    }
    const nextEx = exercises[index + 1];
    setIndex(index + 1);
    setValue(initialValue(nextEx));
    setFeedback(null);
    setPhase("answer");
  }, [phase, isLast, finish, attemptIds, exercises, index]);

  // Enter проверяет и продолжает, цифры выбирают вариант. Нажатия на кнопках и ссылках не перехватываем.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const onControl = target?.tagName === "BUTTON" || target?.tagName === "A";
      if (e.key === "Enter" && !onControl && !e.isComposing) {
        e.preventDefault();
        if (phase === "answer") void check();
        else if (phase === "feedback" && !error) next();
        return;
      }
      if (!typing && phase === "answer" && (ex.kind === "choice" || ex.kind === "listening") && /^[1-9]$/.test(e.key)) {
        const option = ex.options[Number(e.key) - 1];
        if (option) setValue(option);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, check, next, ex, error]);

  if (phase === "done" && summary) {
    return (
      <Summary
        summary={summary}
        results={results}
        lessonType={lessonType}
        lessonTitle={lessonTitle}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (blocked) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-12">
        <h1 className="text-3xl">{blocked.message}</h1>
        {blocked.resetsAtMs ? (
          <p className="text-lg">
            Практика откроется снова через <Countdown resetsAtMs={blocked.resetsAtMs} />. PRO снимает дневной лимит.
          </p>
        ) : (
          <p className="text-lg">Откройте урок заново из карты курса.</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/pricing" size="lg">
            Смотреть тариф PRO
          </ButtonLink>
          <ButtonLink href="/app/learn" variant="secondary" size="lg">
            К карте курса
          </ButtonLink>
        </div>
      </main>
    );
  }

  const locked = phase !== "answer";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-4">
        <Link
          href="/app/learn"
          aria-label="Выйти из урока"
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <Progress value={phase === "feedback" || phase === "finishing" ? index + 1 : index} max={total} label="Прогресс урока" className="flex-1" />
        <span className="shrink-0 text-sm font-medium text-muted" aria-live="polite">
          {index + 1} из {total}
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-72 pt-6">
        <p className="mb-6 text-sm text-muted">
          {topicTitle} · {lessonTitle}
        </p>
        <ExerciseView key={ex.id} ex={ex} value={value} onChange={setValue} locked={locked} feedback={feedback} />
      </main>

      <footer
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)]",
          feedback ? (feedback.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-line bg-surface",
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4">
          <div role="status" aria-live="polite" className="flex flex-col gap-1">
            {error && <p className="font-medium text-danger">{error}</p>}
            {limitNote && (
              <p className="text-sm font-medium text-muted">
                Дневной лимит практики исчерпан. Этот урок можно закончить, новые откроются после сброса.
              </p>
            )}
            {feedback && (
              <>
                <p className={cn("text-xl font-medium", feedback.correct ? "text-success" : "text-danger")}>
                  {feedback.correct ? "Верно!" : "Неверно"}
                </p>
                {!feedback.correct && (
                  <p lang="en" className="font-medium">
                    Правильно: {feedback.correctAnswer}
                  </p>
                )}
                <p>{feedback.explanation}</p>
              </>
            )}
          </div>
          {phase === "feedback" || phase === "finishing" ? (
            <Button size="lg" onClick={error ? () => void finish(attemptIds) : next} loading={phase === "finishing"} className="w-full">
              {error ? "Повторить" : isLast ? "Завершить" : "Дальше"}
            </Button>
          ) : (
            <Button size="lg" onClick={() => void check()} disabled={!ready} loading={phase === "checking"} className="w-full">
              Проверить
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Summary({
  summary,
  results,
  lessonType,
  lessonTitle,
  onRetry,
}: {
  summary: Summary;
  results: Result[];
  lessonType: "practice" | "test";
  lessonTitle: string;
  onRetry: () => void;
}) {
  const wrong = results.filter((r) => !r.correct);
  const failedTest = lessonType === "test" && !summary.passed;
  const title = failedTest ? "Тест пока не сдан" : lessonType === "test" ? "Тест сдан" : "Урок пройден";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted">{lessonTitle}</p>
        <h1 className="text-4xl">{title}</h1>
        <p className="text-6xl font-medium tracking-tight">{summary.score}%</p>
        <p className="text-lg text-muted">
          Верных ответов: {summary.correctCount} из {summary.total}
          {failedTest && `. Для перехода дальше нужно набрать ${PASS_SCORE}%.`}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge tone="xp">+{summary.xpGain} XP</Badge>
          <Badge tone="xp">Всего {summary.totalXp} XP</Badge>
          <Badge tone="xp">Серия: {summary.streak} дн.</Badge>
        </div>
      </div>

      {summary.unlockedTopic && (
        <p role="status" className="rounded-lg bg-action-soft px-5 py-4 text-lg">
          Открыта новая тема: <span className="font-medium">{summary.unlockedTopic}</span>
        </p>
      )}

      {wrong.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl">Над чем стоит подумать</h2>
          <p className="text-muted">Эти задания сохранены в «Мои ошибки».</p>
          <ul className="flex flex-col gap-3">
            {wrong.map((r) => (
              <li key={r.exercise.id} className="rounded-lg border border-line bg-surface p-4">
                <p className="font-medium">{promptText(r.exercise)}</p>
                <p lang="en" className="text-success">
                  Правильно: {r.correctAnswer}
                </p>
                <p className="text-muted">{r.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {failedTest ? (
          <>
            <Button size="lg" onClick={onRetry}>
              Повторить тест
            </Button>
            <ButtonLink href="/app/learn" variant="secondary" size="lg">
              К карте курса
            </ButtonLink>
          </>
        ) : summary.nextLessonId ? (
          <>
            <ButtonLink href={`/app/lesson/${summary.nextLessonId}`} size="lg">
              Дальше
            </ButtonLink>
            <ButtonLink href="/app/learn" variant="secondary" size="lg">
              К карте курса
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href="/app/learn" size="lg">
              К карте курса
            </ButtonLink>
            <Button variant="secondary" size="lg" onClick={onRetry}>
              Пройти ещё раз
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
