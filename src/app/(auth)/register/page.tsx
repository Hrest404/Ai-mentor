import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Регистрация</h1>
        <p className="text-muted">Бесплатно: 20 минут практики каждый день.</p>
      </div>
      <AuthForm mode="register" />
    </>
  );
}
