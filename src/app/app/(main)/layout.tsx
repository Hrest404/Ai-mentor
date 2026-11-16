import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { practiceSecondsLeft } from "@/lib/limits";
import { getAccount, requireUser } from "@/lib/session";
import { effectiveStreak, localDate } from "@/lib/streak";
import { getUsage } from "@/lib/usage";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [{ profile, stats, plan }, usage] = await Promise.all([getAccount(user.id), getUsage(user.id)]);
  if (!profile.onboardedAt) redirect("/app/onboarding");
  const streak = effectiveStreak(stats, localDate(new Date(), profile.timezone));
  const secondsLeft = practiceSecondsLeft(plan, usage.practiceSeconds);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4">
      <a href="#content" className="skip-link">
        К содержанию
      </a>
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line">
        <Link href="/app" className="text-xl font-semibold tracking-tight">
          Репетитор
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="xp" title="Серия дней подряд">
            {streak} дн.
          </Badge>
          <Badge tone="xp" title="Очки опыта" className="hidden sm:inline-flex">
            {stats.xp} XP
          </Badge>
          {secondsLeft === null ? (
            <Badge tone="action">PRO</Badge>
          ) : (
            <Link href="/pricing" title="Бесплатная практика на сегодня. Лимит обновляется через 24 часа после первого ответа.">
              <Badge tone={secondsLeft === 0 ? "danger" : "neutral"}>
                {secondsLeft === 0 ? (
                  <>
                    <span className="sm:hidden">Лимит</span>
                    <span className="hidden sm:inline">Лимит исчерпан</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">{Math.ceil(secondsLeft / 60)} мин</span>
                    <span className="hidden sm:inline">Осталось {Math.ceil(secondsLeft / 60)} мин</span>
                  </>
                )}
              </Badge>
            </Link>
          )}
          <span className="hidden max-w-40 truncate pl-2 font-medium sm:inline">{user.name}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1 gap-8 py-8">
        <AppNav variant="side" />
        {/* нижний отступ на телефоне: место под нижнюю панель */}
        <main id="content" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none md:pb-0">
          {children}
        </main>
      </div>
      <AppNav variant="bottom" />
    </div>
  );
}
