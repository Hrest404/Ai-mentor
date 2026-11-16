"use client";

import { Fragment, useState, useTransition } from "react";
import { checkWriting, type WritingCheckResponse } from "@/app/app/(main)/pro/writing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/ai/tools";
import { WRITING_CHECK_MAX_CHARS } from "@/lib/ielts";

type Ok = Extract<WritingCheckResponse, { ok: true }>;

/** Текст с подсвеченными фрагментами: номер в метке совпадает с номером пояснения ниже. */
function Highlighted({ result }: { result: Ok }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  result.corrections.forEach((c, i) => {
    parts.push(<Fragment key={`t${i}`}>{result.text.slice(at, c.start)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className="rounded bg-danger-soft px-1 text-ink underline decoration-danger decoration-2 underline-offset-4">
        {result.text.slice(c.start, c.end)}
        <sup className="ml-0.5 text-xs font-medium text-danger">{i + 1}</sup>
      </mark>,
    );
    at = c.end;
  });
  parts.push(<Fragment key="rest">{result.text.slice(at)}</Fragment>);
  return (
    <p lang="en" className="whitespace-pre-wrap text-lg leading-relaxed">
      {parts}
    </p>
  );
}

export function WritingChecker() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<WritingCheckResponse | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function submit() {
    setResult(null);
    start(async () => {
      try {
        setResult(await checkWriting({ text }));
      } catch {
        setResult({ ok: false, code: "error", error: "Не получилось проверить текст. Проверьте соединение и попробуйте ещё раз." });
      }
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* буфер недоступен: текст можно выделить вручную */
    }
  }

  const tooLong = text.length > WRITING_CHECK_MAX_CHARS;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <label htmlFor="writing-text" className="text-base font-medium">
          Ваш текст на английском
        </label>
        <textarea
          id="writing-text"
          lang="en"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Напишите несколько предложений: письмо, ответ, рассказ о своём дне…"
          className="min-h-44 resize-y rounded-md border border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-muted hover:border-muted"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={tooLong ? "text-sm text-danger" : "text-sm text-muted"}>
            {text.length} из {WRITING_CHECK_MAX_CHARS} символов
          </p>
          <Button onClick={submit} loading={pending} disabled={text.trim().length < 3 || tooLong}>
            Проверить текст
          </Button>
        </div>
      </Card>

      {pending && <p role="status" className="text-muted">Проверяем текст, это занимает несколько секунд…</p>}

      {result && !result.ok && (
        <Card role="alert" className="border-danger">
          <p className="font-medium">{result.error}</p>
        </Card>
      )}

      {result?.ok && (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">Результат</h2>
              <Badge tone={result.corrections.length === 0 ? "success" : "xp"}>
                {result.corrections.length === 0 ? "Ошибок не найдено" : `Исправлений: ${result.corrections.length}`}
              </Badge>
            </div>
            <p className="text-muted">{result.summary}</p>
            <Highlighted result={result} />
          </Card>

          {result.corrections.length > 0 && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-xl">Что исправить</h2>
              <ol className="flex flex-col gap-4">
                {result.corrections.map((c, i) => (
                  <li key={`${c.start}-${i}`} className="flex flex-col gap-1 border-b border-line pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-danger">{i + 1}</span>
                      <span lang="en" className="text-lg">
                        <s className="text-muted">{c.original}</s> → <strong>{c.replacement || "(убрать)"}</strong>
                      </span>
                      <Badge>{CATEGORY_LABELS[c.category]}</Badge>
                    </div>
                    <p className="text-muted">{c.reason}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">Исправленный текст</h2>
              <Button variant="secondary" size="md" onClick={() => copy(result.corrected)}>
                {copied ? "Скопировано" : "Копировать"}
              </Button>
            </div>
            <p lang="en" className="whitespace-pre-wrap text-lg leading-relaxed">
              {result.corrected}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
