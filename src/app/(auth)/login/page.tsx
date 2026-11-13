import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Вход</h1>
        <p className="text-muted">Продолжайте с того места, где остановились.</p>
      </div>
      <AuthForm mode="login" />
    </>
  );
}
