import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { getAccount, requireUser } from "@/lib/session";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const { profile, stats, subscription } = await getAccount(user.id);
  if (!profile.onboardedAt) redirect("/app/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line">
        <Link href="/app" className="text-xl font-semibold tracking-tight">
          Репетитор
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="xp" title="Серия дней подряд">
            {stats.streak} дн.
          </Badge>
          <Badge tone="xp" title="Очки опыта">
            {stats.xp} XP
          </Badge>
          {subscription.plan === "pro" && <Badge tone="action">PRO</Badge>}
          <span className="hidden max-w-40 truncate pl-2 font-medium sm:inline">{user.name}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1 gap-8 py-8">
        <AppNav variant="side" />
        {/* нижний отступ на телефоне: место под нижнюю панель */}
        <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <AppNav variant="bottom" />
    </div>
  );
}
