import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

// Одна форма кнопки на весь продукт; hover делает шаг, нажатие вдавливает.
const variants: Record<Variant, string> = {
  primary: "bg-action text-action-ink hover:bg-action-hover",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-alt",
  ghost: "bg-transparent text-ink hover:bg-surface-alt",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base", // 44px: минимальная цель касания
  lg: "min-h-12 px-6 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading, disabled, className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium",
          "transition-[background-color,transform,opacity] duration-150 active:translate-y-px",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
