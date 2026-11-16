import type { Metadata } from "next";
import { BillingActions } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { billingState, toSnapshot, type BillingState } from "@/lib/billing";
import { syncSubscription } from "@/lib/billing-sync";
import { FREE_LIMITS, PRO_FEATURES } from "@/lib/plans";
import { getAccount, requireUser } from "@/lib/session";
import { checkoutConfigured, getProPriceLabel, getStripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Подписка" };

const dateFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/**
 * Возврат из Stripe после оплаты: не ждём webhook, а проверяем сессию сами и записываем подписку.
 * Сессия должна принадлежать этому пользователю; повторный заход ничего не ломает.
 */
async function confirmCheckout(userId: string, sessionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    if (session.client_reference_id !== userId || session.mode !== "subscription") return;
    if (session.status !== "complete" || !session.subscription || typeof session.subscription === "string") return;
    await syncSubscription(toSnapshot(session.subscription, userId));
  } catch (err) {
    console.error("[stripe] подтверждение оплаты:", err instanceof Error ? err.message : err);
  }
}

const STATE_BADGE: Record<BillingState, { tone: "neutral" | "success" | "xp" | "danger"; label: string }> = {
  free: { tone: "neutral", label: "Free" },
  pro: { tone: "success", label: "PRO активен" },
  "pro-cancelling": { tone: "xp", label: "PRO до конца периода" },
  "past-due": { tone: "danger", label: "Платёж не прошёл" },
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; session_id?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  if (sp.checkout === "success" && sp.session_id) await confirmCheckout(user.id, sp.session_id);

  const { subscription } = await getAccount(user.id);
  const state = billingState(subscription);
  const configured = checkoutConfigured();
  const price = await getProPriceLabel();
  const end = subscription.currentPeriodEnd ? dateFmt.format(subscription.currentPeriodEnd) : null;
  const badge = STATE_BADGE[state];
  const isPro = state === "pro" || state === "pro-cancelling";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Подписка</h1>
        <p className="text-muted">Тариф, срок действия и управление оплатой.</p>
      </div>

      {sp.checkout === "success" && (
        <Card role="status" className="border-success">
          {isPro ? (
            <p className="font-medium text-success">Оплата прошла, PRO подключён. Все инструменты открыты.</p>
          ) : (
            <p className="font-medium">Оплата принята. Подписка подключится в течение минуты: обновите страницу.</p>
          )}
        </Card>
      )}
      {sp.checkout === "canceled" && (
        <Card role="status">
          <p className="font-medium">Оплата отменена, деньги не списаны. Вернуться к оформлению можно в любой момент.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Ваш тариф</h2>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>

        {state === "pro" && <p>PRO действует, следующее продление {end ?? "по графику подписки"}.</p>}
        {state === "pro-cancelling" && (
          <p>
            Подписка отменена и не продлится. PRO остаётся до {end ?? "конца оплаченного периода"}, потом аккаунт перейдёт на Free.
          </p>
        )}
        {state === "past-due" && (
          <p>
            Последний платёж не прошёл, поэтому PRO приостановлен. Обновите карту в управлении подпиской, и доступ вернётся после успешного платежа.
          </p>
        )}
        {state === "free" && (
          <>
            <p>
              Сейчас у вас Free: {FREE_LIMITS.practiceMinutesPerDay} минут практики в день и первые {FREE_LIMITS.lessons} уроков.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-muted">
              {PRO_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-xl font-medium">{price ?? "Цена уточняется"}</p>
          </>
        )}

        {state === "free" &&
          (configured ? (
            <BillingActions mode="checkout" />
          ) : (
            <p role="note" className="rounded-md bg-surface-alt px-4 py-3 text-muted">
              Оплата пока не подключена. Как только она заработает, здесь появится кнопка оформления PRO.
            </p>
          ))}
        {state !== "free" && subscription.stripeCustomerId && <BillingActions mode="portal" />}
        {state === "past-due" && !subscription.stripeCustomerId && <ButtonLink href="/pricing">Тарифы</ButtonLink>}
      </Card>
    </div>
  );
}
