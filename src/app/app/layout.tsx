// Личный кабинет (этап 3 добавит защиту и навигацию).
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>;
}
