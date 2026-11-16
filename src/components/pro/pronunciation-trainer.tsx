"use client";

import { useState, useTransition } from "react";
import { getPronunciationTips, type PronunciationTipsResponse } from "@/app/app/(main)/pro/pronunciation/actions";
import { SpeakButton } from "@/components/lesson/speak-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { useSpeechRecognition } from "@/lib/use-speech";

export interface PhraseSituation {
  id: string;
  title: string;
  phrases: string[];
}

const CUSTOM_MAX = 200;

const WORD_STYLE = {
  ok: "bg-success-soft text-success",
  wrong: "bg-danger-soft text-danger",
  missed: "bg-xp-soft text-xp",
} as const;
const WORD_HINT = { ok: "верно", wrong: "распознано иначе", missed: "не услышано" } as const;

export function PronunciationTrainer({ situations }: { situations: PhraseSituation[] }) {
  const [situationId, setSituationId] = useState(situations[0]?.id ?? "");
  const [phrase, setPhrase] = useState(situations[0]?.phrases[0] ?? "");
  const [custom, setCustom] = useState("");
  const [response, setResponse] = useState<PronunciationTipsResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const speech = useSpeechRecognition();

  const situation = situations.find((s) => s.id === situationId);
  const reference = custom.trim() || phrase;

  function chooseSituation(id: string) {
    setSituationId(id);
    setPhrase(situations.find((s) => s.id === id)?.phrases[0] ?? "");
    reset();
  }

  function reset() {
    setResponse(null);
  }

  function finish() {
    speech.stop();
  }

  // Результат считаем, когда запись закончилась и есть что сравнивать.
  const spoken = speech.transcript;
  function check() {
    setResponse(null);
    startTransition(async () => {
      try {
        setResponse(await getPronunciationTips({ reference, spoken }));
      } catch {
        setResponse({ ok: false, code: "error", error: "Не получилось проверить. Проверьте соединение и попробуйте ещё раз." });
      }
    });
  }

  if (!speech.supported) {
    return (
      <Card className="flex max-w-xl flex-col gap-3 p-8">
        <h2 className="text-xl">Нужен другой браузер</h2>
        <p className="text-muted">
          Проверка произношения использует распознавание речи браузера. Оно работает в Chrome, Edge и Safari, а в Firefox его нет. Откройте эту
          страницу в одном из них.
        </p>
        <p className="text-muted">Озвучку фраз и остальные инструменты Репетитора можно использовать в любом браузере.</p>
      </Card>
    );
  }

  const done = !speech.listening && spoken.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="situation" className="text-base font-medium">
            Ситуация
          </label>
          <select
            id="situation"
            value={situationId}
            onChange={(e) => chooseSituation(e.target.value)}
            className="min-h-11 rounded-md border border-line bg-surface px-4 text-base text-ink"
          >
            {situations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div role="radiogroup" aria-label="Фраза" className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {situation?.phrases.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={!custom.trim() && phrase === p}
              onClick={() => {
                setPhrase(p);
                setCustom("");
                reset();
              }}
              lang="en"
              className={cn(
                "min-h-11 rounded-md border px-4 py-2 text-left text-base transition-colors",
                !custom.trim() && phrase === p ? "border-action bg-action-soft" : "border-line bg-surface hover:bg-surface-alt",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="custom-phrase" className="text-base font-medium">
            Или своя фраза
          </label>
          <input
            id="custom-phrase"
            lang="en"
            value={custom}
            maxLength={CUSTOM_MAX}
            onChange={(e) => {
              setCustom(e.target.value);
              reset();
            }}
            placeholder="Например: I would like a table for two"
            className="min-h-11 rounded-md border border-line bg-surface px-4 text-base text-ink placeholder:text-muted hover:border-muted"
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Скажите вслух</p>
          <p lang="en" className="text-2xl font-medium">
            {reference || "Выберите фразу"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SpeakButton text={reference} label="Эталон" />
          <SpeakButton text={reference} rate={0.7} label="Медленнее" slow />
          {speech.listening ? (
            <Button variant="danger" size="lg" onClick={finish}>
              Остановить запись
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => {
                reset();
                speech.start();
              }}
              disabled={!reference}
            >
              {done ? "Записать ещё раз" : "Начать запись"}
            </Button>
          )}
        </div>

        {(speech.listening || spoken || speech.interim) && (
          <div aria-live="polite" className="rounded-md bg-surface-alt px-4 py-3">
            <p className="mb-1 text-sm text-muted">{speech.listening ? "Слушаю…" : "Распознано"}</p>
            <p lang="en" className="text-lg">
              {spoken} <span className="text-muted">{speech.interim}</span>
            </p>
          </div>
        )}
        {speech.error && (
          <p role="alert" className="text-danger">
            {speech.error}
          </p>
        )}
        {done && !response && (
          <div>
            <Button onClick={check} loading={pending}>
              Проверить произношение
            </Button>
          </div>
        )}
      </Card>

      {response && !response.ok && (
        <Card role="alert" className="border-danger">
          <p className="font-medium">{response.error}</p>
        </Card>
      )}

      {response?.ok && (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl">Результат</h2>
            <Badge tone={response.result.accuracy >= 90 ? "success" : response.result.accuracy >= 60 ? "xp" : "danger"}>
              Точность {response.result.accuracy}%
            </Badge>
          </div>
          <p lang="en" className="flex flex-wrap gap-x-2 gap-y-2 text-xl">
            {response.result.words.map((w, i) => (
              <span
                key={`${w.word}-${i}`}
                title={WORD_HINT[w.status]}
                className={cn("rounded-md px-2 py-0.5", WORD_STYLE[w.status])}
              >
                {w.word}
                <span className="sr-only"> ({WORD_HINT[w.status]})</span>
              </span>
            ))}
          </p>
          <p className="flex flex-wrap gap-3 text-sm text-muted">
            <span className="text-success">Зелёный: верно</span>
            <span className="text-danger">красный: распознано иначе</span>
            <span className="text-xp">жёлтый: не услышано</span>
          </p>
          {response.result.words.some((w) => w.heard) && (
            <ul className="text-muted">
              {response.result.words
                .filter((w) => w.heard)
                .map((w, i) => (
                  <li key={`${w.word}-${i}`} lang="en">
                    {w.word}: услышано «{w.heard}»
                  </li>
                ))}
            </ul>
          )}
          {response.result.extra.length > 0 && <p className="text-muted">Лишние слова: {response.result.extra.join(", ")}</p>}
          {response.result.accuracy === 100 && <p className="font-medium text-success">Все слова распознаны верно.</p>}

          {response.tips && (
            <div className="flex flex-col gap-3 border-t border-line pt-5">
              <h3 className="text-lg">Советы</h3>
              <p className="text-muted">{response.tips.summary}</p>
              <ul className="flex flex-col gap-4">
                {response.tips.tips.map((t) => (
                  <li key={t.word} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <strong lang="en" className="text-lg">
                        {t.word}
                      </strong>
                      {t.transcription && <span className="text-muted">{t.transcription}</span>}
                      <SpeakButton text={t.word} label="" className="size-11 min-h-11 justify-center px-0 [&>svg]:size-5" />
                    </div>
                    <p>{t.tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {response.tipsError && <p className="text-muted">Советы AI сейчас недоступны: {response.tipsError}</p>}
          <p className="text-sm text-muted">
            Браузер распознаёт речь сам и может ошибаться, особенно с акцентом и шумом. Относитесь к результату как к подсказке, а не к приговору.
          </p>
        </Card>
      )}
    </div>
  );
}
