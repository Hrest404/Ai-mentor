import type { Metadata } from "next";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl">Вход</h1>
      <p className="text-muted">Форма входа появится на этапе 3.</p>
    </>
  );
}
