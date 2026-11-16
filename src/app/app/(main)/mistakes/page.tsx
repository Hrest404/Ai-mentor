import Link from "next/link";
import type { Metadata } from "next";
import { tagLabel } from "@/content/tags";
import { db } from "@/db";
import { mistakes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExplainButton } from "@/components/mistakes/explain-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { courseTopics, getExercise, getTopic } from "@/lib/course-index";
import { cn } from "@/lib/cn";
import { mistakeAnswer, mistakeTitle, weakestTags } from "@/lib/mistake-view";
import { getAccount, requireUser } from "@/lib/session";
import { describeNextReview, isDue, isDueToday, sortReviewQueue } from "@/lib/srs";

export const metadata: Metadata = { title: "Мои ошибки" };

type Status = "active" | "resolved" | "all";
const STATUS_LABEL: Record<Status, string> = { active: "Активные", resolved: "Усвоенные", all: "Все" };

function href(params: { topic?: string; tag?: string; status?: Status }) {
  const q = new URLSearchParams();
  if (params.topic) q.set("topic", params.topic);
  if (params.tag) q.set("tag", params.tag);
  if (params.status && params.status !== "active") q.set("status", params.status);
  const s = q.toString();
  return s ? `/app/mistakes?${s}` : "/app/mistakes";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-[15px] transition-colors",
        active ? "border-action bg-action-soft font-medium text-action" : "border-line hover:bg-surface-alt",
      )}
    >
      {children}
    </Link>
  );
}

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; tag?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const { profile } = await getAccount(user.id);

  const rows = await db.select().from(mistakes).where(eq(mistakes.userId, user.id));
  const now = new Date();
  const tz = profile.timezone;

  const status: Status = sp.status === "resolved" || sp.status === "all" ? sp.status : "active";
  const topicFilter = sp.topic && getTopic(sp.topic) ? sp.topic : undefined;
  const tagFilter = sp.tag;

  const active = rows.filter((r) => !r.resolvedAt);
  const dueNow = active.filter((r) => isDue(r, now)).length;
  const dueToday = active.filter((r) => isDueToday(r, now, tz)).length;
  const weak = weakestTags(rows);

  const visible = sortReviewQueue(
    rows.filter((r) => {
      if (status === "active" && r.resolvedAt) return false;
      if (status === "resolved" && !r.resolvedAt) return false;
      if (topicFilter && r.topicId !== topicFilter) return false;
      if (tagFilter && r.tag !== tagFilter) return false;
      return true;
    }),
  );

  const topicsWithMistakes = courseTopics.filter((t) => rows.some((r) => r.topicId === t.id));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl">Мои ошибки</h1>
        <Card className="flex flex-col gap-4 p-8">
          <h2 className="text-2xl">Пока ошибок нет</h2>
          <p className="text-muted">
            Неверные ответы из уроков попадают сюда. Репетитор объяснит каждую и напомнит о ней через несколько дней.
          </p>
          <ButtonLink href="/app/learn" className="w-fit">
            К урокам
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Мои ошибки</h1>
        <p className="text-muted">Повторяйте их по графику: так ошибки уходят навсегда.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Активные</p>
          <p className="text-2xl font-semibold">{active.length}</p>
          <p className="text-muted">Усвоено: {rows.length - active.length}</p>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Повторить сегодня</p>
          <p className="text-2xl font-semibold">{dueToday}</p>
          <p className="text-muted">{dueNow > 0 ? `Готовы к повторению: ${dueNow}` : "Пока ничего не созрело"}</p>
        </Card>
        <Card className="flex flex-col justify-between gap-4">
          <p className="text-sm text-muted">Сессия повторения</p>
          {dueNow > 0 ? (
            <ButtonLink href="/app/mistakes/review" size="lg">
              Повторить ({Math.min(dueNow, 10)})
            </ButtonLink>
          ) : (
            <p className="text-muted">Новая сессия откроется, когда придёт срок.</p>
          )}
        </Card>
      </div>

      {weak.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Слабые места</h2>
          <ul className="flex flex-col">
            {weak.map((w) => (
              <li key={w.tag} className="border-b border-line first:border-t">
                <Link
                  href={href({ tag: w.tag, status: "active" })}
                  className="flex min-h-14 items-center justify-between gap-4 py-2 transition-colors hover:bg-surface-alt"
                >
                  <span className="font-medium">{tagLabel(w.tag)}</span>
                  <span className="text-muted">
                    ошибок: {w.active}, промахов: {w.times}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-label="Фильтры">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <Chip key={s} to={href({ topic: topicFilter, tag: tagFilter, status: s })} active={status === s}>
              {STATUS_LABEL[s]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip to={href({ status })} active={!topicFilter && !tagFilter}>
            Все темы
          </Chip>
          {topicsWithMistakes.map((t) => (
            <Chip key={t.id} to={href({ topic: t.id, status })} active={topicFilter === t.id && !tagFilter}>
              {t.titleRu}
            </Chip>
          ))}
          {tagFilter && (
            <Chip to={href({ tag: tagFilter, status })} active>
              {tagLabel(tagFilter)}
            </Chip>
          )}
        </div>
      </section>

      {visible.length === 0 ? (
        <p className="text-muted">По этим фильтрам ничего нет.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((m) => {
            const ex = getExercise(m.exerciseId);
            if (!ex) return null; // упражнение убрали из курса
            const topic = getTopic(m.topicId);
            return (
              <li key={m.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {topic && <Badge>{topic.titleRu}</Badge>}
                    <Badge tone="action">{tagLabel(m.tag)}</Badge>
                    {m.resolvedAt ? (
                      <Badge tone="success">Усвоена</Badge>
                    ) : (
                      <Badge tone="xp">Повторение: {describeNextReview(m.dueAt, now, tz)}</Badge>
                    )}
                    <span className="text-sm text-muted">Ошибок: {m.timesWrong}</span>
                  </div>
                  <p lang="en" className="text-lg font-medium">
                    {mistakeTitle(ex.def)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="rounded-md bg-danger-soft px-4 py-2">
                      <span className="block text-sm text-muted">Ваш ответ</span>
                      <span lang="en" className="font-medium text-danger">
                        {m.lastAnswer}
                      </span>
                    </p>
                    <p className="rounded-md bg-success-soft px-4 py-2">
                      <span className="block text-sm text-muted">Верно</span>
                      <span lang="en" className="font-medium text-success">
                        {mistakeAnswer(ex.def)}
                      </span>
                    </p>
                  </div>
                  <p className="text-muted">{ex.def.explanation}</p>
                  <div>
                    <ExplainButton exerciseId={m.exerciseId} label={m.aiExplanation ? "Показать AI-разбор" : "Объяснить подробнее"} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
