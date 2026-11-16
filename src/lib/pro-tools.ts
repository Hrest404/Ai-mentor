/** PRO-инструменты: данные для хаба и закрытых страниц. Сами инструменты появятся на этапах 7 и 8. */
export interface ProTool {
  slug: string;
  title: string;
  text: string;
  /** Этап плана, на котором инструмент будет готов. */
  stage: number;
}

export const PRO_TOOLS: ProTool[] = [
  {
    slug: "chat",
    title: "Чат-ментор",
    text: "Ролевые диалоги на английском с исправлением реплик по ходу разговора.",
    stage: 7,
  },
  {
    slug: "pronunciation",
    title: "Проверка произношения",
    text: "Говорите вслух, а Репетитор сравнит речь с эталоном по словам и отметит проблемные.",
    stage: 8,
  },
  {
    slug: "writing",
    title: "Проверка текста",
    text: "Грамматика и правописание в ваших текстах с объяснением каждой правки.",
    stage: 8,
  },
  {
    slug: "ielts",
    title: "IELTS Writing и Speaking",
    text: "Оценка эссе и устных ответов по критериям экзамена, план подготовки под дату.",
    stage: 8,
  },
];

export const getProTool = (slug: string) => PRO_TOOLS.find((t) => t.slug === slug);
