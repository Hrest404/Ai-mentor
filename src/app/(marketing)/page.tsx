import { UiDemo } from "@/components/ui-demo";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <h1 className="text-4xl sm:text-5xl">Репетитор</h1>
      <p className="mt-4 mb-12 max-w-prose text-lg text-muted">
        Заготовка проекта: дизайн-токены и базовые компоненты. Лендинг появится на этапе 4.
      </p>
      <UiDemo />
    </main>
  );
}
