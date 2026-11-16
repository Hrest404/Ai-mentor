import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/footer";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { COMPARISON, FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from "@/lib/plans";

export const metadata: Metadata = {
  title: { absolute: "Тарифы Репетитора: Free и PRO" },
  description:
    "Free даёт 20 минут практики в день и первые 7 уроков, PRO снимает лимиты и открывает проверку речи, текста и IELTS.",
};

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="mt-1 size-5 shrink-0 text-action" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function Features({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-1 flex-col gap-3">
      {items.map((f) => (
        <li key={f} className="flex gap-3">
          <Check />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  const price = PRO_PRICE ? `${PRO_PRICE.amount} ${PRO_PRICE.currency} ${PRO_PRICE.period}` : "Цена уточняется";

  return (
    <>
      <main id="top">
        <section className="hero" style={{ ["--h" as string]: 1 }}>
          <div className="wrap flex flex-col gap-10">
            <div data-enter className="flex flex-col gap-5">
              <h1 className="t-h1 max-w-[16ch]">Тарифы Free и PRO</h1>
              <p className="t-lead measure text-muted">
                Free бесплатен без срока: лимит практики обновляется каждые 24 часа. PRO снимает лимиты и открывает
                проверку речи, текста и IELTS.
              </p>
            </div>
            <div data-enter className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <h2 className="t-h3">Free</h2>
                  <p className="text-xl font-medium">Бесплатно</p>
                </div>
                <Features items={FREE_FEATURES} />
                <ButtonLink href="/register">Начать бесплатно</ButtonLink>
              </Card>
              <Card className="flex flex-col gap-6 border-action">
                <div className="flex flex-col gap-1">
                  <h2 className="t-h3 flex items-center gap-3">
                    PRO <Badge tone="action">Все инструменты</Badge>
                  </h2>
                  <p className="text-xl font-medium">{price}</p>
                </div>
                <Features items={PRO_FEATURES} />
                <ButtonLink href="/register" variant="secondary">
                  Выбрать PRO
                </ButtonLink>
              </Card>
            </div>
          </div>
        </section>

        <section id="compare" className="bg-surface-alt">
          <div className="wrap flex flex-col gap-10">
            <h2 className="t-h2">Сравнение тарифов</h2>
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Что входит в Free и в PRO</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-3 pr-4 text-[13px] font-medium text-muted">Возможность</th>
                  <th scope="col" className="w-[28%] px-4 py-3 text-[13px] font-medium text-muted">Free</th>
                  <th scope="col" className="w-[28%] px-4 py-3 text-[13px] font-medium text-muted">PRO</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([what, free, pro]) => (
                  <tr key={what} className="border-b border-line">
                    <th scope="row" className="py-2.5 pr-4 font-medium">{what}</th>
                    <td className="px-4 py-2.5 text-muted">{free}</td>
                    <td className="px-4 py-2.5">{pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <SiteFooter title="Начните с тарифа Free" text="Тест уровня и первые уроки открыты сразу, карта не нужна." />
    </>
  );
}
