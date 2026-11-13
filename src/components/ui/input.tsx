import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

// Подпись всегда видна (не placeholder), ошибка стоит под своим полем.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-base font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          "min-h-11 rounded-md border bg-surface px-4 text-base text-ink",
          "placeholder:text-muted transition-colors",
          error ? "border-danger" : "border-line hover:border-muted",
          className,
        )}
        {...props}
      />
      {note && (
        <p
          id={noteId}
          className={cn("text-sm", error ? "text-danger" : "text-muted")}
        >
          {note}
        </p>
      )}
    </div>
  );
});
