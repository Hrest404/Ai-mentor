import { SITUATIONS, type SituationDef } from "@/content/phrasebook";
import type { Plan } from "./limits";

/** Разговорник читается из кода, как и курс; те же строки лежат в базе ради ключей избранного. */

export interface PhraseView {
  id: string;
  situationId: string;
  en: string;
  ru: string;
  note?: string;
}

export interface SituationView {
  id: string;
  title: string;
  description: string;
  isFree: boolean;
  /** Закрыта тарифом: фразы в браузер не отправляются. */
  locked: boolean;
  count: number;
  phrases: PhraseView[];
}

/** Идентификатор фразы совпадает с тем, что пишет сид: «restaurant-3». */
export const phraseId = (situationId: string, index: number) => `${situationId}-${index + 1}`;

export const situationAllowed = (s: Pick<SituationDef, "isFree">, plan: Plan) => plan === "pro" || s.isFree;

/** Ситуации для кабинета: закрытые тарифом приходят без фраз, чтобы их нельзя было прочитать в данных страницы. */
export function buildSituations(plan: Plan, source: SituationDef[] = SITUATIONS): SituationView[] {
  return source.map((s) => {
    const open = situationAllowed(s, plan);
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      isFree: s.isFree,
      locked: !open,
      count: s.phrases.length,
      phrases: open
        ? s.phrases.map(([en, ru, note], i) => ({ id: phraseId(s.id, i), situationId: s.id, en, ru, ...(note ? { note } : {}) }))
        : [],
    };
  });
}

/** Находит фразу по идентификатору вместе с её ситуацией. */
export function findPhrase(id: string, source: SituationDef[] = SITUATIONS): { situation: SituationDef; phrase: PhraseView } | null {
  for (const s of source) {
    const i = s.phrases.findIndex((_, k) => phraseId(s.id, k) === id);
    if (i >= 0) {
      const [en, ru, note] = s.phrases[i];
      return { situation: s, phrase: { id, situationId: s.id, en, ru, ...(note ? { note } : {}) } };
    }
  }
  return null;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’‘`´ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Поиск по английскому тексту и переводу. Запрос разбивается на слова, фраза подходит, если каждое слово
 * встречается в ней как начало слова или часть слова. Без запроса возвращает пустой список.
 */
export function searchPhrases<T extends { en: string; ru: string }>(phrases: T[], query: string): T[] {
  const words = fold(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  return phrases.filter((p) => {
    const hay = `${fold(p.en)} ${fold(p.ru)}`;
    return words.every((w) => hay.includes(w));
  });
}

/** Перемешивание для карточек: Fisher-Yates с заданным источником случайности (для тестов). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
