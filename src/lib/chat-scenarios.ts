/** Сценарии чата-ментора: роль, место действия и первая реплика (без обращения к модели). */
export interface ChatScenario {
  id: string;
  title: string;
  description: string;
  /** Кто говорит с учеником (для системной инструкции). */
  persona: string;
  setting: string;
  opening: string;
}

export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: "cafe",
    title: "Кафе",
    description: "Закажите кофе и десерт, спросите про состав блюд.",
    persona: "Sam, a friendly waiter in a small London cafe",
    setting: "a cafe; the learner is a customer ordering food and drinks",
    opening: "Good morning, and welcome to Brew & Bread! What can I get for you today?",
  },
  {
    id: "airport",
    title: "Аэропорт",
    description: "Регистрация на рейс, багаж и паспортный контроль.",
    persona: "Maria, a check-in agent at an international airport",
    setting: "an airport check-in desk; the learner is a passenger flying abroad",
    opening: "Hello! Good afternoon. May I see your passport and your booking, please?",
  },
  {
    id: "hotel",
    title: "Отель",
    description: "Заселение, просьбы на ресепшене, проблемы в номере.",
    persona: "Daniel, a receptionist at a hotel",
    setting: "a hotel reception; the learner is a guest checking in or asking for help",
    opening: "Good evening, welcome to the Riverside Hotel. Do you have a reservation with us?",
  },
  {
    id: "shopping",
    title: "Магазин одежды",
    description: "Размеры, цвет, примерка и оплата.",
    persona: "Emma, a shop assistant in a clothing store",
    setting: "a clothing store; the learner is a customer looking for something to buy",
    opening: "Hi there! Let me know if you need any help finding something.",
  },
  {
    id: "smalltalk",
    title: "Знакомство",
    description: "Лёгкая беседа о себе, работе и увлечениях.",
    persona: "Alex, a friendly person the learner has just met at a language meetup",
    setting: "a casual meetup where people practise English",
    opening: "Hi! I'm Alex. I don't think we've met. What's your name, and where are you from?",
  },
];

export const getScenario = (id: string) => CHAT_SCENARIOS.find((s) => s.id === id);

/** Не больше сообщений пользователя в сутки в PRO и в минуту: защита от злоупотреблений и счёта за модель. */
export const CHAT_MESSAGES_PER_DAY = 300;
export const CHAT_MESSAGES_PER_MINUTE = 12;
export const CHAT_MESSAGE_MAX_LENGTH = 500;
