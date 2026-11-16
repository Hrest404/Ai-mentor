import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadCourseView, practiceMinutesToday } from "@/lib/progress";
import { getAccount, requireUser } from "@/lib/session";
import { effectiveStreak, localDate } from "@/lib/streak";

export const metadata: Metadata = { title: "Кабинет" };

const GOALS = { general: "Общий английский", ielts: "Подготовка к IELTS" } as const;

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const { profile, stats } = await getAccount(user.id);
  const [{ views, next }, minutes] = await Promise.all([
    loadCourseView(user.id, profile.level),
    practiceMinutesToday(user.id, profile.timezone),
  ]);

  const streak = effectiveStreak(stats, localDate(new Date(), profile.timezone));
  const goal = profile.dailyGoalMinutes;
  const goalDone = minutes >= goal;
  const startedAny = views.some((v) => v.completedCount > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Здравствуйте, {user.name}</h1>
        <p className="text-muted">
          {GOALS[profile.goal]}
          {profile.level && ` · уровень ${profile.level}`}
        </p>
      </div>

      <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        {next ? (
          <>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium text-muted">{startedAny ? "Продолжить" : "Начните с первого урока"}</p>
              <h2 className="truncate text-2xl">{next.lesson.title}</h2>
              <p className="text-muted">{next.topic.titleRu}</p>
            </div>
            <ButtonLink href={`/app/lesson/${next.lesson.id}`} size="lg" className="shrink-0">
              {startedAny ? "Продолжить" : "Начать обучение"}
            </ButtonLink>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl">Все доступные уроки пройдены</h2>
              <p className="text-muted">Новые темы появятся по мере развития курса.</p>
            </div>
            <ButtonLink href="/app/learn" variant="secondary" size="lg">
              К карте курса
            </ButtonLink>
          </>
        )}
      </Card>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Цель дня</p>
          <p className="text-2xl font-semibold">
            {minutes} из {goal} мин
          </p>
          <Progress value={minutes} max={goal} label="Практика сегодня" />
          {goalDone && <Badge tone="success">Цель выполнена</Badge>}
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Серия</p>
          <p className="text-2xl font-semibold">
            {streak} {plural(streak, "день", "дня", "дней")}
          </p>
          <p className="text-muted">
            {streak > 0 ? `Рекорд: ${Math.max(stats.longestStreak, streak)}` : "Позанимайтесь сегодня, чтобы начать серию"}
          </p>
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Опыт</p>
          <p className="text-2xl font-semibold">{stats.xp} XP</p>
          <p className="text-muted">За каждый урок и тест</p>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">Темы</h2>
          <Link href="/app/learn" className="link font-medium text-action">
            Вся карта курса
          </Link>
        </div>
        <ul className="flex flex-col">
          {views.map((v) => (
            <li key={v.topic.id} className="border-b border-line first:border-t">
              <Link
                href={`/app/learn#${v.topic.id}`}
                className="flex min-h-16 items-center gap-4 py-3 transition-colors hover:bg-surface-alt"
              >
                <Badge>{v.topic.level}</Badge>
                <span className="min-w-0 flex-1 truncate font-medium">{v.topic.titleRu}</span>
                {v.open ? (
                  <>
                    <Progress
                      value={v.completedCount}
                      max={v.lessons.length}
                      label={`Прогресс темы: ${v.topic.titleRu}`}
                      className="hidden w-32 sm:block"
                    />
                    <span className="w-14 shrink-0 text-right text-sm text-muted">
                      {v.completedCount}/{v.lessons.length}
                    </span>
                  </>
                ) : (
                  <span className="shrink-0 text-sm text-muted">Закрыта</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
