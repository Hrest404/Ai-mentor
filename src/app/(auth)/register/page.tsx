import type { Metadata } from "next";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-3xl">Регистрация</h1>
      <p className="text-muted">Форма регистрации появится на этапе 3.</p>
    </>
  );
}
