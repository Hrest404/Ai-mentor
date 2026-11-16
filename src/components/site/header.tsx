"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

export const NAV_LINKS = [
  { href: "/#how", label: "Обучение" },
  { href: "/#mistakes", label: "Ошибки" },
  { href: "/#ielts", label: "IELTS" },
  { href: "/pricing", label: "Тарифы" },
  { href: "/#faq", label: "Вопросы" },
];

/** Фиксированная шапка: непрозрачная, с линией снизу, на тех же полях, что и страница. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="nav fixed inset-x-0 top-0 z-50 border-b border-line bg-bg" style={{ height: "var(--nav)" }}>
      <div className="wrap flex h-full items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Разделы сайта" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === pathname ? "page" : undefined}
              className="link whitespace-nowrap font-medium text-[15px] aria-[current=page]:text-action"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="link hidden whitespace-nowrap font-medium text-[15px] sm:inline lg:inline">
            Войти
          </Link>
          <ButtonLink href="/register" className="hidden sm:inline-flex">
            Начать бесплатно
          </ButtonLink>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-md border border-line bg-surface lg:hidden"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className={cn("fixed inset-x-0 bottom-0 z-40 overflow-y-auto bg-bg lg:hidden")}
        style={{ top: "var(--nav)" }}
      >
        <nav aria-label="Меню" className="wrap flex flex-col py-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center border-b border-line text-xl font-medium"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex min-h-14 items-center border-b border-line text-xl font-medium"
          >
            Войти
          </Link>
          <ButtonLink href="/register" size="lg" className="mt-6 sm:hidden" onClick={() => setOpen(false)}>
            Начать бесплатно
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
