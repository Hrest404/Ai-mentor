"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changePassword, deleteAccount, updateProfile } from "@/app/app/(main)/profile/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DELETE_CONFIRM_WORD } from "@/lib/account";
import { MIN_PASSWORD_LENGTH_UI } from "@/lib/account-ui";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const selectClass = "min-h-11 rounded-md border border-line bg-surface px-4 text-base text-ink";

function Msg({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-danger">
      {error}
    </p>
  ) : null;
}

export function ProfileForm({
  initial,
  email,
}: {
  initial: { name: string; goal: "general" | "ielts"; level: (typeof LEVELS)[number] | null; dailyGoalMinutes: number };
  email: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [goal, setGoal] = useState(initial.goal);
  const [level, setLevel] = useState<string>(initial.level ?? "");
  const [minutes, setMinutes] = useState(String(initial.dailyGoalMinutes));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const res = await updateProfile({ name, goal, level: level || null, dailyGoalMinutes: Number(minutes) });
        if (!res.ok) setError(res.error);
        else {
          toast("Профиль сохранён", "success");
          router.refresh();
        }
      } catch {
        setError("Не получилось сохранить. Проверьте соединение и попробуйте ещё раз.");
      }
    });
  }

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-xl">Профиль</h2>
      <Input label="Имя" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
      <Input label="Почта" value={email} readOnly hint="Адрес входа изменить нельзя" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="p-goal" className="text-base font-medium">
            Цель
          </label>
          <select id="p-goal" value={goal} onChange={(e) => setGoal(e.target.value as "general" | "ielts")} className={selectClass}>
            <option value="general">Общий английский</option>
            <option value="ielts">Подготовка к IELTS</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="p-level" className="text-base font-medium">
            Уровень
          </label>
          <select id="p-level" value={level} onChange={(e) => setLevel(e.target.value)} className={selectClass}>
            <option value="">Не определён</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="p-min" className="text-base font-medium">
            Цель дня
          </label>
          <select id="p-min" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={selectClass}>
            {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} мин
              </option>
            ))}
          </select>
        </div>
      </div>
      <Msg error={error} />
      <div>
        <Button onClick={save} loading={pending}>
          Сохранить
        </Button>
      </div>
    </Card>
  );
}

export function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const res = await changePassword({ currentPassword: current, newPassword: next });
        if (!res.ok) setError(res.error);
        else {
          setCurrent("");
          setNext("");
          toast("Пароль изменён. На других устройствах выполнен выход.", "success");
        }
      } catch {
        setError("Не получилось сменить пароль. Проверьте соединение и попробуйте ещё раз.");
      }
    });
  }

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-xl">Смена пароля</h2>
      <Input label="Текущий пароль" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      <Input
        label="Новый пароль"
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        hint={`Не короче ${MIN_PASSWORD_LENGTH_UI} символов`}
      />
      <Msg error={error} />
      <div>
        <Button onClick={save} loading={pending} disabled={!current || next.length < MIN_PASSWORD_LENGTH_UI}>
          Сменить пароль
        </Button>
      </div>
    </Card>
  );
}

export function SubscriptionCard({ label, detail }: { label: string; detail: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl">Подписка</h2>
      <p>
        <strong>{label}</strong>. {detail}
      </p>
      <div>
        <ButtonLink href="/app/billing" variant="secondary">
          Управление подпиской
        </ButtonLink>
      </div>
    </Card>
  );
}

export function DeleteAccountCard({ hasSubscription }: { hasSubscription: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function remove() {
    setError(null);
    start(async () => {
      // При успехе сервер перенаправляет на главную: Next.js обрабатывает это сам, сюда управление не возвращается.
      try {
        const res = await deleteAccount({ password, confirm: word });
        if (res && !res.ok) setError(res.error);
      } catch {
        setError("Не получилось удалить аккаунт. Проверьте соединение и попробуйте ещё раз.");
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4 border-danger">
      <h2 className="text-xl">Удаление аккаунта</h2>
      <p className="text-muted">
        Аккаунт и все данные (прогресс, ошибки, чат, проверки IELTS, избранное) будут удалены без возможности восстановления.
        {hasSubscription && " Платная подписка отменится автоматически."}
      </p>
      {!open ? (
        <div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Удалить аккаунт
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <Input
            label={`Введите слово ${DELETE_CONFIRM_WORD}`}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            hint="Так мы убеждаемся, что это не случайное нажатие"
          />
          <Msg error={error} />
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" onClick={remove} loading={pending} disabled={!password || word !== DELETE_CONFIRM_WORD}>
              Удалить навсегда
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
