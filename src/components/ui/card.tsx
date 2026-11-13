import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Один стиль карточки: поверхность, тонкая линия, мягкая тень.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-6 shadow-card",
        className,
      )}
      {...props}
    />
  );
}
