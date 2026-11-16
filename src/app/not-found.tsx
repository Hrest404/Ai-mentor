import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-12">
      <Card className="flex flex-col gap-5 p-8">
        <p className="text-sm font-medium text-muted">Ошибка 404</p>
        <h1 className="text-3xl">Такой страницы нет</h1>
        <p className="text-lg text-muted">Возможно, ссылка устарела или в адресе опечатка. Вернитесь на главную или продолжите занятия.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            На главную
          </ButtonLink>
          <ButtonLink href="/app" variant="secondary" size="lg">
            В кабинет
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
