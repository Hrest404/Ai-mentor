import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FREE_FEATURES, FREE_LIMITS, PRO_FEATURES } from "@/lib/plans";
import { cn } from "@/lib/cn";
import { Countdown } from "./countdown";

/** Общая рамка экрана-ограничения. fullscreen: страница без кабинета вокруг (урок). */
function GateCard({
  fullscreen,
  badge,
  title,
  children,
  actions,
}: {
  fullscreen?: boolean;
  badge: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className={cn("mx-auto flex w-full max-w-xl flex-col justify-center px-4", fullscreen ? "min-h-dvh py-12" : "py-4")}>
      <Card className="flex flex-col gap-6 p-8">
        <Badge tone="action" className="w-fit">
          {badge}
        </Badge>
        <h1 className="text-3xl">{title}</h1>
        <div className="flex flex-col gap-4 text-lg">{children}</div>
        <div className="flex flex-col gap-3 sm:flex-row">{actions}</div>
      </Card>
    </main>
  );
}

const proActions = (back: { href: string; label: string }) => (
  <>
    <ButtonLink href="/pricing" size="lg">
      Смотреть тариф PRO
    </ButtonLink>
    <ButtonLink href={back.href} variant="secondary" size="lg">
      {back.label}
    </ButtonLink>
  </>
);

/** Уроки после лимита Free: пейволл. */
export function PaywallScreen() {
  return (
    <GateCard
      fullscreen
      badge="Доступно в PRO"
      title="Дальше доступно в PRO"
      actions={proActions({ href: "/app/learn", label: "К карте курса" })}
    >
      <p>
        Бесплатно открыты первые {FREE_LIMITS.lessons} уроков курса. Остальные уроки открывает тариф PRO.
      </p>
      <ul className="flex flex-col gap-2 text-base text-muted">
        {PRO_FEATURES.slice(0, 3).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </GateCard>
  );
}

/** Дневной лимит практики исчерпан: таймер до сброса. */
export function LimitScreen({ resetsAtMs, fullscreen = true }: { resetsAtMs: number; fullscreen?: boolean }) {
  return (
    <GateCard
      fullscreen={fullscreen}
      badge="Free"
      title="Лимит практики на сегодня исчерпан"
      actions={proActions({ href: "/app/learn", label: "К карте курса" })}
    >
      <p>
        На бесплатном тарифе {FREE_LIMITS.practiceMinutesPerDay} минут практики в день. Новые {FREE_LIMITS.practiceMinutesPerDay} минут
        откроются через <Countdown resetsAtMs={resetsAtMs} />.
      </p>
      <p className="text-base text-muted">Теорию читать можно в любое время. PRO снимает дневной лимит.</p>
    </GateCard>
  );
}

/** PRO-инструмент недоступен на Free. */
export function ProGate({ title, text }: { title: string; text: string }) {
  return (
    <GateCard
      badge="PRO"
      title={`${title}: только в PRO`}
      actions={proActions({ href: "/app/pro", label: "Все инструменты PRO" })}
    >
      <p>{text}</p>
      <p className="text-base text-muted">В бесплатном тарифе: {FREE_FEATURES.slice(0, 2).join("; ").toLowerCase()}.</p>
    </GateCard>
  );
}
