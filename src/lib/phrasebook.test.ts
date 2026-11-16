import { describe, expect, it } from "vitest";
import { SITUATIONS } from "@/content/phrasebook";
import { buildSituations, findPhrase, phraseId, searchPhrases, shuffle } from "./phrasebook";

describe("buildSituations", () => {
  it("Free видит фразы только открытых ситуаций, остальные приходят пустыми", () => {
    const view = buildSituations("free");
    expect(view).toHaveLength(SITUATIONS.length);
    for (const s of view) {
      const def = SITUATIONS.find((d) => d.id === s.id)!;
      expect(s.count).toBe(def.phrases.length);
      expect(s.locked).toBe(!def.isFree);
      expect(s.phrases.length).toBe(def.isFree ? def.phrases.length : 0);
    }
    expect(view.filter((s) => !s.locked)).toHaveLength(2);
  });

  it("PRO видит всё", () => {
    const view = buildSituations("pro");
    expect(view.every((s) => !s.locked && s.phrases.length === s.count)).toBe(true);
    expect(view.reduce((n, s) => n + s.count, 0)).toBe(120);
  });

  it("закрытые фразы не попадают в сериализованные данные для Free", () => {
    const locked = SITUATIONS.find((s) => !s.isFree)!;
    const json = JSON.stringify(buildSituations("free"));
    expect(json).not.toContain(locked.phrases[0][0]);
  });
});

describe("идентификаторы фраз", () => {
  it("совпадают с сидом и находятся обратно", () => {
    expect(phraseId("restaurant", 2)).toBe("restaurant-3");
    const found = findPhrase("restaurant-3")!;
    expect(found.situation.id).toBe("restaurant");
    expect(found.phrase.en).toBe(SITUATIONS.find((s) => s.id === "restaurant")!.phrases[2][0]);
    expect(findPhrase("restaurant-999")).toBeNull();
    expect(findPhrase("nonsense")).toBeNull();
  });

  it("все идентификаторы уникальны", () => {
    const ids = SITUATIONS.flatMap((s) => s.phrases.map((_, i) => phraseId(s.id, i)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("searchPhrases", () => {
  const phrases = [
    { en: "Could you speak more slowly, please?", ru: "Не могли бы вы говорить медленнее?" },
    { en: "I'm from Russia.", ru: "Я из России." },
    { en: "Nice to meet you.", ru: "Приятно познакомиться." },
  ];

  it("ищет по английскому и по русскому, без учёта регистра и знаков", () => {
    expect(searchPhrases(phrases, "SLOWLY")).toHaveLength(1);
    expect(searchPhrases(phrases, "медленнее")).toHaveLength(1);
    expect(searchPhrases(phrases, "из россии")).toHaveLength(1);
    expect(searchPhrases(phrases, "im from")).toHaveLength(0); // апостроф не выбрасывается из слова
    expect(searchPhrases(phrases, "i'm from")).toHaveLength(1);
  });

  it("все слова запроса должны встретиться; ё приравнивается к е", () => {
    expect(searchPhrases(phrases, "nice meet")).toHaveLength(1);
    expect(searchPhrases(phrases, "nice slowly")).toHaveLength(0);
  });

  it("пустой запрос и запрос из одних знаков дают пустой список", () => {
    expect(searchPhrases(phrases, "")).toEqual([]);
    expect(searchPhrases(phrases, " ?! ")).toEqual([]);
  });
});

describe("shuffle", () => {
  it("сохраняет набор элементов и не меняет исходный массив", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, () => 0.3);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});
