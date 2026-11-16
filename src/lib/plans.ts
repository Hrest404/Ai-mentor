/** Лимиты бесплатного тарифа. Единый источник: лендинг, страница тарифов, а с этапа 6 и проверки на сервере. */
export const FREE_LIMITS = {
  practiceMinutesPerDay: 20,
  lessons: 7,
  aiExplanationsPerDay: 5,
  phrasebookSituations: 2,
} as const;

/** Цена PRO не задана (подключение оплаты на этапе 10). null показывает «цена уточняется». */
export const PRO_PRICE: { amount: number; currency: string; period: string } | null = null;

export const FREE_FEATURES = [
  `${FREE_LIMITS.practiceMinutesPerDay} минут практики в день, лимит обновляется каждые 24 часа`,
  `Первые ${FREE_LIMITS.lessons} уроков курса`,
  `${FREE_LIMITS.aiExplanationsPerDay} AI-разборов ошибок в день`,
  "Тест уровня и все типы упражнений",
  `${FREE_LIMITS.phrasebookSituations} ситуации разговорника`,
];

export const PRO_FEATURES = [
  "Практика без дневного лимита, весь курс",
  "Проверка произношения по словам",
  "Проверка грамматики и правописания в ваших текстах",
  "IELTS Writing и Speaking с оценкой по критериям",
  "Чат-ментор с ролевыми диалогами",
  "План под дату экзамена, повторение слабых тем, еженедельный отчёт",
];

/** Строки таблицы сравнения: [что, Free, PRO]. */
export const COMPARISON: [string, string, string][] = [
  ["Практика в день", `${FREE_LIMITS.practiceMinutesPerDay} минут`, "Без лимита"],
  ["Уроки курса", `Первые ${FREE_LIMITS.lessons}`, "Все 36"],
  ["AI-разбор ошибок", `${FREE_LIMITS.aiExplanationsPerDay} в день`, "Без лимита"],
  ["Тест уровня и упражнения", "Да", "Да"],
  ["Разговорник", `${FREE_LIMITS.phrasebookSituations} ситуации из 8`, "Все 8 ситуаций"],
  ["Проверка произношения", "Нет", "Да"],
  ["Проверка грамматики и правописания", "Нет", "Да"],
  ["IELTS Writing и Speaking", "Нет", "Да"],
  ["Чат-ментор", "Нет", "Да"],
  ["План под дату экзамена", "Нет", "Да"],
];
