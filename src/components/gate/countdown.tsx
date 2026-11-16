"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h} ч ${pad(m)} мин ${pad(s)} с` : `${m} мин ${pad(s)} с`;
}

/** Обратный отсчёт до сброса лимита. По окончании обновляет страницу, и практика снова открыта. */
export function Countdown({ resetsAtMs }: { resetsAtMs: number }) {
  const router = useRouter();
  // На сервере и при первом рендере времени ещё нет: так разметка совпадает при гидрации.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let refreshed = false;
    const tick = () => {
      const ms = resetsAtMs - Date.now();
      setLeft(ms);
      if (ms <= 0 && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resetsAtMs, router]);

  return (
    <span className="font-medium tabular-nums" aria-live="off">
      {left === null ? "…" : format(left)}
    </span>
  );
}
