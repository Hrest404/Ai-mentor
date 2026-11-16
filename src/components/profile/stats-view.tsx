import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProfileData } from "@/lib/profile-data";

const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const dayLabel = (iso: string) => shortDate.format(new Date(`${iso}T12:00:00Z`));

function Total({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </Card>
  );
}

function ActivityChart({ data }: { data: ProfileData["activity"] }) {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  const active = data.filter((d) => d.answers > 0).length;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl">Активность за 30 дней</h2>
        <p className="text-muted">Дней с занятиями: {active}</p>
      </div>
      <div role="img" aria-label={`Минуты практики по дням за последние ${data.length} дней, занятия в ${active} днях`} className="flex h-36 items-end gap-1">
        {data.map((d) => (
          <div key={d.date} title={`${dayLabel(d.date)}: ${d.minutes} мин, ответов ${d.answers}`} className="flex h-full flex-1 items-end">
            <div
              className={d.answers > 0 ? "w-full rounded-t bg-action" : "w-full rounded-t bg-surface-alt"}
              style={{ height: `${d.answers > 0 ? Math.max(6, (d.minutes / max) * 100) : 3}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>{dayLabel(data[0].date)}</span>
        <span>{dayLabel(data[data.length - 1].date)}</span>
      </div>
    </Card>
  );
}

function XpChart({ data }: { data: ProfileData["xpSeries"] }) {
  const gained = data[data.length - 1]?.total ?? 0;
  const W = 600;
  const H = 140;
  const pad = 16;
  const max = Math.max(1, gained);
  const xs = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const ys = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(d.total).toFixed(1)}`).join(" ");
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl">Динамика XP</h2>
        <p className="text-muted">За 30 дней: +{gained} XP</p>
      </div>
      {gained === 0 ? (
        <p className="text-muted">XP за этот период пока нет. Пройдите урок, и график начнёт расти. Журнал ведётся с момента появления этого раздела.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Накопленный XP за 30 дней: ${gained}`} className="w-full">
          <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="stroke-line" strokeWidth="1" />
          <path d={path} fill="none" className="stroke-action" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </Card>
  );
}

export function StatsView({ data }: { data: ProfileData }) {
  const { totals } = data;
  if (totals.answers === 0) {
    return (
      <Card className="flex max-w-xl flex-col gap-4 p-8">
        <h2 className="text-2xl">Статистика появится после первых ответов</h2>
        <p className="text-muted">Пройдите урок, и здесь появятся активность по дням, точность по темам и динамика опыта.</p>
        <ButtonLink href="/app/learn" className="w-fit">
          К урокам
        </ButtonLink>
      </Card>
    );
  }
  const accuracy = Math.round((totals.correct / totals.answers) * 100);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Total label="Ответов" value={String(totals.answers)} />
        <Total label="Точность" value={`${accuracy}%`} />
        <Total label="Уроков пройдено" value={String(totals.lessonsCompleted)} />
        <Total label="Минут за 30 дней" value={String(totals.minutes)} />
      </div>
      <ActivityChart data={data.activity} />
      <XpChart data={data.xpSeries} />
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Точность по темам</h2>
        <p className="text-muted">Слабые темы сверху.</p>
        <ul className="flex flex-col gap-5">
          {data.topics.map((t) => (
            <li key={t.topicId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{t.title}</span>
                <span className="text-muted">
                  {t.accuracy}% · ответов {t.answers}
                </span>
              </div>
              <Progress value={t.accuracy} label={`Точность по теме «${t.title}»`} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
