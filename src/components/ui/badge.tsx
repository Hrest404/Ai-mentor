import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "action" | "xp" | "success" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-alt text-ink",
  action: "bg-action-soft text-action",
  xp: "bg-xp-soft text-xp",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
