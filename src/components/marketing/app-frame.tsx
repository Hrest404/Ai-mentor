import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";

/** Окно приложения: заголовок урока, прогресс и содержимое. Одно скругление и одна тонкая линия. */
export function AppFrame({
  title,
  meta,
  progress,
  children,
}: {
  title: string;
  meta?: string;
  progress?: number;
  children: ReactNode;
}) {
  return (
    <div className="frame min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="truncate font-medium">{title}</p>
          {meta && <p className="shrink-0 text-sm text-muted">{meta}</p>}
        </div>
        {progress !== undefined && <Progress value={progress} label="Прогресс урока" className="h-2" />}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
