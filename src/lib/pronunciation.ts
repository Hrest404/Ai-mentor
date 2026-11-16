import { normalizeText } from "./answers";

/**
 * Сравнение сказанного с эталоном по словам. Распознавание речи отдаёт текст, поэтому проверяется то, что
 * браузер «услышал»: слово, которое он не узнал, чаще всего произнесено неразборчиво или неверно.
 */

export type WordStatus = "ok" | "wrong" | "missed";

export interface WordResult {
  /** Слово эталона так, как оно записано. */
  word: string;
  status: WordStatus;
  /** Что распознано вместо него (для «wrong»). */
  heard?: string;
}

export interface PronunciationResult {
  words: WordResult[];
  /** Доля верно распознанных слов эталона, 0..100. */
  accuracy: number;
  /** Сказанные слова, которых нет в эталоне. */
  extra: string[];
}

interface Unit {
  text: string;
  /** Номер слова в исходной записи (сокращение «don't» даёт две единицы с одним владельцем). */
  owner: number;
}

/** Слова для сравнения. Сокращения раскрываются (don't = do not), чтобы не наказывать за форму записи. */
function toUnits(tokens: string[]): Unit[] {
  return tokens.flatMap((t, owner) =>
    normalizeText(t)
      .split(" ")
      .filter(Boolean)
      .map((text) => ({ text, owner })),
  );
}

export function compareSpeech(reference: string, spoken: string): PronunciationResult {
  const refTokens = reference.split(/\s+/).filter((t) => normalizeText(t));
  const heardTokens = spoken.split(/\s+/).filter((t) => normalizeText(t));
  const ref = toUnits(refTokens);
  const heard = toUnits(heardTokens);
  const n = ref.length;
  const m = heard.length;

  // Наибольшая общая подпоследовательность сохраняет порядок слов.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = ref[i].text === heard[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const matchedRef = new Set<number>();
  const pairedHeard = new Map<number, number>(); // единица эталона → непарное слово между теми же опорными
  const usedHeard = new Set<number>();
  let gapRef: number[] = [];
  let gapHeard: number[] = [];
  const flushGap = () => {
    // Между двумя совпавшими словами k-е пропущенное сопоставляется с k-м лишним: «услышано вместо».
    gapRef.forEach((r, k) => {
      if (k < gapHeard.length) {
        pairedHeard.set(r, gapHeard[k]);
        usedHeard.add(gapHeard[k]);
      }
    });
    gapRef = [];
    gapHeard = [];
  };

  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ref[i].text === heard[j].text) {
      flushGap();
      matchedRef.add(i);
      usedHeard.add(j);
      i++;
      j++;
    } else if (j >= m || (i < n && dp[i + 1][j] >= dp[i][j + 1])) {
      gapRef.push(i++);
    } else {
      gapHeard.push(j++);
    }
  }
  flushGap();

  const words: WordResult[] = refTokens.map((word, owner) => {
    const own = ref.flatMap((u, k) => (u.owner === owner ? [k] : []));
    if (own.every((k) => matchedRef.has(k))) return { word, status: "ok" };
    const paired = own.map((k) => pairedHeard.get(k)).find((h) => h !== undefined);
    if (paired === undefined) return { word, status: "missed" };
    return { word, status: "wrong", heard: heardTokens[heard[paired].owner] };
  });

  const matchedHeardOwners = new Set<number>();
  heard.forEach((u, k) => {
    if (usedHeard.has(k)) matchedHeardOwners.add(u.owner);
  });
  const extra = heardTokens.filter((_, owner) => !matchedHeardOwners.has(owner));

  return { words, accuracy: n === 0 ? 0 : Math.round((matchedRef.size / n) * 100), extra };
}

/** Слова, на которые стоит обратить внимание: пропущенные и неверно распознанные, без знаков препинания. */
export function problemWords(result: PronunciationResult): string[] {
  return result.words
    .filter((w) => w.status !== "ok")
    .map((w) => w.word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""));
}
