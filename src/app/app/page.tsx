import type { Metadata } from "next";

export const metadata: Metadata = { title: "Кабинет" };

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-3xl">Личный кабинет</h1>
      <p className="mt-4 text-muted">Дашборд появится на этапах 3 и 5.</p>
    </>
  );
}
