"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveIeltsGoals } from "@/app/app/(main)/pro/ielts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StudyPlan } from "@/lib/ielts";

const BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const INTENSITY = { light: "Лёгкий режим", regular: "Обычный режим", intense: "Интенсивный режим" } as const;
const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function StudyPlanView({
  examDate,
  targetBand,
  today,
  plan,
  currentBand,
  basedOnChecks,
  weakest,
}: {
  examDate: string | null;
  targetBand: number | null;
  today: string;
  plan: StudyPlan | null;
  currentBand: number;
  /** Текущий балл взят из проверок, а не из теста уровня. */
  basedOnChecks: boolean;
  weakest: { label: string; avg: number } | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(examDate ?? "");
  const [band, setBand] = useState(String(targetBand ?? 6.5));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const res = await saveIeltsGoals({ examDate: date, targetBand: Number(band) });
        if (!res.ok) setError(res.error);
        else router.refresh();
      } catch {
        setError("Не получилось сохранить. Проверьте соединение и попробуйте ещё раз.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Цель и дата экзамена</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="exam-date" className="text-base font-medium">
              Дата экзамена
            </label>
            <input
              id="exam-date"
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-11 rounded-md border border-line bg-surface px-4 text-base text-ink"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="target-band" className="text-base font-medium">
              Целевой балл
            </label>
            <select
              id="target-band"
              value={band}
              onChange={(e) => setBand(e.target.value)}
              className="min-h-11 rounded-md border border-line bg-surface px-4 text-base text-ink"
            >
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {b.toFixed(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div>
          <Button onClick={save} loading={pending} disabled={!date}>
            {plan ? "Пересчитать план" : "Составить план"}
          </Button>
        </div>
      </Card>

      {!plan && examDate && (
        <Card className="border-danger">
          <p className="font-medium">Дата экзамена уже прошла. Укажите новую, и план пересчитается.</p>
        </Card>
      )}

      {plan && (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="action">{plan.daysLeft === 0 ? "Экзамен сегодня" : `До экзамена ${plan.daysLeft} дн.`}</Badge>
              <Badge>{INTENSITY[plan.intensity]}</Badge>
              <Badge>
                {currentBand.toFixed(1)} → {targetBand?.toFixed(1)}
              </Badge>
            </div>
            <p className="text-muted">
              Текущий уровень {currentBand.toFixed(1)} взят {basedOnChecks ? "из ваших последних проверок" : "по результату теста уровня, пока проверок нет"}.
              {plan.gap === 0 ? " Цель уже достигнута, план поддерживает форму." : ` До цели ${plan.gap.toFixed(1)}.`}
            </p>
            {weakest && (
              <p>
                Слабее всего критерий «{weakest.label}» (в среднем {weakest.avg.toFixed(1)}): уделите ему больше времени.
              </p>
            )}
            {plan.warning && (
              <p role="note" className="rounded-md bg-xp-soft px-4 py-3 text-xp">
                {plan.warning}
              </p>
            )}
          </Card>

          <ol className="flex flex-col gap-4">
            {plan.weeks.map((w) => (
              <li key={w.week}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg">
                      Неделя {w.week}: {w.focus}
                    </h3>
                    <span className="text-sm text-muted">с {dateFmt.format(new Date(`${w.start}T00:00:00`))}</span>
                  </div>
                  <ul className="list-disc pl-5">
                    {w.tasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ol>
          {plan.weeksLeft > plan.weeks.length && <p className="text-muted">Показаны первые {plan.weeks.length} недель из {plan.weeksLeft}.</p>}
        </>
      )}
    </div>
  );
}
