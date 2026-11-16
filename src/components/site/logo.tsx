import Link from "next/link";

/** Знак: буква «Р» на скруглённой плашке цвета акцента, рядом название. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Репетитор, на главную" className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-md bg-action text-base font-semibold text-action-ink"
      >
        Р
      </span>
      <span className="text-xl font-medium tracking-tight">Репетитор</span>
    </Link>
  );
}
