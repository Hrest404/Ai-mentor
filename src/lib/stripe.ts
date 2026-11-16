import "server-only";
import { unstable_cache } from "next/cache";
import Stripe from "stripe";
import { formatPrice } from "./billing";

let cached: { key: string; stripe: Stripe } | null = null;

/** Клиент Stripe или null, если ключ не задан: оплата тогда показывает заглушку, а не падает. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!cached || cached.key !== key) cached = { key, stripe: new Stripe(key) };
  return cached.stripe;
}

export const stripePriceId = () => process.env.STRIPE_PRICE_ID?.trim() || null;
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;

/** Можно ли оформить подписку: нужны секретный ключ и цена. */
export const checkoutConfigured = () => Boolean(getStripe() && stripePriceId());

/** Адрес сайта для возврата из Stripe. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Цена PRO прямо из Stripe, чтобы страница и оплата не расходились. Кешируется на час; без ключа или при сбое null. */
export const getProPriceLabel = unstable_cache(
  async (): Promise<string | null> => {
    const stripe = getStripe();
    const id = stripePriceId();
    if (!stripe || !id) return null;
    try {
      const price = await stripe.prices.retrieve(id);
      if (price.unit_amount === null || !price.active) return null;
      return formatPrice({ amount: price.unit_amount, currency: price.currency, interval: price.recurring?.interval ?? null });
    } catch (err) {
      console.error("[stripe] не удалось получить цену:", err instanceof Error ? err.message : err);
      return null;
    }
  },
  ["pro-price-label"],
  { revalidate: 3600 },
);
