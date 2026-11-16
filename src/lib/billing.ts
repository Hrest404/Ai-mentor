/**
 * Чистая логика оплаты: как состояние подписки в Stripe превращается в тариф в нашей базе.
 * Здесь нет обращений к сети и базе, поэтому всё покрыто тестами.
 */

export interface SubscriptionSnapshot {
  id: string;
  customerId: string;
  /** Статус Stripe: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused. */
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Конец оплаченного периода, секунды Unix; null, если неизвестен. */
  currentPeriodEnd: number | null;
  /** Наш пользователь, если Stripe хранит его в метаданных подписки. */
  userId: string | null;
}

/** Статусы, при которых подписка больше не может дать PRO. */
const DEAD = new Set(["canceled", "unpaid", "incomplete_expired"]);

export function subscriptionFields(s: SubscriptionSnapshot) {
  return {
    plan: DEAD.has(s.status) ? ("free" as const) : ("pro" as const),
    status: s.status,
    currentPeriodEnd: s.currentPeriodEnd === null ? null : new Date(s.currentPeriodEnd * 1000),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    stripeSubscriptionId: s.id,
    stripeCustomerId: s.customerId,
  };
}

/** Минимальная форма подписки Stripe, нужная нам; настоящий объект ей соответствует. */
interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  items?: { data: { current_period_end?: number }[] };
  /** У старых версий API срок лежал на самой подписке. */
  current_period_end?: number;
}

export function toSnapshot(sub: StripeSubscriptionLike, userIdOverride?: string | null): SubscriptionSnapshot {
  const ends = [sub.current_period_end, ...(sub.items?.data ?? []).map((i) => i.current_period_end)].filter(
    (n): n is number => typeof n === "number",
  );
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    // Если позиций несколько, действует самая поздняя оплаченная дата.
    currentPeriodEnd: ends.length > 0 ? Math.max(...ends) : null,
    userId: userIdOverride ?? sub.metadata?.userId ?? null,
  };
}

/* ───────────── События webhook ───────────── */

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: unknown };
}

/** События, после которых нужно пересчитать подписку. Остальные игнорируются. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

const idOf = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
};

/**
 * Какую подписку затрагивает событие и какому нашему пользователю она принадлежит, если событие это знает.
 * null: событие не про подписку (разовый платёж, другая ситуация).
 */
export function subscriptionRefFromEvent(event: StripeEventLike): { subscriptionId: string; userId: string | null } | null {
  const o = (event.data.object ?? {}) as Record<string, unknown>;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const id = idOf(o);
      const meta = o.metadata as Record<string, string> | undefined;
      return id ? { subscriptionId: id, userId: meta?.userId ?? null } : null;
    }
    case "checkout.session.completed": {
      if (o.mode !== "subscription") return null;
      const id = idOf(o.subscription);
      return id ? { subscriptionId: id, userId: typeof o.client_reference_id === "string" ? o.client_reference_id : null } : null;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      // Новые версии API: invoice.parent.subscription_details.subscription; старые: invoice.subscription.
      const parent = o.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
      const id = idOf(parent?.subscription_details?.subscription) ?? idOf(o.subscription);
      return id ? { subscriptionId: id, userId: null } : null;
    }
    default:
      return null;
  }
}

/* ───────────── Показ на странице ───────────── */

export type BillingState = "free" | "pro" | "pro-cancelling" | "past-due";

/** Что показать пользователю про его подписку. */
export function billingState(sub: {
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
} | null, now: Date = new Date()): BillingState {
  if (!sub || sub.plan !== "pro") return "free";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime()) return "free";
  if (sub.status === "past_due") return "past-due";
  if (sub.status !== "active" && sub.status !== "trialing") return "free";
  return sub.cancelAtPeriodEnd ? "pro-cancelling" : "pro";
}

/** Цена для показа: «20 USD в месяц». */
export function formatPrice(p: { amount: number; currency: string; interval: string | null }): string {
  const unit = p.amount / 100;
  const value = Number.isInteger(unit) ? String(unit) : unit.toFixed(2);
  const period = p.interval === "month" ? " в месяц" : p.interval === "year" ? " в год" : p.interval === "week" ? " в неделю" : p.interval === "day" ? " в день" : "";
  return `${value} ${p.currency.toUpperCase()}${period}`;
}
