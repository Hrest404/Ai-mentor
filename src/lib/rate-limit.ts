/**
 * Скользящее окно в памяти процесса: не больше `max` событий за `windowMs` на ключ.
 * Работает в пределах одного экземпляра сервера; общий суточный лимит живёт в базе (daily_usage).
 */
export function createLimiter(opts: { max: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return {
    /** Регистрирует попытку. ok=false: лимит исчерпан, retryAfterMs подсказывает, когда повторить. */
    check(key: string, now: number = Date.now()): { ok: boolean; retryAfterMs: number } {
      const from = now - opts.windowMs;
      const list = (hits.get(key) ?? []).filter((t) => t > from);
      if (list.length >= opts.max) {
        hits.set(key, list);
        return { ok: false, retryAfterMs: Math.max(0, list[0] + opts.windowMs - now) };
      }
      list.push(now);
      hits.set(key, list);
      // Не даём карте расти бесконечно.
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => t <= from)) hits.delete(k);
      return { ok: true, retryAfterMs: 0 };
    },
  };
}
