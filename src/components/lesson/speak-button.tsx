"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { speak, ttsSupported } from "@/lib/tts";

const noopSubscribe = () => () => {};

/** Кнопка озвучки. Если браузер не умеет говорить, она отключена и подсказывает почему. */
export function SpeakButton({
  text,
  rate = 1,
  label,
  slow,
  className,
}: {
  text: string;
  rate?: number;
  label: string;
  slow?: boolean;
  className?: string;
}) {
  // На сервере поддержка неизвестна: считаем, что её нет, чтобы разметка совпала при гидрации.
  const supported = useSyncExternalStore(noopSubscribe, ttsSupported, () => false);

  return (
    <button
      type="button"
      onClick={() => speak(text, rate)}
      aria-label={label || "Прослушать"}
      disabled={!supported}
      title={supported ? undefined : "Озвучка недоступна в этом браузере"}
      className={cn(
        "inline-flex min-h-12 items-center gap-3 rounded-md border border-line bg-surface px-4 font-medium",
        "transition-[background-color,transform] hover:bg-surface-alt active:translate-y-px disabled:opacity-50",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-6 text-action" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {slow ? (
          <path d="M4 10v4h4l5 4V6L8 10zM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
        ) : (
          <path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6" />
        )}
      </svg>
      {label}
    </button>
  );
}
