"use client";

import { useState, useTransition } from "react";
import { getWeeklyReport, type ReportResponse } from "@/app/app/(main)/profile/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Еженедельный AI-отчёт. Запрос идёт по кнопке, а не при каждом открытии профиля: сохранённый отчёт показывается сразу, нового не создаётся без нужды. */
export function WeeklyReportView() {
  const [res, setRes] = useState<ReportResponse | null>(null);
  const [pending, start] = useTransition();

  function load(refresh: boolean) {
    start(async () => {
      try {
        setRes(await getWeeklyReport({ refresh }));
      } catch {
        setRes({ ok: false, code: "error", error: "Не получилось получить отчёт. Проверьте соединение и попробуйте ещё раз." });
      }
    });
  }

  if (pending) {
    return (
      <p role="status" className="text-muted">
        Готовим отчёт за неделю… Это занимает несколько секунд.
      </p>
    );
  }

  if (!res) {
    return (
      <Card className="flex max-w-xl flex-col gap-4 p-8">
        <h2 className="text-2xl">Отчёт за неделю</h2>
        <p className="text-muted">Репетитор разберёт ваши цифры за последние 7 дней и предложит план на следующую неделю.</p>
        <div>
          <Button onClick={() => load(false)}>Показать отчёт</Button>
        </div>
      </Card>
    );
  }

  if (!res.ok) {
    return (
      <Card role="alert" className="flex max-w-xl flex-col gap-4 border-danger">
        <p className="font-medium">{res.error}</p>
        {res.code !== "pro" && res.code !== "auth" && (
          <div>
            <Button variant="secondary" onClick={() => load(false)}>
              Повторить
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const { report } = res;
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl">Итоги недели</h2>
          <Badge>Составлен {dateFmt.format(new Date(res.generatedAtMs))}</Badge>
        </div>
        <p className="text-lg">{report.summary}</p>
      </Card>
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg text-success">Что получилось</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {report.wins.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg text-xp">На что обратить внимание</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {report.focus.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="flex flex-col gap-3">
        <h3 className="text-lg">План на следующую неделю</h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {report.plan.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>
      <div>
        <Button variant="secondary" onClick={() => load(true)}>
          Пересчитать отчёт
        </Button>
      </div>
    </div>
  );
}
