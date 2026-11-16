/** Скелетон урока: полоса прогресса и карточка задания. */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка урока" className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="h-3 w-full animate-pulse rounded-full bg-surface-alt" />
      <div className="h-8 w-3/4 animate-pulse rounded-md bg-surface-alt" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-surface-alt" />
        ))}
      </div>
      <span className="sr-only">Загружаем урок…</span>
    </div>
  );
}
