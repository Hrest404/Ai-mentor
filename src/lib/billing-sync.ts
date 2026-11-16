import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stripeEvents, subscriptions } from "@/db/schema";
import { subscriptionFields, type SubscriptionSnapshot } from "./billing";

/**
 * Записывает событие как обработанное. false: такое событие уже было (Stripe доставляет повторно),
 * и второй раз его трогать не нужно.
 */
export async function claimEvent(id: string, type: string): Promise<boolean> {
  const res = await db.insert(stripeEvents).values({ id, type }).onConflictDoNothing();
  return res.rowsAffected > 0;
}

/** Снимает отметку, если обработка не удалась: Stripe повторит доставку, и событие будет разобрано заново. */
export async function releaseEvent(id: string): Promise<void> {
  await db.delete(stripeEvents).where(eq(stripeEvents.id, id));
}

/**
 * Переносит состояние подписки Stripe в нашу таблицу. Пользователя ищем по метаданным, затем по клиенту и
 * по подписке. Операция идемпотентна: берёт актуальное состояние целиком, а не «приращение».
 * Возвращает id пользователя или null, если подписку не удалось привязать.
 */
export async function syncSubscription(snap: SubscriptionSnapshot): Promise<string | null> {
  let row = snap.userId ? await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, snap.userId) }) : undefined;
  row ??= await db.query.subscriptions.findFirst({ where: eq(subscriptions.stripeCustomerId, snap.customerId) });
  row ??= await db.query.subscriptions.findFirst({ where: eq(subscriptions.stripeSubscriptionId, snap.id) });

  if (!row) {
    console.error(`[stripe] подписка ${snap.id} не привязана ни к одному пользователю`);
    return null;
  }
  // Если у пользователя уже новая подписка, старая (отменённая) не должна её затирать.
  if (row.stripeSubscriptionId && row.stripeSubscriptionId !== snap.id && row.plan === "pro" && ["canceled", "incomplete_expired"].includes(snap.status)) {
    return row.userId;
  }

  await db.update(subscriptions).set({ ...subscriptionFields(snap), updatedAt: new Date() }).where(eq(subscriptions.id, row.id));
  return row.userId;
}
