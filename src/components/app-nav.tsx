"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/app", label: "Главная", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/app/learn", label: "Обучение", icon: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 19v2H6M8 7h7M8 11h7" },
  { href: "/app/mistakes", label: "Ошибки", icon: "M12 3 2.5 20h19zM12 10v4M12 17h.01" },
  { href: "/app/phrasebook", label: "Разговорник", icon: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5" },
  { href: "/app/profile", label: "Профиль", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
] as const;

/** Навигация кабинета: боковая на широком экране, нижняя панель на телефоне. */
export function AppNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <nav
      aria-label="Разделы кабинета"
      className={cn(
        variant === "side"
          ? "hidden w-56 shrink-0 flex-col gap-1 md:flex"
          : "fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden",
      )}
    >
      {ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "transition-colors",
              variant === "side"
                ? "flex min-h-11 items-center gap-3 rounded-md px-3 font-medium"
                : "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[13px] font-medium",
              active
                ? variant === "side"
                  ? "bg-action-soft text-action"
                  : "text-action"
                : "text-muted hover:text-ink" + (variant === "side" ? " hover:bg-surface-alt" : ""),
            )}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
