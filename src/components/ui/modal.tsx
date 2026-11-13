"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Нативный <dialog>: фокус-ловушка, Esc и затемнение даёт браузер.
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // клик по затемнению (по самому <dialog>, не по содержимому) закрывает окно
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-card",
        className,
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <span aria-hidden className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
