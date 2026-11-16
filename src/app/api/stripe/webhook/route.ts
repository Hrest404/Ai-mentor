import { HANDLED_EVENTS, subscriptionRefFromEvent, toSnapshot } from "@/lib/billing";
import { claimEvent, releaseEvent, syncSubscription } from "@/lib/billing-sync";
import { getStripe, webhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Webhook Stripe. Подлинность проверяется подписью по сырому телу запроса; без неё и без секрета событие
 * не принимается. События идемпотентны: повторная доставка того же события ничего не меняет.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = webhookSecret();
  if (!stripe || !secret) return reply(503, { error: "Оплата не настроена" });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return reply(400, { error: "Нет подписи" });

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return reply(400, { error: "Неверная подпись" });
  }

  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return reply(200, { received: true, ignored: true });

  // Занимаем событие до обработки: параллельная повторная доставка не пройдёт дальше.
  if (!(await claimEvent(event.id, event.type))) return reply(200, { received: true, duplicate: true });

  try {
    const ref = subscriptionRefFromEvent(event);
    if (ref) {
      // Берём актуальное состояние из Stripe, а не из события: порядок доставки событий не гарантирован.
      const subscription = await stripe.subscriptions.retrieve(ref.subscriptionId);
      await syncSubscription(toSnapshot(subscription, ref.userId));
    }
  } catch (err) {
    // Не обработано: снимаем отметку, чтобы повторная доставка попробовала снова.
    await releaseEvent(event.id).catch(() => {});
    console.error(`[stripe] событие ${event.id} (${event.type}) не обработано:`, err instanceof Error ? err.message : err);
    return reply(500, { error: "Не удалось обработать событие" });
  }
  return reply(200, { received: true });
}
