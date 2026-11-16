"use client";

import { useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { ClientExercise } from "@/lib/exercise-view";
import { SpeakButton } from "./speak-button";

/** Ответ в состоянии плеера: строка, id слов в выбранном порядке или пары «левое → правое». */
export type AnswerValue = string | number[] | Record<string, string>;

export interface ExerciseFeedback {
  correct: boolean;
  correctAnswer: string;
}

export function initialValue(ex: ClientExercise): AnswerValue {
  switch (ex.kind) {
    case "build_sentence":
      return [];
    case "match_pairs":
      return {};
    default:
      return "";
  }
}

export function isReady(ex: ClientExercise, value: AnswerValue): boolean {
  switch (ex.kind) {
    case "choice":
    case "listening":
    case "fill_blank":
    case "translate":
    case "dictation":
      return typeof value === "string" && value.trim().length > 0;
    case "build_sentence":
      return Array.isArray(value) && value.length > 0;
    case "match_pairs":
      return !Array.isArray(value) && typeof value === "object" && Object.keys(value).length === ex.left.length;
  }
}

/** То, что отправляется на проверку: слова вместо id, пары как есть. */
export function toServerAnswer(ex: ClientExercise, value: AnswerValue): string | string[] | Record<string, string> {
  if (ex.kind === "build_sentence" && Array.isArray(value)) {
    const byId = new Map(ex.tokens.map((t) => [t.id, t.text]));
    return value.map((id) => byId.get(id) ?? "");
  }
  return value as string | Record<string, string>;
}

/** Короткое описание задания для списка ошибок. */
export function promptText(ex: ClientExercise): string {
  switch (ex.kind) {
    case "choice":
      return ex.prompt;
    case "fill_blank":
      return ex.sentence;
    case "build_sentence":
    case "translate":
      return ex.ru;
    case "listening":
      return ex.question;
    case "dictation":
      return "Диктант";
    case "match_pairs":
      return ex.instruction;
  }
}

/** Вариант ответа: одна форма для выбора, аудирования и банка слов. */
function Option({
  selected,
  state,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; state?: "right" | "wrong" | null }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-14 rounded-lg border px-5 py-3 text-left text-lg transition-[border-color,background-color,transform] active:translate-y-px",
        state === "right"
          ? "border-success bg-success-soft"
          : state === "wrong"
            ? "border-danger bg-danger-soft"
            : selected
              ? "border-action bg-action-soft"
              : "border-line bg-surface hover:border-muted",
        "disabled:cursor-default",
        className,
      )}
      {...props}
    />
  );
}

const inputClass = (fb: ExerciseFeedback | null) =>
  cn(
    "min-h-14 w-full rounded-lg border bg-surface px-4 text-xl transition-colors",
    fb ? (fb.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-line hover:border-muted",
  );

const textFieldProps = {
  lang: "en",
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

interface Props {
  ex: ClientExercise;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  locked: boolean;
  feedback: ExerciseFeedback | null;
}

function Options({
  options,
  value,
  onChange,
  locked,
  feedback,
}: { options: string[] } & Omit<Props, "ex" | "value"> & { value: string }) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Варианты ответа">
      {options.map((o, i) => {
        const isPicked = value === o;
        // Верный вариант подсвечиваем после проверки: он известен из ответа сервера.
        const state = feedback ? (o === feedback.correctAnswer ? "right" : isPicked ? "wrong" : null) : null;
        return (
          <Option
            key={o}
            lang="en"
            selected={isPicked}
            state={state}
            disabled={locked}
            onClick={() => onChange(o)}
          >
            <span aria-hidden className="mr-3 inline-grid size-7 place-items-center rounded-md border border-line text-sm text-muted">
              {i + 1}
            </span>
            {o}
          </Option>
        );
      })}
    </div>
  );
}

export function ExerciseView({ ex, value, onChange, locked, feedback }: Props) {
  switch (ex.kind) {
    case "choice":
      return (
        <div className="flex flex-col gap-8">
          <h1 lang="en" className="text-2xl font-medium tracking-tight sm:text-3xl">
            {ex.prompt}
          </h1>
          <Options options={ex.options} value={value as string} onChange={onChange} locked={locked} feedback={feedback} />
        </div>
      );

    case "listening":
      return (
        <div className="flex flex-col gap-8">
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{ex.question}</h1>
          <div className="flex flex-wrap gap-3">
            <SpeakButton text={ex.audio} label="Прослушать" />
            <SpeakButton text={ex.audio} rate={0.7} slow label="Медленнее" />
          </div>
          <Options options={ex.options} value={value as string} onChange={onChange} locked={locked} feedback={feedback} />
        </div>
      );

    case "fill_blank": {
      const [before, after] = ex.sentence.split("___");
      return (
        <div className="flex flex-col gap-8">
          <p className="text-sm font-medium text-muted">Вставьте пропущенное слово</p>
          <h1 lang="en" className="flex flex-wrap items-center gap-x-3 gap-y-3 text-2xl font-medium tracking-tight sm:text-3xl">
            {before && <span>{before.trim()}</span>}
            <input
              {...textFieldProps}
              aria-label="Пропущенное слово"
              autoFocus
              disabled={locked}
              value={value as string}
              onChange={(e) => onChange(e.target.value)}
              className={cn(inputClass(feedback), "w-44 min-h-12 px-3 text-center text-2xl sm:w-56")}
            />
            {after && <span>{after.trim()}</span>}
          </h1>
        </div>
      );
    }

    case "translate":
      return (
        <div className="flex flex-col gap-8">
          <p className="text-sm font-medium text-muted">Переведите на английский</p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{ex.ru}</h1>
          <input
            {...textFieldProps}
            aria-label="Перевод на английский"
            autoFocus
            disabled={locked}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Напишите по-английски"
            className={inputClass(feedback)}
          />
        </div>
      );

    case "dictation":
      return (
        <div className="flex flex-col gap-8">
          <p className="text-sm font-medium text-muted">Напишите то, что услышите</p>
          <div className="flex flex-wrap gap-3">
            <SpeakButton text={ex.audio} label="Прослушать" />
            <SpeakButton text={ex.audio} rate={0.7} slow label="Медленнее" />
          </div>
          <input
            {...textFieldProps}
            aria-label="Услышанное предложение"
            autoFocus
            disabled={locked}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Напишите по-английски"
            className={inputClass(feedback)}
          />
        </div>
      );

    case "build_sentence": {
      const chosen = Array.isArray(value) ? value : [];
      const byId = new Map(ex.tokens.map((t) => [t.id, t.text]));
      const bank = ex.tokens.filter((t) => !chosen.includes(t.id));
      return (
        <div className="flex flex-col gap-8">
          <p className="text-sm font-medium text-muted">Соберите предложение из слов</p>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{ex.ru}</h1>
          <div
            aria-label="Ваше предложение"
            className={cn(
              "flex min-h-20 flex-wrap items-center gap-2 rounded-lg border-2 border-dashed p-3",
              feedback ? (feedback.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-line",
            )}
          >
            {chosen.length === 0 && <span className="px-2 text-muted">Нажимайте на слова ниже</span>}
            {chosen.map((id) => (
              <Option
                key={id}
                lang="en"
                disabled={locked}
                onClick={() => onChange(chosen.filter((x) => x !== id))}
                className="min-h-12 px-4 py-2"
              >
                {byId.get(id)}
              </Option>
            ))}
          </div>
          <div aria-label="Слова для сборки" className="flex flex-wrap gap-2">
            {bank.map((t) => (
              <Option
                key={t.id}
                lang="en"
                disabled={locked}
                onClick={() => onChange([...chosen, t.id])}
                className="min-h-12 px-4 py-2"
              >
                {t.text}
              </Option>
            ))}
          </div>
        </div>
      );
    }

    case "match_pairs":
      return <MatchPairs ex={ex} value={value as Record<string, string>} onChange={onChange} locked={locked} />;
  }
}

function MatchPairs({
  ex,
  value,
  onChange,
  locked,
}: {
  ex: Extract<ClientExercise, { kind: "match_pairs" }>;
  value: Record<string, string>;
  onChange: (v: AnswerValue) => void;
  locked: boolean;
}) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const leftOfRight = (r: string) => Object.keys(value).find((l) => value[l] === r);

  function clickLeft(l: string) {
    if (value[l] !== undefined) {
      const { [l]: _removed, ...rest } = value;
      void _removed;
      onChange(rest);
      setSelectedLeft(l);
    } else setSelectedLeft(selectedLeft === l ? null : l);
  }

  function clickRight(r: string) {
    const owner = leftOfRight(r);
    if (owner !== undefined) {
      const { [owner]: _removed, ...rest } = value;
      void _removed;
      onChange(rest);
      setSelectedLeft(owner);
      return;
    }
    if (selectedLeft !== null) {
      onChange({ ...value, [selectedLeft]: r });
      setSelectedLeft(null);
    }
  }

  const badge = (n: number) => (
    <span aria-hidden className="mr-3 inline-grid size-7 place-items-center rounded-full bg-action text-sm font-medium text-action-ink">
      {n}
    </span>
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{ex.instruction}</h1>
      <p className="text-muted">Выберите слово слева, затем пару справа. Нажмите на пару ещё раз, чтобы разъединить.</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex flex-col gap-3" role="group" aria-label="Слова">
          {ex.left.map((l, i) => (
            <Option
              key={l}
              lang="en"
              disabled={locked}
              selected={selectedLeft === l || value[l] !== undefined}
              onClick={() => clickLeft(l)}
              aria-label={value[l] !== undefined ? `${l}, пара ${i + 1}: ${value[l]}` : l}
            >
              {value[l] !== undefined && badge(i + 1)}
              {l}
            </Option>
          ))}
        </div>
        <div className="flex flex-col gap-3" role="group" aria-label="Пары">
          {ex.right.map((r) => {
            const owner = leftOfRight(r);
            return (
              <Option
                key={r}
                lang="en"
                disabled={locked}
                selected={owner !== undefined}
                onClick={() => clickRight(r)}
                aria-label={owner !== undefined ? `${r}, пара ${ex.left.indexOf(owner) + 1}: ${owner}` : r}
              >
                {owner !== undefined && badge(ex.left.indexOf(owner) + 1)}
                {r}
              </Option>
            );
          })}
        </div>
      </div>
    </div>
  );
}
