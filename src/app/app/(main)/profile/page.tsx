import type { Metadata } from "next";
import { AchievementsView } from "@/components/profile/achievements-view";
import { Tabs } from "@/components/pro/ielts-tabs";
import { DeleteAccountCard, PasswordForm, ProfileForm, SubscriptionCard } from "@/components/profile/settings-forms";
import { StatsView } from "@/components/profile/stats-view";
import { WeeklyReportView } from "@/components/profile/weekly-report";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { billingState } from "@/lib/billing";
import { isAiConfigured } from "@/lib/ai/client";
import { loadProfileData } from "@/lib/profile-data";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Профиль" };

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default async function ProfilePage() {
  const user = await requireUser();
  const { profile, stats, plan, subscription } = await getAccount(user.id);
  const data = await loadProfileData(user.id, profile.timezone, stats);

  const state = billingState(subscription);
  const subLabel = state === "free" ? "Free" : state === "past-due" ? "PRO приостановлен" : "PRO";
  const end = subscription.currentPeriodEnd ? dateFmt.format(subscription.currentPeriodEnd) : null;
  const subDetail =
    state === "pro"
      ? `Продление ${end ?? "по графику подписки"}.`
      : state === "pro-cancelling"
        ? `Подписка не продлится, доступ до ${end ?? "конца периода"}.`
        : state === "past-due"
          ? "Последний платёж не прошёл, обновите карту."
          : "20 минут практики в день и первые 7 уроков.";

  const report =
    plan !== "pro" ? (
      <Card className="flex max-w-xl flex-col gap-4 p-8">
        <Badge tone="action" className="w-fit">
          PRO
        </Badge>
        <h2 className="text-2xl">Еженедельный отчёт: только в PRO</h2>
        <p className="text-muted">
          Раз в неделю Репетитор разбирает ваши цифры (минуты, точность, ошибки) и предлагает конкретный план на следующую неделю.
        </p>
        <ButtonLink href="/pricing" className="w-fit">
          Смотреть тариф PRO
        </ButtonLink>
      </Card>
    ) : isAiConfigured() ? (
      <WeeklyReportView />
    ) : (
      <Card className="flex max-w-xl flex-col gap-3 p-8">
        <h2 className="text-xl">Отчёт пока недоступен</h2>
        <p className="text-muted">AI-ментор ещё не подключён к сервису. Статистика и достижения работают.</p>
      </Card>
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">{user.name}</h1>
        <p className="text-muted">
          {user.email}
          {profile.level && ` · уровень ${profile.level}`}
        </p>
      </div>
      <Tabs
        tabs={[
          { id: "stats", label: "Статистика", content: <StatsView data={data} /> },
          { id: "achievements", label: "Достижения", content: <AchievementsView items={data.achievements} /> },
          { id: "report", label: "Отчёт", content: report },
          {
            id: "settings",
            label: "Настройки",
            content: (
              <>
                <ProfileForm
                  initial={{ name: user.name, goal: profile.goal, level: profile.level, dailyGoalMinutes: profile.dailyGoalMinutes }}
                  email={user.email}
                />
                <SubscriptionCard label={subLabel} detail={subDetail} />
                <PasswordForm />
                <DeleteAccountCard hasSubscription={Boolean(subscription.stripeSubscriptionId) && state !== "free"} />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
