/** Русские названия категорий ошибок (поле tag у упражнений). */
export const TAG_LABELS: Record<string, string> = {
  "ps-third-person": "Окончание -s: he, she, it",
  "ps-affirmative": "Утверждения в Present Simple",
  "ps-negative": "Отрицания: don't и doesn't",
  "ps-question": "Вопросы: do и does",
  "ps-short-answer": "Краткие ответы",
  "ps-adverbs": "Наречия частоты",
  "ps-timetable": "Расписания в Present Simple",

  "pc-form": "Форма Present Continuous",
  "pc-spelling": "Написание -ing",
  "pc-negative": "Отрицания в Present Continuous",
  "pc-question": "Вопросы в Present Continuous",
  "pc-short-answer": "Краткие ответы (to be)",
  "pc-vs-simple": "Simple или Continuous",
  "pc-stative": "Глаголы состояния",
  "pc-future": "Планы в Present Continuous",
  "pc-temporary": "Временные ситуации",

  "past-regular": "Правильные глаголы (-ed)",
  "past-spelling": "Написание -ed",
  "past-irregular": "Неправильные глаголы",
  "past-negative": "Отрицания: didn't",
  "past-question": "Вопросы с did",
  "past-short-answer": "Краткие ответы (did)",
  "past-be": "Was и were",

  "art-a-an": "A или an",
  "art-the": "Артикль the",
  "art-zero": "Без артикля",
  "art-geo": "Артикли с названиями мест",
  "art-fixed": "Устойчивые выражения с артиклями",

  "fut-will": "Will",
  "fut-going-to": "Be going to",
  "fut-timetable": "Расписания и будущее",
  "fut-arrangement": "Договорённости",
  "fut-choice": "Какую форму выбрать",
  "fut-time-clause": "Время после when, if",

  "ielts-task-type": "Типы заданий IELTS",
  "ielts-format": "Формат Writing",
  "ielts-structure": "Структура эссе",
  "ielts-linkers": "Связки",
  "ielts-style": "Академический стиль",
  "ielts-thesis": "Тезис",
  "ielts-argument": "Аргументация",
};

export const tagLabel = (tag: string): string => TAG_LABELS[tag] ?? tag;
