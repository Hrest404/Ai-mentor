import { describe, expect, it } from "vitest";
import { compareSpeech, problemWords } from "./pronunciation";

describe("compareSpeech", () => {
  it("точное совпадение: все слова верны, точность 100", () => {
    const r = compareSpeech("Nice to meet you.", "nice to meet you");
    expect(r.words.map((w) => w.status)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(r.accuracy).toBe(100);
    expect(r.extra).toEqual([]);
  });

  it("не наказывает за регистр, знаки препинания и форму сокращения", () => {
    const r = compareSpeech("I don't understand, sorry.", "I do not understand sorry");
    expect(r.words.every((w) => w.status === "ok")).toBe(true);
    expect(r.accuracy).toBe(100);
  });

  it("неверно распознанное слово отмечается и показывает, что услышано", () => {
    const r = compareSpeech("I live in a big city", "I leave in a big city");
    expect(r.words.map((w) => w.status)).toEqual(["ok", "wrong", "ok", "ok", "ok", "ok"]);
    expect(r.words[1].heard).toBe("leave");
    expect(r.accuracy).toBe(83);
    expect(problemWords(r)).toEqual(["live"]);
  });

  it("пропущенное слово отмечается как missed", () => {
    const r = compareSpeech("Could you speak more slowly, please?", "could you speak slowly please");
    expect(r.words.find((w) => w.word === "more")?.status).toBe("missed");
    expect(r.accuracy).toBe(83);
  });

  it("лишние слова не портят точность, но попадают в extra", () => {
    const r = compareSpeech("See you later", "well see you later alright");
    expect(r.words.every((w) => w.status === "ok")).toBe(true);
    expect(r.extra).toEqual(["well", "alright"]);
  });

  it("порядок слов важен", () => {
    const r = compareSpeech("one two three", "three two one");
    expect(r.accuracy).toBeLessThan(100);
  });

  it("пустая речь: всё пропущено, точность 0", () => {
    const r = compareSpeech("Have a nice day", "");
    expect(r.words.every((w) => w.status === "missed")).toBe(true);
    expect(r.accuracy).toBe(0);
  });

  it("пустой эталон не ломается", () => {
    expect(compareSpeech("", "hello")).toEqual({ words: [], accuracy: 0, extra: ["hello"] });
  });
});
