"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

// Витрина компонентов для проверки дизайн-системы. Заменим лендингом на этапе 4.
export function UiDemo() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const toast = useToast();
  const error = value.length > 0 && value.length < 3 ? "Минимум 3 символа" : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Кнопки</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Начать урок</Button>
          <Button variant="secondary">Позже</Button>
          <Button variant="ghost">Пропустить</Button>
          <Button variant="danger">Удалить</Button>
          <Button loading>Проверяем</Button>
          <Button disabled>Недоступно</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Метки и прогресс</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>A2</Badge>
          <Badge tone="action">PRO</Badge>
          <Badge tone="xp">120 XP</Badge>
          <Badge tone="success">Верно</Badge>
          <Badge tone="danger">Ошибка</Badge>
        </div>
        <Progress value={64} label="Прогресс урока" />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Поле ввода</h2>
        <Input
          label="Переведите: «Я учусь каждый день»"
          placeholder="I study every day"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          hint="Пишите по-английски"
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Окно и уведомление</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Открыть окно
          </Button>
          <Button variant="secondary" onClick={() => toast("Ответ сохранён", "success")}>
            Показать уведомление
          </Button>
        </div>
        <Modal open={open} onClose={() => setOpen(false)} title="Лимит на сегодня исчерпан">
          <p className="text-muted">
            Бесплатная практика сбрасывается через 24 часа. С PRO лимитов нет.
          </p>
          <Button onClick={() => setOpen(false)}>Понятно</Button>
        </Modal>
      </Card>
    </div>
  );
}
