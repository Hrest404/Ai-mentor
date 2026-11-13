import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Кабинет" };

const GOALS = { general: "Общий английский", ielts: "Подготовка к IELTS" } as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const { profile, stats } = await getAccount(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Здравствуйте, {user.name}</h1>
        <p className="text-muted">Уроки и дневная цель появятся здесь на этапе 5.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-muted">Уровень</p>
          <p className="text-2xl font-semibold">{profile.level ?? "Не определён"}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-muted">Цель</p>
          <p className="text-2xl font-semibold">{GOALS[profile.goal]}</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-muted">Прогресс</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="xp">{stats.xp} XP</Badge>
            <Badge tone="xp">Серия: {stats.streak} дн.</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
