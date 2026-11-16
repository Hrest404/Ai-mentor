import { AiError, aiAuth, aiBusy } from "./errors";

/** Статус HTTP из ошибки SDK (если есть). */
function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}

/** Временный сбой: стоит повторить, а затем перейти к следующей модели. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof AiError) return err.code === "bad_response";
  const status = statusOf(err);
  if (status === undefined) return true; // таймаут, обрыв сети
  return status === 408 || status === 429 || status >= 500;
}

export interface FallbackOptions {
  /** Повторов на одну модель при временном сбое. */
  retriesPerModel?: number;
  backoffMs?: number;
  /** Общий срок на всю цепочку, мс: после него новых попыток нет. */
  deadlineMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Вызывает модели по очереди. Временный сбой (429, 5xx, таймаут, битый JSON) повторяется,
 * затем выбирается следующая модель. 400 и 404 (модель недоступна или не поддерживает настройку)
 * сразу ведут к следующей. 401 и 403 (ключ) прекращают всё: другие модели не помогут.
 */
export async function runWithFallback<T>(
  models: string[],
  call: (model: string) => Promise<T>,
  options: FallbackOptions = {},
): Promise<{ value: T; model: string }> {
  const { retriesPerModel = 1, backoffMs = 400, deadlineMs = 30_000, sleep = defaultSleep, now = Date.now } = options;
  const deadline = now() + deadlineMs;
  let last: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      if (now() > deadline) throw aiBusy(last);
      try {
        return { value: await call(model), model };
      } catch (err) {
        last = err;
        const status = statusOf(err);
        if (status === 401 || status === 403) throw aiAuth(err);
        if (!isRetryable(err)) break; // 400, 404: пробуем следующую модель
        if (attempt < retriesPerModel) await sleep(backoffMs * 2 ** attempt);
      }
    }
  }
  throw aiBusy(last);
}
