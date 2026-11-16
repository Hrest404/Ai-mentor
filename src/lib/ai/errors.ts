/** Ошибки AI-слоя. Интерфейс по коду показывает понятное сообщение и не падает. */
export type AiErrorCode = "unavailable" | "auth" | "busy" | "bad_response";

export class AiError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Ключ не задан: AI выключен. */
export const aiUnavailable = () => new AiError("unavailable", "GEMINI_API_KEY не задан");
/** Ключ отклонён сервисом (401/403). Повторы и другие модели не помогут. */
export const aiAuth = (cause?: unknown) => new AiError("auth", "Ключ Gemini отклонён", cause);
/** Сервис перегружен или не ответил вовремя на всех моделях. */
export const aiBusy = (cause?: unknown) => new AiError("busy", "Gemini сейчас недоступен", cause);
/** Модель вернула не тот формат. */
export const aiBadResponse = (message: string, cause?: unknown) => new AiError("bad_response", message, cause);

/** Текст для пользователя по коду ошибки. */
export function aiErrorMessage(code: AiErrorCode): string {
  switch (code) {
    case "unavailable":
      return "AI-ментор пока не подключён. Попробуйте позже.";
    case "auth":
      return "Не удалось связаться с AI-ментором: проблема с доступом. Мы уже знаем.";
    case "busy":
      return "AI-ментор сейчас перегружен. Попробуйте ещё раз через минуту, лимит не списан.";
    case "bad_response":
      return "AI-ментор ответил непонятно. Попробуйте ещё раз, лимит не списан.";
  }
}
