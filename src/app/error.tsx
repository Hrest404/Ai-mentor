"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Граница ошибок для всех страниц: понятное сообщение вместо белого экрана. Подробности остаются в журнале. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-12">
      <Card role="alert" className="flex flex-col gap-5 p-8">
        <p className="text-sm font-medium text-muted">Ошибка 500</p>
        <h1 className="text-3xl">Что-то пошло не так</h1>
        <p className="text-lg text-muted">Мы уже знаем о сбое. Попробуйте ещё раз, а если не помогло, вернитесь немного позже. Ваш прогресс не потерян.</p>
        {error.digest && <p className="text-sm text-muted">Код ошибки: {error.digest}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={reset}>
            Попробовать снова
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            На главную
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
