/** Метка, после которой в ответе модели идёт поправка по-русски. */
export const CORRECTION_MARK = "---CORRECTION---";

export interface SplitReply {
  reply: string;
  /** Поправка ученику; null, если ошибок нет или поправка ещё не пришла. */
  correction: string | null;
}

/**
 * Делит ответ на реплику роли и поправку. Пока идёт поток (final=false), недописанная метка
 * («---CORR») в конце не попадает в реплику. Когда ответ закончен (final=true), текст показывается целиком.
 */
export function splitReply(text: string, final = false): SplitReply {
  const at = text.search(/-{3}\s*CORRECTION\s*-{3}/i);
  if (at !== -1) {
    const after = text.slice(at).replace(/^-{3}\s*CORRECTION\s*-{3}/i, "").trim();
    return { reply: text.slice(0, at).trim(), correction: after.length > 0 ? after : null };
  }
  if (final) return { reply: text.trim(), correction: null };
  // Хвост, похожий на начало метки, пока не показываем.
  let cut = text.length;
  for (let n = Math.min(CORRECTION_MARK.length - 1, text.length); n > 0; n--) {
    if (CORRECTION_MARK.startsWith(text.slice(text.length - n).toUpperCase())) {
      cut = text.length - n;
      break;
    }
  }
  return { reply: text.slice(0, cut).trim(), correction: null };
}
