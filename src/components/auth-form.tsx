"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD = 8;

type Fields = { name?: string; email?: string; password?: string };

/** Сообщение на русском по коду ошибки better-auth. */
function messageFor(code: string | undefined, mode: "login" | "register"): string {
  if (code?.startsWith("USER_ALREADY_EXISTS")) return "Аккаунт с такой почтой уже есть. Попробуйте войти.";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "Неверная почта или пароль.";
  if (code === "INVALID_EMAIL") return "Проверьте адрес почты.";
  if (code === "PASSWORD_TOO_SHORT") return `Пароль должен быть не короче ${MIN_PASSWORD} символов.`;
  if (code === "PASSWORD_TOO_LONG") return "Пароль слишком длинный.";
  if (code === "TOO_MANY_REQUESTS") return "Слишком много попыток. Подождите минуту и попробуйте снова.";
  return mode === "login"
    ? "Не получилось войти. Попробуйте ещё раз."
    : "Не получилось создать аккаунт. Попробуйте ещё раз.";
}

function validate(mode: "login" | "register", name: string, email: string, password: string): Fields {
  const errors: Fields = {};
  if (mode === "register" && name.trim().length < 2) errors.name = "Введите имя, минимум 2 буквы";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Введите почту в формате name@example.com";
  if (!password) errors.password = "Введите пароль";
  else if (mode === "register" && password.length < MIN_PASSWORD)
    errors.password = `Минимум ${MIN_PASSWORD} символов`;
  return errors;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(mode, name, email, password);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setLoading(true);
    const { error } = isRegister
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });

    if (error) {
      setLoading(false);
      setFormError(messageFor(error.code ?? (error.status === 429 ? "TOO_MANY_REQUESTS" : undefined), mode));
      return;
    }
    // Кабинет сам отправит на онбординг, если он ещё не пройден.
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {isRegister && (
        <Input
          label="Имя"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
      )}
      <Input
        label="Почта"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <Input
        label="Пароль"
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint={isRegister ? `Минимум ${MIN_PASSWORD} символов` : undefined}
      />

      {formError && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" loading={loading}>
        {isRegister ? "Создать аккаунт" : "Войти"}
      </Button>

      <p className="text-muted">
        {isRegister ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-action underline underline-offset-4 hover:text-action-hover"
        >
          {isRegister ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </form>
  );
}
