"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/** Вкладки с управлением стрелками и подписями для скринридеров. Содержимое неактивных вкладок не отображается, но состояние сохраняется. */
export function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const base = useId();
  const [active, setActive] = useState(initial && tabs.some((t) => t.id === initial) ? initial : tabs[0].id);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.findIndex((t) => t.id === active);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Разделы IELTS" onKeyDown={onKeyDown} className="flex flex-wrap gap-2 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={cn(
              "min-h-11 border-b-2 px-4 font-medium transition-colors",
              active === t.id ? "border-action text-action" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={active !== t.id}
          className="flex flex-col gap-6"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
