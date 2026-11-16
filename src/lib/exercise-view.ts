import type { ExerciseDef } from "@/content/types";

/** Упражнение в виде, который уходит в браузер: без правильных ответов. */
export type ClientExercise =
  | { id: string; kind: "choice"; prompt: string; options: string[] }
  | { id: string; kind: "fill_blank"; sentence: string }
  | { id: string; kind: "build_sentence"; ru: string; tokens: { id: number; text: string }[] }
  | { id: string; kind: "translate"; ru: string }
  | { id: string; kind: "listening"; audio: string; question: string; options: string[] }
  /** Для диктанта браузеру нужен сам текст (его озвучивает синтезатор речи), поэтому он виден в запросе. */
  | { id: string; kind: "dictation"; audio: string }
  | { id: string; kind: "match_pairs"; instruction: string; left: string[]; right: string[] };

/** Перемешивает копию массива; если порядок совпал с исходным и элементов больше одного, меняет его. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift() as T);
  return out;
}

export function toClientExercise(id: string, def: ExerciseDef, random: () => number = Math.random): ClientExercise {
  switch (def.kind) {
    case "choice":
      return { id, kind: "choice", prompt: def.prompt, options: shuffled(def.options, random) };
    case "fill_blank":
      return { id, kind: "fill_blank", sentence: def.sentence };
    case "build_sentence": {
      const tokens = [...def.words, ...def.extra].map((text, i) => ({ id: i, text }));
      return { id, kind: "build_sentence", ru: def.ru, tokens: shuffled(tokens, random) };
    }
    case "translate":
      return { id, kind: "translate", ru: def.ru };
    case "listening":
      return { id, kind: "listening", audio: def.audio, question: def.question, options: shuffled(def.options, random) };
    case "dictation":
      return { id, kind: "dictation", audio: def.audio };
    case "match_pairs":
      return {
        id,
        kind: "match_pairs",
        instruction: def.instruction,
        left: def.pairs.map((p) => p[0]),
        right: shuffled(
          def.pairs.map((p) => p[1]),
          random,
        ),
      };
  }
}
