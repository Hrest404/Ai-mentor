import { describe, expect, it } from "vitest";
import { billingState, formatPrice, subscriptionFields, subscriptionRefFromEvent, toSnapshot } from "./billing";
import { effectivePlan } from "./limits";

const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  metadata: { userId: "u1" },
  items: { data: [{ current_period_end: 1_800_000_000 }] },
  ...over,
});

describe("toSnapshot", () => {
  it("берёт срок из позиции подписки и пользователя из метаданных", () => {
    expect(toSnapshot(sub())).toEqual({
      id: "sub_1",
      customerId: "cus_1",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1_800_000_000,
      userId: "u1",
    });
  });

  it("понимает старую форму (срок на самой подписке) и объект клиента", () => {
    const s = toSnapshot(sub({ items: undefined, current_period_end: 1_700_000_000, customer: { id: "cus_9" }, metadata: null }));
    expect(s.currentPeriodEnd).toBe(1_700_000_000);
    expect(s.customerId).toBe("cus_9");
    expect(s.userId).toBeNull();
  });

  it("при нескольких позициях берёт самый поздний срок; пользователь из события приоритетнее", () => {
    const s = toSnapshot(sub({ items: { data: [{ current_period_end: 10 }, { current_period_end: 30 }, {}] } }), "u2");
    expect(s.currentPeriodEnd).toBe(30);
    expect(s.userId).toBe("u2");
  });

  it("срок неизвестен: null", () => {
    expect(toSnapshot(sub({ items: { data: [] } })).currentPeriodEnd).toBeNull();
  });
});

describe("subscriptionFields", () => {
  const snap = (status: string) => toSnapshot(sub({ status }));

  it("активные и пробные дают PRO, неоплаченные и отменённые Free", () => {
    for (const s of ["active", "trialing", "past_due", "incomplete"]) expect(subscriptionFields(snap(s)).plan).toBe("pro");
    for (const s of ["canceled", "unpaid", "incomplete_expired"]) expect(subscriptionFields(snap(s)).plan).toBe("free");
  });

  it("срок превращается в дату, идентификаторы сохраняются", () => {
    const f = subscriptionFields(snap("active"));
    expect(f.currentPeriodEnd).toEqual(new Date(1_800_000_000 * 1000));
    expect(f.stripeSubscriptionId).toBe("sub_1");
    expect(f.stripeCustomerId).toBe("cus_1");
  });

  it("согласуется с effectivePlan: past_due и просроченный срок не дают PRO", () => {
    const now = new Date(1_790_000_000 * 1000);
    expect(effectivePlan(subscriptionFields(snap("active")), now)).toBe("pro");
    expect(effectivePlan(subscriptionFields(snap("past_due")), now)).toBe("free");
    expect(effectivePlan(subscriptionFields(snap("active")), new Date(1_800_000_001 * 1000))).toBe("free");
    expect(effectivePlan(subscriptionFields(snap("canceled")), now)).toBe("free");
  });
});

describe("subscriptionRefFromEvent", () => {
  const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } });

  it("события подписки", () => {
    expect(subscriptionRefFromEvent(ev("customer.subscription.updated", sub()))).toEqual({ subscriptionId: "sub_1", userId: "u1" });
    expect(subscriptionRefFromEvent(ev("customer.subscription.deleted", { id: "sub_2" }))).toEqual({ subscriptionId: "sub_2", userId: null });
  });

  it("завершённый Checkout: только для подписок, пользователь из client_reference_id", () => {
    const session = { mode: "subscription", subscription: "sub_3", client_reference_id: "u3" };
    expect(subscriptionRefFromEvent(ev("checkout.session.completed", session))).toEqual({ subscriptionId: "sub_3", userId: "u3" });
    expect(subscriptionRefFromEvent(ev("checkout.session.completed", { ...session, mode: "payment" }))).toBeNull();
    expect(subscriptionRefFromEvent(ev("checkout.session.completed", { mode: "subscription", subscription: null }))).toBeNull();
  });

  it("счета: новая и старая форма ссылки на подписку", () => {
    expect(subscriptionRefFromEvent(ev("invoice.paid", { parent: { subscription_details: { subscription: "sub_4" } } }))).toEqual({
      subscriptionId: "sub_4",
      userId: null,
    });
    expect(subscriptionRefFromEvent(ev("invoice.payment_failed", { subscription: "sub_5" }))?.subscriptionId).toBe("sub_5");
    expect(subscriptionRefFromEvent(ev("invoice.paid", { parent: null }))).toBeNull();
  });

  it("посторонние события игнорируются", () => {
    expect(subscriptionRefFromEvent(ev("charge.succeeded", { id: "ch_1" }))).toBeNull();
  });
});

describe("billingState", () => {
  const base = { plan: "pro", status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: new Date("2027-01-01") };
  const now = new Date("2026-11-16");

  it("различает свободный, платный, отменяемый и просроченный платёж", () => {
    expect(billingState(null, now)).toBe("free");
    expect(billingState({ ...base, plan: "free" }, now)).toBe("free");
    expect(billingState(base, now)).toBe("pro");
    expect(billingState({ ...base, cancelAtPeriodEnd: true }, now)).toBe("pro-cancelling");
    expect(billingState({ ...base, status: "past_due" }, now)).toBe("past-due");
    expect(billingState({ ...base, currentPeriodEnd: new Date("2026-11-01") }, now)).toBe("free");
  });
});

describe("formatPrice", () => {
  it("целые суммы без копеек, период по-русски", () => {
    expect(formatPrice({ amount: 2000, currency: "usd", interval: "month" })).toBe("20 USD в месяц");
    expect(formatPrice({ amount: 999, currency: "eur", interval: "year" })).toBe("9.99 EUR в год");
    expect(formatPrice({ amount: 500, currency: "usd", interval: null })).toBe("5 USD");
  });
});
