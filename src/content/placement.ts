import type { Level } from "./types";

export interface PlacementQuestion {
  id: string;
  level: Level;
  prompt: string;
  options: string[];
  answer: string;
}

/** Тест уровня: 12 вопросов от A1 до C1, сложность растёт. */
export const PLACEMENT: PlacementQuestion[] = [
  { id: "q1", level: "A1", prompt: "She ___ a teacher.", options: ["am", "is", "are", "be"], answer: "is" },
  { id: "q2", level: "A1", prompt: "I ___ coffee every morning.", options: ["drink", "drinks", "drinking", "am drink"], answer: "drink" },
  { id: "q3", level: "A2", prompt: "We ___ to the cinema yesterday.", options: ["go", "went", "gone", "going"], answer: "went" },
  { id: "q4", level: "A2", prompt: "There isn't ___ milk in the fridge.", options: ["some", "any", "a", "many"], answer: "any" },
  { id: "q5", level: "A2", prompt: "She is ___ than her brother.", options: ["tall", "taller", "tallest", "more tall"], answer: "taller" },
  { id: "q6", level: "B1", prompt: "I ___ here since 2019.", options: ["live", "am living", "have lived", "lived"], answer: "have lived" },
  { id: "q7", level: "B1", prompt: "If I ___ more time, I would learn Spanish.", options: ["have", "had", "will have", "would have"], answer: "had" },
  { id: "q8", level: "B1", prompt: "The bridge ___ in 1990.", options: ["built", "was built", "is built", "has built"], answer: "was built" },
  { id: "q9", level: "B2", prompt: "By the time we arrived, the film ___.", options: ["already started", "had already started", "has already started", "is already started"], answer: "had already started" },
  { id: "q10", level: "B2", prompt: "I wish I ___ harder when I was at school.", options: ["studied", "had studied", "would study", "have studied"], answer: "had studied" },
  { id: "q11", level: "C1", prompt: "Hardly ___ the house when it started to rain.", options: ["I had left", "had I left", "I left", "did I leave"], answer: "had I left" },
  { id: "q12", level: "C1", prompt: "She is said ___ three languages fluently.", options: ["speaking", "to speak", "that speaks", "speak"], answer: "to speak" },
];

/** Сколько вопросов отвечено верно. answers: id вопроса → выбранный вариант. */
export function scorePlacement(answers: Record<string, string>): number {
  return PLACEMENT.filter((q) => answers[q.id] === q.answer).length;
}

/** Уровень по числу верных ответов из 12. */
export function levelFromScore(score: number): Level {
  if (score <= 2) return "A1";
  if (score <= 5) return "A2";
  if (score <= 8) return "B1";
  if (score <= 10) return "B2";
  return "C1";
}
