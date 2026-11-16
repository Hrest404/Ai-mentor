import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export interface HistoryItem {
  id: string;
  /** Подпись: «Writing Task 2», «Speaking» и т.п. */
  kind: string;
  title: string;
  band: number;
  createdAtMs: number;
  wordCount: number | null;
  criteria: { label: string; value: number }[];
  improvements: string[];
  response: string;
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/** График баллов по времени: от старых проверок к новым. */
function Trend({ items }: { items: HistoryItem[] }) {
  const points = [...items].reverse().slice(-20);
  if (points.length < 2) return null;
  const W = 600;
  const H = 160;
  const pad = 24;
  const xs = (i: number) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const ys = (b: number) => H - pad - (b / 9) * (H - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.band).toFixed(1)}`).join(" ");
  const first = points[0].band;
  const last = points[points.length - 1].band;
  const diff = Math.round((last - first) * 10) / 10;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Динамика балла</h2>
        <Badge tone={diff > 0 ? "success" : diff < 0 ? "danger" : "neutral"}>
          {diff > 0 ? `+${diff}` : diff} с первой из показанных проверок
        </Badge>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Баллы за последние ${points.length} проверок: от ${first} до ${last}`} className="w-full">
        {[3, 5, 7, 9].map((g) => (
          <g key={g}>
            <line x1={pad} x2={W - pad} y1={ys(g)} y2={ys(g)} className="stroke-line" strokeWidth="1" />
            <text x={4} y={ys(g) + 4} className="fill-muted text-[11px]">
              {g}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-action" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.id} cx={xs(i)} cy={ys(p.band)} r="4" className="fill-action" />
        ))}
      </svg>
    </Card>
  );
}

export function IeltsHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="flex max-w-xl flex-col gap-2 p-8">
        <h2 className="text-xl">Пока нет проверок</h2>
        <p className="text-muted">Напишите работу во вкладке Writing или пройдите Speaking-сессию: результаты и динамика баллов появятся здесь.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Trend items={items} />
      <ul className="flex flex-col gap-4">
        {items.map((it) => (
          <li key={it.id}>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{it.title}</p>
                  <p className="text-sm text-muted">
                    {it.kind} · {dateFmt.format(new Date(it.createdAtMs))}
                    {it.wordCount ? ` · ${it.wordCount} слов` : ""}
                  </p>
                </div>
                <span className="text-3xl font-semibold text-action" aria-label={`Балл ${it.band}`}>
                  {it.band.toFixed(1)}
                </span>
              </div>
              <p className="flex flex-wrap gap-2">
                {it.criteria.map((c) => (
                  <Badge key={c.label}>
                    {c.label}: {c.value.toFixed(1)}
                  </Badge>
                ))}
              </p>
              <details className="group">
                <summary className="cursor-pointer font-medium text-action">Подробнее</summary>
                <div className="mt-3 flex flex-col gap-3">
                  {it.improvements.length > 0 && (
                    <ul className="list-disc pl-5">
                      {it.improvements.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  )}
                  <p lang="en" className="whitespace-pre-wrap rounded-md bg-surface-alt p-4">
                    {it.response}
                  </p>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
