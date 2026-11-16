"use client";

import { useMemo, useState, useTransition } from "react";
import { setFavorite } from "@/app/app/(main)/phrasebook/actions";
import { SpeakButton } from "@/components/lesson/speak-button";
import { PhraseCards } from "@/components/phrasebook/phrase-cards";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { searchPhrases, type PhraseView, type SituationView } from "@/lib/phrasebook";

type View = { kind: "home" } | { kind: "situation"; id: string } | { kind: "favorites" };

function Star({ on }: { on: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}

function PhraseRow({
  phrase,
  favorite,
  onToggle,
  situationTitle,
}: {
  phrase: PhraseView;
  favorite: boolean;
  onToggle: (p: PhraseView) => void;
  situationTitle?: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-4 first:border-t">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p lang="en" className="text-lg font-medium">
          {phrase.en}
        </p>
        <p className="text-muted">{phrase.ru}</p>
        {phrase.note && <p className="text-sm text-muted">{phrase.note}</p>}
        {situationTitle && <Badge className="mt-1 w-fit">{situationTitle}</Badge>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <SpeakButton text={phrase.en} label="" className="size-11 min-h-11 justify-center px-0 [&>svg]:size-5" />
        <SpeakButton text={phrase.en} rate={0.7} label="" slow className="size-11 min-h-11 justify-center px-0 [&>svg]:size-5" />
        <button
          type="button"
          onClick={() => onToggle(phrase)}
          aria-pressed={favorite}
          aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-md border border-line transition-colors hover:bg-surface-alt",
            favorite ? "bg-xp-soft text-xp" : "bg-surface text-muted",
          )}
        >
          <Star on={favorite} />
        </button>
      </div>
    </li>
  );
}

export function PhrasebookClient({
  situations,
  initialFavorites,
  isPro,
}: {
  situations: SituationView[];
  initialFavorites: string[];
  isPro: boolean;
}) {
  const [view, setView] = useState<View>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() => new Set(initialFavorites));
  const [cards, setCards] = useState<PhraseView[] | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();

  const all = useMemo(() => situations.flatMap((s) => s.phrases), [situations]);
  const titleOf = useMemo(() => new Map(situations.map((s) => [s.id, s.title])), [situations]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchPhrases(all, query) : []), [all, query, searching]);
  const favoritePhrases = useMemo(() => all.filter((p) => favorites.has(p.id)), [all, favorites]);

  function toggle(p: PhraseView) {
    const next = !favorites.has(p.id);
    // Сразу показываем результат; при отказе сервера откатываем.
    setFavorites((prev) => {
      const s = new Set(prev);
      if (next) s.add(p.id);
      else s.delete(p.id);
      return s;
    });
    startTransition(async () => {
      let ok = false;
      let message = "Не получилось сохранить. Проверьте соединение.";
      try {
        const res = await setFavorite({ phraseId: p.id, favorite: next });
        ok = res.ok;
        if (!res.ok) message = res.error;
      } catch {
        /* сеть: сообщение по умолчанию */
      }
      if (!ok) {
        setFavorites((prev) => {
          const s = new Set(prev);
          if (next) s.delete(p.id);
          else s.add(p.id);
          return s;
        });
        toast(message, "danger");
      }
    });
  }

  if (cards) return <PhraseCards phrases={cards} onExit={() => setCards(null)} />;

  const current = view.kind === "situation" ? situations.find((s) => s.id === view.id) : null;
  const listed: PhraseView[] = searching ? results : view.kind === "favorites" ? favoritePhrases : (current?.phrases ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="phrase-search" className="text-base font-medium">
          Поиск по фразам
        </label>
        <input
          id="phrase-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="По-русски или по-английски: «заказать», «bill»"
          className="min-h-12 rounded-md border border-line bg-surface px-4 text-base text-ink placeholder:text-muted hover:border-muted"
        />
        {!isPro && <p className="text-sm text-muted">Поиск идёт по открытым ситуациям. Остальные ситуации доступны в PRO.</p>}
      </div>

      {!searching && (
        <div role="tablist" aria-label="Раздел разговорника" className="flex flex-wrap gap-2 border-b border-line">
          {[
            { kind: "home" as const, label: "Ситуации", on: view.kind !== "favorites" },
            { kind: "favorites" as const, label: `Избранное${favorites.size ? ` (${favorites.size})` : ""}`, on: view.kind === "favorites" },
          ].map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={t.on}
              onClick={() => setView({ kind: t.kind })}
              className={cn(
                "min-h-11 border-b-2 px-4 font-medium transition-colors",
                t.on ? "border-action text-action" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {!searching && view.kind === "home" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {situations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => (s.locked ? null : setView({ kind: "situation", id: s.id }))}
              aria-disabled={s.locked}
              className={cn(
                "rounded-lg border border-line bg-surface p-5 text-left shadow-card",
                s.locked ? "cursor-default opacity-90" : "lift hover:bg-surface-alt",
              )}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-lg font-medium">{s.title}</span>
                {s.locked ? <Badge tone="action">PRO</Badge> : <Badge>{s.count} фраз</Badge>}
              </span>
              <span className="mt-1 block text-muted">{s.description}</span>
              {s.locked && <span className="mt-2 block text-sm text-muted">{s.count} фраз откроются в PRO</span>}
            </button>
          ))}
          {!isPro && (
            <Card className="flex flex-col justify-between gap-3 sm:col-span-2">
              <p>Открыто 2 ситуации из {situations.length}. В PRO доступны все ситуации разговорника.</p>
              <ButtonLink href="/pricing" className="w-fit">
                Смотреть тариф PRO
              </ButtonLink>
            </Card>
          )}
        </div>
      )}

      {(searching || view.kind !== "home") && (
        <section className="flex flex-col gap-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {!searching && view.kind === "situation" && (
                <Button variant="ghost" className="-ml-3 w-fit" onClick={() => setView({ kind: "home" })}>
                  Все ситуации
                </Button>
              )}
              <h2 className="text-2xl">
                {searching ? `Найдено: ${results.length}` : view.kind === "favorites" ? "Избранное" : current?.title}
              </h2>
            </div>
            {listed.length > 0 && (
              <Button variant="secondary" onClick={() => setCards(listed)}>
                Карточки ({listed.length})
              </Button>
            )}
          </div>

          {listed.length === 0 ? (
            <p className="text-muted">
              {searching
                ? "Ничего не нашлось. Попробуйте другое слово или перевод."
                : view.kind === "favorites"
                  ? "Здесь появятся фразы, которые вы отметите звёздочкой."
                  : "В этой ситуации пока нет фраз."}
            </p>
          ) : (
            <ul>
              {listed.map((p) => (
                <PhraseRow
                  key={p.id}
                  phrase={p}
                  favorite={favorites.has(p.id)}
                  onToggle={toggle}
                  situationTitle={searching || view.kind === "favorites" ? titleOf.get(p.situationId) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
