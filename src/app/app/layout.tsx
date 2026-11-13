import { requireUser } from "@/lib/session";

// Весь /app только для вошедших. Проверка на сервере: сессия сверяется с базой.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();
  return <>{children}</>;
}
