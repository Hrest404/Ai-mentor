"use client";

/** Последняя граница: срабатывает, если упал сам корневой макет. Своя разметка без общих компонентов и стилей. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <main style={{ maxWidth: 480 }} role="alert">
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Сервис временно недоступен</h1>
          <p style={{ fontSize: 18, lineHeight: 1.5 }}>Произошёл сбой. Ваш прогресс не потерян. Попробуйте обновить страницу чуть позже.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, minHeight: 48, padding: "0 24px", fontSize: 18, borderRadius: 8, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}
          >
            Попробовать снова
          </button>
        </main>
      </body>
    </html>
  );
}
