import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

// Вход и регистрация: форма по центру. Вошедших сразу отправляем в кабинет.
export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (await getSession()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        Репетитор
      </Link>
      {children}
    </main>
  );
}
