import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Achievement } from "@/lib/stats";

export function AchievementsView({ items }: { items: Achievement[] }) {
  const got = items.filter((a) => a.unlocked).length;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        Получено {got} из {items.length}.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((a) => (
          <li key={a.id}>
            <Card className={a.unlocked ? "flex h-full flex-col gap-3 border-success" : "flex h-full flex-col gap-3"}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg">{a.title}</h3>
                {a.unlocked ? <Badge tone="success">Получено</Badge> : <Badge>{a.progress[0]} / {a.progress[1]}</Badge>}
              </div>
              <p className="text-muted">{a.description}</p>
              {!a.unlocked && <Progress value={a.progress[0]} max={a.progress[1]} label={`Прогресс: ${a.title}`} />}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
