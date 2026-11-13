import { cn } from "@/lib/cn";

export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  /** Доступное имя для скринридера, например «Прогресс урока». */
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(Math.min(max, Math.max(0, value)))}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-surface-alt", className)}
    >
      <div
        className="h-full rounded-full bg-action transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
