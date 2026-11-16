import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";

/**
 * Подвал — последний экран страницы: ряд 1 — призыв (close-type), ряд 2 — каталог ссылок и юридическая строка.
 * Ровно два потомка в .wrap.
 */
export function SiteFooter({ title, text }: { title: string; text: string }) {
  return (
    <footer className="closing flex flex-col">
      <div className="wrap flex flex-1 flex-col justify-between gap-16">
        <div className="flex flex-col items-start gap-6">
          <h2 className="t-h2 max-w-[18ch]">{title}</h2>
          <p className="t-lead measure text-muted">{text}</p>
          <ButtonLink href="/register" size="xl" className="w-full sm:w-auto">
            Начать бесплатно
          </ButtonLink>
        </div>

        <div className="flex flex-col gap-10 border-t border-line pt-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-x-6">
            <div className="md:col-span-6">
              <Logo />
            </div>
            <div className="flex flex-col gap-3 md:col-span-3">
              <h3 className="text-[13px] font-medium text-muted">Курс</h3>
              <Link className="link w-fit" href="/#how">Темы и уроки</Link>
              <Link className="link w-fit" href="/#mistakes">Разбор ошибок</Link>
              <Link className="link w-fit" href="/#ielts">Подготовка к IELTS</Link>
            </div>
            <div className="flex flex-col gap-3 md:col-span-3">
              <h3 className="text-[13px] font-medium text-muted">Аккаунт</h3>
              <Link className="link w-fit" href="/pricing">Тарифы</Link>
              <Link className="link w-fit" href="/login">Войти</Link>
              <Link className="link w-fit" href="/register">Регистрация</Link>
            </div>
          </div>
          <p className="text-[13px] text-muted">© {new Date().getFullYear()} Репетитор</p>
        </div>
      </div>
    </footer>
  );
}
