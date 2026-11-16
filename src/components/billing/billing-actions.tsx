"use client";

import { useState } from "react";
import { openPortal, startCheckout, type UrlResponse } from "@/app/app/(main)/billing/actions";
import { Button } from "@/components/ui/button";

/** Кнопки оплаты и управления подпиской. Адрес Stripe приходит с сервера; страница оплаты открывается в этой же вкладке. */
export function BillingActions({ mode, disabled }: { mode: "checkout" | "portal"; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    let res: UrlResponse;
    try {
      res = await (mode === "checkout" ? startCheckout() : openPortal());
    } catch {
      res = { ok: false, error: "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз." };
    }
    if (res.ok) {
      window.location.assign(res.url);
      return; // кнопка остаётся занятой до ухода со страницы
    }
    setError(res.error);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="lg" onClick={go} loading={pending} disabled={disabled}>
          {mode === "checkout" ? "Оформить PRO" : "Управление подпиской"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
