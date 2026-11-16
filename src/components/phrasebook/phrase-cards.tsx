"use client";

import { useEffect, useMemo, useState } from "react";
import { SpeakButton } from "@/components/lesson/speak-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PhraseView } from "@/lib/phrasebook";
import { shuffle } from "@/lib/phrasebook";

/**
 * Карточки для заучивания: на лицевой стороне английская фраза, на обороте перевод.
 * «Знаю» убирает карточку из колоды, «Ещё раз» отправляет в конец, пока все не выучены.
 */
export function PhraseCards({ phrases, onExit }: { phrases: PhraseView[]; onExit: () => void }) {
  const deck = useMemo(() => shuffle(phrases), [phrases]);
  const [queue, setQueue] = useState(deck);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [retries, setRetries] = useState(0);

  const card = queue[0];
  const total = deck.length;

  function answer(knew: boolean) {
    if (!card) return;
    setFlipped(false);
    if (knew) {
      setKnown((k) => k + 1);
      setQueue((q) => q.slice(1));
    } else {
      setRetries((r) => r + 1);
      setQueue((q) => [...q.slice(1), q[0]]);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        if (t?.tagName === "BUTTON") return; // у кнопок своё действие
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "ArrowRight") answer(true);
      else if (flipped && e.key === "ArrowLeft") answer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <Card className="flex flex-col gap-5 p-8">
        <h2 className="text-2xl">Колода пройдена</h2>
        <p className="text-muted">
          Выучено фраз: {known}. {retries > 0 ? `Возвращалось на повтор: ${retries}.` : "Ни одной не пришлось повторять."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => {
            setQueue(shuffle(phrases));
            setKnown(0);
            setRetries(0);
            setFlipped(false);
          }}>
            Ещё раз
          </Button>
          <Button variant="secondary" onClick={onExit}>
            К списку
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onExit}>
          Выйти
        </Button>
        <p className="text-muted">
          Выучено {known} из {total}
        </p>
      </div>
      <Progress value={known} max={total} label="Прогресс колоды" />

      <Card className="flex min-h-64 flex-col justify-between gap-6 p-8">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Показать фразу" : "Показать перевод"}
          className="flex flex-1 flex-col justify-center gap-3 text-left"
        >
          <span lang="en" className="text-3xl font-medium">
            {card.en}
          </span>
          {flipped ? (
            <span className="text-2xl text-action">{card.ru}</span>
          ) : (
            <span className="text-muted">Нажмите, чтобы увидеть перевод</span>
          )}
          {flipped && card.note && <span className="text-muted">{card.note}</span>}
        </button>
        <div className="flex flex-wrap gap-3">
          <SpeakButton text={card.en} label="Прослушать" />
          <SpeakButton text={card.en} rate={0.7} label="Медленнее" slow />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={() => answer(false)} disabled={!flipped}>
          Ещё раз
        </Button>
        <Button size="lg" onClick={() => answer(true)} disabled={!flipped}>
          Знаю
        </Button>
      </div>
      <p className="text-center text-sm text-muted">Пробел переворачивает карточку, стрелки влево и вправо: «Ещё раз» и «Знаю».</p>
    </div>
  );
}
