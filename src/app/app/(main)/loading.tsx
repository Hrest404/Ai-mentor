/** Скелетон кабинета: показывается, пока сервер готовит страницу. Размеры близки к реальному содержимому, чтобы не прыгала вёрстка. */
export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="h-9 w-2/3 max-w-sm animate-pulse rounded-md bg-surface-alt" />
        <div className="h-5 w-1/2 max-w-xs animate-pulse rounded-md bg-surface-alt" />
      </div>
      <div className="h-36 animate-pulse rounded-lg bg-surface-alt" />
      <div className="grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-alt" />
        ))}
      </div>
      <span className="sr-only">Загружаем страницу…</span>
    </div>
  );
}
