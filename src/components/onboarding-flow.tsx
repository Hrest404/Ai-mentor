"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeOnboarding } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

type Goal = "general" | "ielts";
type Question = { id: string; prompt: string; options: string[] };
type Step = "goal" | "choice" | "test" | "result";

const GOALS: { id: Goal; title: string; text: string }[] = [
  { id: "general", title: "Общий английский", text: "Грамматика, словарь и разговорная речь для жизни, работы и поездок." },
  { id: "ielts", title: "Подготовка к IELTS", text: "Те же основы плюс формат экзамена: Writing и Speaking с оценкой по критериям." },
];

const LEVEL_TEXT: Record<string, string> = {
  A1: "Начальный. Начнём с самых основ.",
  A2: "Элементарный. Базу вы знаете, закрепим и пойдём дальше.",
  B1: "Средний. Пора расширять грамматику и говорить свободнее.",
  B2: "Выше среднего. Будем шлифовать точность и стиль.",
  C1: "Продвинутый. Сосредоточимся на тонкостях и экзаменационном формате.",
};

/** Крупная кнопка-вариант: один стиль для выбора цели и для ответов теста. */
function OptionButton({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-14 rounded-lg border bg-surface px-5 py-4 text-left transition-[border-color,background-color,transform] active:translate-y-px",
        selected ? "border-action bg-action-soft" : "border-line hover:border-muted",
        className,
      )}
      {...props}
    />
  );
}

export function OnboardingFlow({ name, questions }: { name: string; questions: Question[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ level: string; score: number | null } | null>(null);

  async function finish(finalAnswers: Record<string, string> | null) {
    if (!goal) return;
    setSaving(true);
    setError(null);
    try {
      setResult(await completeOnboarding({ goal, answers: finalAnswers }));
      setStep("result");
    } catch {
      setError("Не получилось сохранить. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  function answer(option: string) {
    const q = questions[index];
    const next = { ...answers, [q.id]: option };
    setAnswers(next);
    if (index + 1 < questions.length) setIndex(index + 1);
    else void finish(next);
  }

  const errorNote = error && (
    <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
      {error}
    </p>
  );

  if (step === "goal") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">{name}, какая у вас цель?</h1>
          <p className="text-muted">От цели зависит программа. Её можно будет изменить в профиле.</p>
        </div>
        <div className="flex flex-col gap-3">
          {GOALS.map((g) => (
            <OptionButton key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)}>
              <span className="block text-lg font-semibold">{g.title}</span>
              <span className="block text-muted">{g.text}</span>
            </OptionButton>
          ))}
        </div>
        <Button size="lg" disabled={!goal} onClick={() => setStep("choice")}>
          Продолжить
        </Button>
      </div>
    );
  }

  if (step === "choice") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Определим ваш уровень</h1>
          <p className="text-muted">
            Короткий тест: {questions.length} вопросов, около трёх минут. Если не знаете ответ, выбирайте наугад.
          </p>
        </div>
        {errorNote}
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setStep("test")} disabled={saving}>
            Пройти тест
          </Button>
          <Button size="lg" variant="secondary" loading={saving} onClick={() => finish(null)}>
            Я начинаю с нуля
          </Button>
          <Button variant="ghost" onClick={() => setStep("goal")} disabled={saving}>
            Назад
          </Button>
        </div>
      </div>
    );
  }

  if (step === "test") {
    const q = questions[index];
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted">
            Вопрос {index + 1} из {questions.length}
          </p>
          <Progress value={index} max={questions.length} label="Прогресс теста" />
        </div>
        <h1 lang="en" className="text-2xl sm:text-3xl">
          {q.prompt}
        </h1>
        {errorNote}
        <div className="grid gap-3 sm:grid-cols-2">
          {q.options.map((option) => (
            <OptionButton
              key={option}
              lang="en"
              disabled={saving}
              selected={answers[q.id] === option}
              onClick={() => answer(option)}
              className="text-lg font-medium disabled:opacity-50"
            >
              {option}
            </OptionButton>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" disabled={index === 0 || saving} onClick={() => setIndex(index - 1)}>
            Назад
          </Button>
          {error && (
            <Button loading={saving} onClick={() => finish(answers)}>
              Повторить
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted">Ваш уровень</p>
        <h1 className="text-5xl">{result?.level}</h1>
        <p className="text-lg">{LEVEL_TEXT[result?.level ?? "A1"]}</p>
        {result?.score != null && (
          <p className="text-muted">
            Верных ответов: {result.score} из {questions.length}.
          </p>
        )}
      </div>
      <Button
        size="lg"
        onClick={() => {
          router.push("/app");
          router.refresh();
        }}
      >
        Перейти в кабинет
      </Button>
    </div>
  );
}
