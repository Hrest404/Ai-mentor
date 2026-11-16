"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { createLimiter } from "@/lib/rate-limit";
import { getAccount, requireUser } from "@/lib/session";
import { checkoutConfigured, getStripe, siteUrl, stripePriceId } from "@/lib/stripe";

const limiter = createLimiter({ max: 6, windowMs: 60_000 });

export type UrlResponse = { ok: true; url: string } | { ok: false; error: string };

const NOT_CONFIGURED = "Оплата пока не подключена. Загляните позже.";
const FAILED = "Не удалось связаться с платёжной системой. Попробуйте ещё раз через минуту.";

/** Создаёт Checkout-сессию подписки PRO и возвращает адрес оплаты на стороне Stripe. */
export async function startCheckout(): Promise<UrlResponse> {
  const user = await requireUser();
  const stripe = getStripe();
  const price = stripePriceId();
  if (!stripe || !price || !checkoutConfigured()) return { ok: false, error: NOT_CONFIGURED };
  if (!limiter.check(user.id).ok) return { ok: false, error: "Слишком часто. Подождите минуту." };

  const { plan, subscription } = await getAccount(user.id);
  // Вторая подписка поверх действующей означала бы двойное списание.
  if (plan === "pro") return { ok: false, error: "PRO уже оформлен. Управлять подпиской можно на этой странице." };

  try {
    let customer = subscription.stripeCustomerId;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customer = created.id;
      await db.update(subscriptions).set({ stripeCustomerId: customer }).where(eq(subscriptions.userId, user.id));
    }
    const base = siteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId: user.id } },
      success_url: `${base}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/app/billing?checkout=canceled`,
    });
    if (!session.url) return { ok: false, error: FAILED };
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("[stripe] startCheckout:", err instanceof Error ? err.message : err);
    return { ok: false, error: FAILED };
  }
}

/** Адрес Customer Portal: смена карты и отмена подписки на стороне Stripe. */
export async function openPortal(): Promise<UrlResponse> {
  const user = await requireUser();
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: NOT_CONFIGURED };
  if (!limiter.check(user.id).ok) return { ok: false, error: "Слишком часто. Подождите минуту." };

  const { subscription } = await getAccount(user.id);
  if (!subscription.stripeCustomerId) return { ok: false, error: "У вас пока нет платной подписки." };

  const returnUrl = `${siteUrl()}/app/billing`;
  const open = () => stripe.billingPortal.sessions.create({ customer: subscription.stripeCustomerId!, return_url: returnUrl });
  try {
    try {
      return { ok: true, url: (await open()).url };
    } catch (err) {
      // В новом аккаунте Stripe настройки портала ещё нет: создаём её (смена карты, отмена в конце периода) и повторяем.
      if (!/configuration/i.test(err instanceof Error ? err.message : "")) throw err;
      await stripe.billingPortal.configurations.create({
        business_profile: { headline: "Управление подпиской Репетитор PRO" },
        features: {
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
          subscription_cancel: { enabled: true, mode: "at_period_end" },
        },
      });
      return { ok: true, url: (await open()).url };
    }
  } catch (err) {
    console.error("[stripe] openPortal:", err instanceof Error ? err.message : err);
    return { ok: false, error: FAILED };
  }
}
