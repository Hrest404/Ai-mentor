"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { AppFrame } from "./app-frame";

interface Props {
  lessonTitle: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** Живой фрагмент урока: можно выбрать вариант и увидеть разбор. Данные взяты из реального курса. */
export function HeroDemo({ lessonTitle, prompt, options, answer, explanation }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === answer;

  return (
    <AppFrame title={lessonTitle} meta="Вопрос 1 из 5" progress={20}>
      <div className="flex flex-col gap-6">
        <p className="text-sm font-medium text-muted">Выберите верный вариант</p>
        <p lang="en" className="text-2xl font-medium tracking-tight">
          {prompt}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const isPicked = picked === o;
            const showRight = picked !== null && o === answer;
            return (
              <button
                key={o}
                type="button"
                lang="en"
                disabled={picked !== null}
                onClick={() => setPicked(o)}
                className={cn(
                  "min-h-12 rounded-md border px-4 text-left text-lg transition-colors active:translate-y-px",
                  picked === null && "border-line bg-surface hover:border-muted",
                  showRight && "border-success bg-success-soft",
                  isPicked && !correct && "border-danger bg-danger-soft",
                  picked !== null && !showRight && !isPicked && "border-line opacity-60",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-24 rounded-md px-4 py-3",
            picked === null ? "bg-surface-alt text-muted" : correct ? "bg-success-soft" : "bg-danger-soft",
          )}
        >
          {picked === null ? (
            "Нажмите на ответ, и появится разбор."
          ) : (
            <>
              <span className="font-medium">{correct ? "Верно. " : "Не совсем. "}</span>
              {explanation}
            </>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
