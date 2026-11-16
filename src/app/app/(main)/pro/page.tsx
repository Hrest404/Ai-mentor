import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PRO_TOOLS } from "@/lib/pro-tools";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Инструменты PRO" };

export default async function ProHubPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Инструменты PRO</h1>
        <p className="text-muted">
          {plan === "pro"
            ? "Все инструменты открыты."
            : "Эти инструменты входят в тариф PRO."}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {PRO_TOOLS.map((t) => (
          <Link key={t.slug} href={`/app/pro/${t.slug}`} className="lift block">
            <Card className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl">{t.title}</h2>
                {plan === "free" && <Badge tone="action">PRO</Badge>}
              </div>
              <p className="text-muted">{t.text}</p>
            </Card>
          </Link>
        ))}
      </div>
      {plan === "free" && (
        <p>
          <Link href="/pricing" className="link font-medium text-action">
            Сравнить тарифы Free и PRO
          </Link>
        </p>
      )}
    </div>
  );
}
