import Link from "next/link";
import type { Theory } from "@/content/types";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "./speak-button";
import { TheoryComplete } from "./theory-complete";

/** Экран теории перед темой: правило, примеры с озвучкой, таблицы и частые ошибки. */
export function TheoryView({
  lessonId,
  topicTitle,
  topicTitleRu,
  theory,
  isRevisit,
}: {
  lessonId: string;
  topicTitle: string;
  topicTitleRu: string;
  theory: Theory;
  isRevisit: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-4">
      <header className="flex items-center gap-4">
        <Link
          href="/app/learn"
          aria-label="К карте курса"
          className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
        <p className="text-sm font-medium text-muted">Теория</p>
      </header>

      <div className="flex flex-col gap-4">
        <h1 lang="en" className="text-4xl sm:text-5xl">
          {topicTitle}
        </h1>
        <p className="text-xl text-muted">{topicTitleRu}</p>
        <p className="text-lg">{theory.intro}</p>
      </div>

      {theory.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-4">
          <h2 className="text-2xl sm:text-3xl">{section.heading}</h2>
          <p className="text-lg">{section.body}</p>

          {section.examples.length > 0 && (
            <ul className="flex flex-col">
              {section.examples.map((e) => (
                <li key={e.en} className="flex items-center gap-4 border-b border-line py-3 first:border-t">
                  <SpeakButton text={e.en} label="" className="size-12 min-h-12 shrink-0 justify-center px-0 [&>svg]:size-5" />
                  <span className="min-w-0">
                    <span lang="en" className="block text-lg font-medium">
                      {e.en}
                    </span>
                    <span className="block text-muted">{e.ru}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {section.table && (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-alt">
                    {section.table.headers.map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-sm font-medium text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr key={row.join("|")} className="border-t border-line">
                      {row.map((cell, i) => (
                        <td key={i} lang={i > 0 && /[a-z]/i.test(cell) && !/[а-яё]/i.test(cell) ? "en" : undefined} className="px-4 py-3">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {theory.tips.length > 0 && (
        <Card className="flex flex-col gap-3 bg-xp-soft">
          <h2 className="text-xl">Запомните</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {theory.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      )}

      <TheoryComplete lessonId={lessonId} isRevisit={isRevisit} />
    </div>
  );
}
