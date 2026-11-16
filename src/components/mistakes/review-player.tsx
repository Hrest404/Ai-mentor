"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkReviewAnswer } from "@/app/app/(main)/mistakes/actions";
import { Countdown } from "@/components/gate/countdown";
import { ExerciseView, initialValue, isReady, toServerAnswer, type AnswerValue } from "@/components/lesson/exercises";
import { Button, ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import type { ClientExercise } from "@/lib/exercise-view";
import { stopSpeaking } from "@/lib/tts";

interface Feedback {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  nextReview: string;
  resolved: boolean;
}

type Phase = "answer" | "checking" | "feedback" | "done";

/** Сессия повторения: те же задания, что были с ошибкой. Каждый ответ сдвигает ошибку по графику. */
export function ReviewPlayer({ items }: { items: ClientExercise[] }) {
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [value, setValue] = useState<AnswerValue>(() => initialValue(items[0]));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ resetsAtMs: number } | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0, resolved: 0 });
  const shownAt = useRef(0);

  const ex = items[index];
  const ready = isReady(ex, value);

  useEffect(() => {
    shownAt.current = Date.now();
    return () => stopSpeaking();
  }, [index]);

  const check = useCallback(async () => {
    if (phase !== "answer" || !isReady(ex, value)) return;
    setPhase("checking");
    setError(null);
    try {
      const res = await checkReviewAnswer({
        exerciseId: ex.id,
        answer: toServerAnswer(ex, value),
        timeMs: Math.min(10 * 60 * 1000, Math.max(0, Date.now() - shownAt.current)),
      });
      if (!res.ok) {
        if (res.code === "limit" && res.resetsAtMs) {
          setBlocked({ resetsAtMs: res.resetsAtMs });
          return;
        }
        throw new Error(res.error);
      }
      setFeedback(res);
      setScore((s) => ({
        correct: s.correct + (res.correct ? 1 : 0),
        wrong: s.wrong + (res.correct ? 0 : 1),
        resolved: s.resolved + (res.resolved ? 1 : 0),
      }));
      setPhase("feedback");
    } catch {
      setError("Не получилось проверить ответ. Проверьте соединение и попробуйте ещё раз.");
      setPhase("answer");
    }
  }, [phase, ex, value]);

  const next = useCallback(() => {
    if (phase !== "feedback") return;
    if (index + 1 === total) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
    setValue(initialValue(items[index + 1]));
    setFeedback(null);
    setPhase("answer");
  }, [phase, index, total, items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const onControl = target?.tagName === "BUTTON" || target?.tagName === "A";
      if (e.key !== "Enter" || onControl || e.isComposing) return;
      e.preventDefault();
      if (phase === "answer") void check();
      else if (phase === "feedback") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, check, next]);

  if (blocked) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-8">
        <h1 className="text-3xl">Лимит практики на сегодня исчерпан</h1>
        <p className="text-lg">
          Повторение откроется через <Countdown resetsAtMs={blocked.resetsAtMs} />. PRO снимает дневной лимит.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/pricing">Смотреть тариф PRO</ButtonLink>
          <ButtonLink href="/app/mistakes" variant="secondary">
            К ошибкам
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Повторение завершено</h1>
          <p className="text-lg text-muted">
            Верно: {score.correct} из {total}
            {score.resolved > 0 && `. Усвоено навсегда: ${score.resolved}`}
          </p>
        </div>
        {score.wrong > 0 && (
          <p className="rounded-lg bg-xp-soft px-5 py-4">
            Ошибки, которые не получились, вернутся через несколько минут, остальные через дни: график подберёт Репетитор.
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/app/mistakes" size="lg">
            К ошибкам
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={() => window.location.reload()}>
            Повторить ещё
          </Button>
        </div>
      </div>
    );
  }

  const locked = phase !== "answer";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Link
          href="/app/mistakes"
          aria-label="Выйти из повторения"
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <Progress value={phase === "feedback" ? index + 1 : index} max={total} label="Прогресс повторения" className="flex-1" />
        <span className="shrink-0 text-sm font-medium text-muted">
          {index + 1} из {total}
        </span>
      </div>

      <ExerciseView key={ex.id} ex={ex} value={value} onChange={setValue} locked={locked} feedback={feedback} />

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col gap-3 rounded-lg p-4",
          feedback ? (feedback.correct ? "bg-success-soft" : "bg-danger-soft") : "",
        )}
      >
        {error && <p className="font-medium text-danger">{error}</p>}
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
            <p className="text-sm text-muted">
              {feedback.resolved ? "Ошибка усвоена." : `Следующее повторение: ${feedback.nextReview}.`}
            </p>
          </>
        )}
        {phase === "feedback" ? (
          <Button size="lg" onClick={next} className="w-full sm:w-fit">
            {index + 1 === total ? "Завершить" : "Дальше"}
          </Button>
        ) : (
          <Button size="lg" onClick={() => void check()} disabled={!ready} loading={phase === "checking"} className="w-full sm:w-fit">
            Проверить
          </Button>
        )}
      </div>
    </div>
  );
}
