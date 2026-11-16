import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface BandCriterion {
  key: string;
  label: string;
}

/** Результат проверки IELTS: общий балл, баллы по критериям с обоснованием, сильные стороны и советы. */
export function BandResult({
  band,
  criteria,
  comments,
  labels,
  strengths,
  improvements,
  improved,
  note,
}: {
  band: number;
  criteria: Record<string, number>;
  comments: Record<string, string>;
  labels: readonly BandCriterion[];
  strengths: string[];
  improvements: string[];
  improved?: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Ориентировочный общий балл</p>
            <p className="text-5xl font-semibold text-action" aria-label={`Балл ${band} из 9`}>
              {band.toFixed(1)}
            </p>
          </div>
          <Badge tone="xp">Оценка ИИ, не официальный результат</Badge>
        </div>
        <ul className="flex flex-col gap-5">
          {labels.map((l) => (
            <li key={l.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{l.label}</span>
                <span className="font-semibold">{(criteria[l.key] ?? 0).toFixed(1)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
                <div className="h-full rounded-full bg-action" style={{ width: `${((criteria[l.key] ?? 0) / 9) * 100}%` }} />
              </div>
              <p className="text-muted">{comments[l.key]}</p>
            </li>
          ))}
        </ul>
        {note && <p className="text-sm text-muted">{note}</p>}
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg text-success">Что получилось</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg text-xp">Что улучшить</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>

      {improved && (
        <Card className="flex flex-col gap-3">
          <h3 className="text-lg">Улучшенная версия</h3>
          <p lang="en" className="whitespace-pre-wrap text-lg leading-relaxed">
            {improved}
          </p>
        </Card>
      )}
    </div>
  );
}
