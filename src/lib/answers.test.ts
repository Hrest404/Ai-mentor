import { describe, expect, it } from "vitest";
import { buildCourse } from "@/content/course";
import { exerciseSchema, type ExerciseDef } from "@/content/types";
import { answerToText, checkAnswer, normalizeText } from "./answers";

const fb = (answers: string[]): ExerciseDef => ({
  kind: "fill_blank", tag: "t", explanation: "e", sentence: "He ___ tennis.", answers,
});

describe("normalizeText", () => {
  it("игнорирует регистр, пробелы и знаки препинания", () => {
    expect(normalizeText("  Hello,   World!  ")).toBe("hello world");
    expect(normalizeText("What are you doing?")).toBe("what are you doing");
  });

  it("приводит апострофы к одному виду", () => {
    expect(normalizeText("don’t")).toBe(normalizeText("don't"));
    expect(normalizeText("I`m here")).toBe(normalizeText("I'm here"));
  });

  it("раскрывает сокращения: don't = do not, I'm = I am, we're = we are, I'll = I will", () => {
    expect(normalizeText("I don't know")).toBe(normalizeText("I do not know"));
    expect(normalizeText("She doesn't work")).toBe("she does not work");
    expect(normalizeText("I'm reading")).toBe("i am reading");
    expect(normalizeText("We're late")).toBe("we are late");
    expect(normalizeText("I'll call")).toBe("i will call");
    expect(normalizeText("I won't go")).toBe("i will not go");
    expect(normalizeText("I can't go")).toBe(normalizeText("I cannot go"));
  });

  it("не склеивает разные слова и сохраняет o'clock", () => {
    expect(normalizeText("seven o'clock")).toBe("seven o'clock");
    expect(normalizeText("she works")).not.toBe(normalizeText("she work"));
  });
});

describe("checkAnswer", () => {
  it("choice: точное совпадение с вариантом", () => {
    const ex: ExerciseDef = { kind: "choice", tag: "t", explanation: "e", prompt: "p", options: ["a", "b"], answer: "b" };
    expect(checkAnswer(ex, "b").correct).toBe(true);
    expect(checkAnswer(ex, "a").correct).toBe(false);
    expect(checkAnswer(ex, 5).correct).toBe(false);
    expect(checkAnswer(ex, ["b"]).correct).toBe(false);
    expect(checkAnswer(ex, "a").correctAnswer).toBe("b");
  });

  it("fill_blank: любой допустимый вариант, без учёта регистра и сокращений", () => {
    const ex = fb(["doesn't play", "does not play"]);
    expect(checkAnswer(ex, "Doesn't play").correct).toBe(true);
    expect(checkAnswer(ex, "does not play.").correct).toBe(true);
    expect(checkAnswer(ex, "don't play").correct).toBe(false);
    expect(checkAnswer(ex, "").correct).toBe(false);
    expect(checkAnswer(ex, "doesn't play").correctAnswer).toBe("He doesn't play tennis.");
  });

  it("fill_blank: подсказка в скобках не попадает в эталонный ответ", () => {
    const ex: ExerciseDef = {
      kind: "fill_blank", tag: "t", explanation: "e", sentence: "My brother ___ (watch) TV every evening.", answers: ["watches"],
    };
    expect(checkAnswer(ex, "x").correctAnswer).toBe("My brother watches TV every evening.");
    const ex2 = fb(["doesn't play"]);
    expect(checkAnswer(ex2, "x").correctAnswer).toBe("He doesn't play tennis.");
  });

  it("translate и dictation: нормализация, любой допустимый перевод", () => {
    const tr: ExerciseDef = { kind: "translate", tag: "t", explanation: "e", ru: "р", answers: ["She likes coffee", "She loves coffee"] };
    expect(checkAnswer(tr, "she LOVES coffee!").correct).toBe(true);
    expect(checkAnswer(tr, "She like coffee").correct).toBe(false);
    const di: ExerciseDef = { kind: "dictation", tag: "t", explanation: "e", audio: "I'm reading a book." };
    expect(checkAnswer(di, "i am reading a book").correct).toBe(true);
    expect(checkAnswer(di, "I read a book").correct).toBe(false);
  });

  it("build_sentence: порядок слов важен", () => {
    const ex: ExerciseDef = {
      kind: "build_sentence", tag: "t", explanation: "e", ru: "р", words: ["We", "live", "in", "London"], extra: ["lives"],
    };
    expect(checkAnswer(ex, ["We", "live", "in", "London"]).correct).toBe(true);
    expect(checkAnswer(ex, ["we", "live", "in", "london"]).correct).toBe(true);
    expect(checkAnswer(ex, ["We", "in", "live", "London"]).correct).toBe(false);
    expect(checkAnswer(ex, ["We", "lives", "in", "London"]).correct).toBe(false);
    expect(checkAnswer(ex, "We live in London").correct).toBe(false);
  });

  it("match_pairs: все пары должны совпасть", () => {
    const ex: ExerciseDef = {
      kind: "match_pairs", tag: "t", explanation: "e", instruction: "i",
      pairs: [["go", "went"], ["buy", "bought"], ["see", "saw"]],
    };
    expect(checkAnswer(ex, { go: "went", buy: "bought", see: "saw" }).correct).toBe(true);
    expect(checkAnswer(ex, { go: "bought", buy: "went", see: "saw" }).correct).toBe(false);
    expect(checkAnswer(ex, { go: "went", buy: "bought" }).correct).toBe(false);
    expect(checkAnswer(ex, { go: "went", buy: "bought", see: "saw", extra: "x" }).correct).toBe(false);
    expect(checkAnswer(ex, null).correct).toBe(false);
  });

  it("answerToText для журнала попыток", () => {
    expect(answerToText("x")).toBe("x");
    expect(answerToText(["a", "b"])).toBe("a b");
    expect(answerToText({ a: "b" })).toBe('{"a":"b"}');
    expect(answerToText(undefined)).toBe("null");
  });
});

describe("весь курс: каждое упражнение согласовано с проверкой ответов", () => {
  const defs = buildCourse().exercises.map((e) => ({
    id: e.id,
    def: exerciseSchema.parse({ kind: e.kind, tag: e.tag, ...e.payload }),
  }));

  it("эталонный ответ проходит, заведомо неверный не проходит", () => {
    const failures: string[] = [];
    for (const { id, def } of defs) {
      let right: unknown;
      let wrong: unknown;
      switch (def.kind) {
        case "choice":
        case "listening":
          right = def.answer;
          wrong = def.options.find((o) => o !== def.answer);
          break;
        case "fill_blank":
        case "translate":
          right = def.answers[0];
          wrong = "zzz qqq";
          break;
        case "dictation":
          right = def.audio;
          wrong = "zzz qqq";
          break;
        case "build_sentence":
          right = def.words;
          wrong = [...def.words].reverse();
          break;
        case "match_pairs":
          right = Object.fromEntries(def.pairs);
          wrong = Object.fromEntries(def.pairs.map((p, i) => [p[0], def.pairs[(i + 1) % def.pairs.length][1]]));
          break;
      }
      if (!checkAnswer(def, right).correct) failures.push(`${id}: эталон не принят`);
      if (checkAnswer(def, wrong).correct) failures.push(`${id}: неверный ответ принят`);
      if (def.kind === "fill_blank" || def.kind === "translate") {
        for (const a of def.answers) if (!checkAnswer(def, a).correct) failures.push(`${id}: вариант «${a}» не принят`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("палиндром слов не делает сборку предложения двусмысленной", () => {
    const bad = defs.filter(
      (d) => d.def.kind === "build_sentence" && d.def.words.join(" ") === [...d.def.words].reverse().join(" "),
    );
    expect(bad.map((d) => d.id)).toEqual([]);
  });
});
