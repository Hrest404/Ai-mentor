"use client";

import Link from "next/link";
import { useState } from "react";
import { explainMistake, type ExplainResponse } from "@/app/app/(main)/mistakes/actions";
import { Countdown } from "@/components/gate/countdown";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Explanation, SimilarTask } from "@/lib/ai/explain";
import { cn } from "@/lib/cn";

type Failure = Extract<ExplainResponse, { ok: false }>;

/** Мини-задание: ответ проверяется на месте, ответ модели не секрет. */
function SimilarTaskCard({ task, index }: { task: SimilarTask; index: number }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <p lang="en" className="text-lg font-medium">
        {index + 1}. {task.prompt}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {task.options.map((o) => {
          const right = done && o === task.answer;
          const wrong = done && o === picked && o !== task.answer;
          return (
            <button
              key={o}
              type="button"
              lang="en"
              disabled={done}
              onClick={() => setPicked(o)}
              className={cn(
                "min-h-12 rounded-md border px-3 text-left transition-colors active:translate-y-px disabled:cursor-default",
                right ? "border-success bg-success-soft" : wrong ? "border-danger bg-danger-soft" : "border-line hover:border-muted",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      {done && (
        <p role="status" className={cn("text-base", picked === task.answer ? "text-success" : "text-danger")}>
          <span className="font-medium">{picked === task.answer ? "Верно. " : "Неверно. "}</span>
          <span className="text-ink">{task.explanation}</span>
        </p>
      )}
    </li>
  );
}

export function ExplanationPanel({ data, left }: { data: Explanation; left: number | null }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-xl">Почему так</h3>
        <p>{data.why}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-xl">Правило</h3>
        <p>{data.rule}</p>
        <p className="rounded-md bg-surface-alt px-4 py-3">
          <span lang="en" className="block font-medium">
            {data.example.en}
          </span>
          <span className="block text-muted">{data.example.ru}</span>
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-xl">Потренируйтесь</h3>
        <ul className="flex flex-col gap-3">
          {data.similar.map((t, i) => (
            <SimilarTaskCard key={t.prompt} task={t} index={i} />
          ))}
        </ul>
      </section>
      {left !== null && <p className="text-sm text-muted">Осталось AI-разборов на сегодня: {left}</p>}
    </div>
  );
}

/**
 * Кнопка «Объяснить подробнее»: просит у сервера разбор ошибки и показывает его в окне.
 * Повторное открытие уже полученного разбора лимит не тратит.
 */
export function ExplainButton({
  exerciseId,
  variant = "secondary",
  label = "Объяснить подробнее",
  className,
}: {
  exerciseId: string;
  variant?: "secondary" | "ghost";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ explanation: Explanation; left: number | null } | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function load() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    setFailure(null);
    try {
      const res = await explainMistake({ exerciseId });
      if (res.ok) setData({ explanation: res.explanation, left: res.left });
      else setFailure(res);
    } catch {
      setFailure({ ok: false, code: "busy", error: "Не получилось связаться с сервером. Проверьте соединение и повторите." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={load} className={className}>
        <span aria-hidden className="rounded-sm bg-action-soft px-1.5 text-[13px] text-action">
          AI
        </span>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Разбор ошибки" className="w-[min(94vw,40rem)]">
        {loading && (
          <p role="status" className="flex items-center gap-3 py-6 text-lg">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-action border-t-transparent" />
            Разбираем ответ…
          </p>
        )}
        {data && <ExplanationPanel data={data.explanation} left={data.left} />}
        {failure && (
          <div className="flex flex-col gap-4 py-2">
            <p role="alert" className="text-lg font-medium">
              {failure.error}
            </p>
            {failure.code === "limit" && failure.resetsAtMs && (
              <p>
                Новые разборы откроются через <Countdown resetsAtMs={failure.resetsAtMs} />. В PRO разборов без ограничений.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              {failure.code === "limit" ? (
                <Link
                  href="/pricing"
                  className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-action px-5 font-medium text-action-ink transition-colors hover:bg-action-hover"
                >
                  Смотреть тариф PRO
                </Link>
              ) : (
                failure.code !== "no-mistake" && (
                  <Button type="button" onClick={load}>
                    Повторить
                  </Button>
                )
              )}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
