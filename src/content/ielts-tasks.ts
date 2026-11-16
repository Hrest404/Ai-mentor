/** Банк заданий IELTS. Writing: формат General Training (письмо и эссе); Speaking: три части. */

export interface WritingTask {
  id: string;
  task: 1 | 2;
  title: string;
  prompt: string;
}

export const WRITING_TASKS: WritingTask[] = [
  {
    id: "w1-neighbour-noise",
    task: 1,
    title: "Письмо соседу о шуме",
    prompt:
      "Your neighbour often plays loud music late at night.\n\nWrite a letter to your neighbour. In your letter:\n- explain what the problem is\n- say how it affects you\n- suggest what your neighbour could do about it\n\nWrite at least 150 words. Begin your letter with: Dear ...",
  },
  {
    id: "w1-lost-bag",
    task: 1,
    title: "Письмо о потерянной сумке",
    prompt:
      "You left a bag on a train yesterday.\n\nWrite a letter to the railway company. In your letter:\n- describe the bag and what was inside\n- explain where and when you lost it\n- say what you would like the company to do\n\nWrite at least 150 words. Begin your letter with: Dear Sir or Madam,",
  },
  {
    id: "w1-course-friend",
    task: 1,
    title: "Письмо другу о курсах",
    prompt:
      "A friend has asked you to recommend an evening course to take.\n\nWrite a letter to your friend. In your letter:\n- suggest a course\n- explain why it would be useful\n- offer to join the course with your friend\n\nWrite at least 150 words. Begin your letter with: Dear ...",
  },
  {
    id: "w1-refund",
    task: 1,
    title: "Жалоба магазину",
    prompt:
      "You bought a laptop online, but it arrived damaged.\n\nWrite a letter to the shop manager. In your letter:\n- describe the problem\n- explain what you have already done\n- say what you expect the shop to do\n\nWrite at least 150 words. Begin your letter with: Dear Sir or Madam,",
  },
  {
    id: "w2-remote-work",
    task: 2,
    title: "Работа из дома",
    prompt:
      "More and more people are working from home instead of going to an office.\n\nDo the advantages of this trend outweigh the disadvantages?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
  {
    id: "w2-social-media",
    task: 2,
    title: "Соцсети и общение",
    prompt:
      "Some people think that social media has made people less sociable, while others believe it helps them stay in touch.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
  {
    id: "w2-university",
    task: 2,
    title: "Цель высшего образования",
    prompt:
      "Some people believe that the main purpose of university education is to prepare students for work. Others think it has wider benefits.\n\nDiscuss both views and give your own opinion.\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
  {
    id: "w2-public-transport",
    task: 2,
    title: "Транспорт в городах",
    prompt:
      "In many cities, traffic and pollution are growing problems. Some people say governments should invest in public transport rather than build more roads.\n\nTo what extent do you agree or disagree?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
  {
    id: "w2-children-screens",
    task: 2,
    title: "Дети и экраны",
    prompt:
      "Children today spend many hours every day looking at screens.\n\nWhat problems does this cause, and what can parents and schools do about it?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
  {
    id: "w2-english-global",
    task: 2,
    title: "Английский как мировой язык",
    prompt:
      "English is increasingly used as a common language in business and education around the world.\n\nIs this a positive or negative development?\n\nGive reasons for your answer and include any relevant examples from your own knowledge or experience.\n\nWrite at least 250 words.",
  },
];

export const getWritingTask = (id: string) => WRITING_TASKS.find((t) => t.id === id);

export interface SpeakingSet {
  id: string;
  title: string;
  part1: { topic: string; questions: string[] };
  part2: { cue: string; points: string[] };
  part3: string[];
}

export const SPEAKING_SETS: SpeakingSet[] = [
  {
    id: "s-home-place",
    title: "Дом и места",
    part1: {
      topic: "Home",
      questions: [
        "Do you live in a house or a flat?",
        "What do you like most about your home?",
        "Which room do you spend most time in, and why?",
        "Would you like to move to a different place in the future?",
      ],
    },
    part2: {
      cue: "Describe a place you enjoy visiting in your free time.",
      points: ["where it is", "how often you go there", "what you do there", "and explain why you enjoy it"],
    },
    part3: [
      "Why do some people prefer to spend their free time outdoors?",
      "How have public places in cities changed in your country over the last few years?",
      "Do you think governments should spend more money on parks and public spaces?",
    ],
  },
  {
    id: "s-study-work",
    title: "Учёба и работа",
    part1: {
      topic: "Work or studies",
      questions: [
        "Do you work or are you a student?",
        "Why did you choose this job or subject?",
        "What do you find most difficult about it?",
        "What would you like to do in the future?",
      ],
    },
    part2: {
      cue: "Describe a skill you would like to learn.",
      points: ["what the skill is", "why you want to learn it", "how you would learn it", "and explain how it could help you"],
    },
    part3: [
      "Which skills are most important for young people today?",
      "Is it better to learn new skills at school or on the job?",
      "How do you think technology will change the way people learn?",
    ],
  },
  {
    id: "s-people-travel",
    title: "Люди и путешествия",
    part1: {
      topic: "Travel",
      questions: [
        "Do you like travelling?",
        "What was the last place you visited?",
        "Do you prefer travelling alone or with other people?",
        "What is the most important thing to take on a trip?",
      ],
    },
    part2: {
      cue: "Describe a person who has had a positive influence on you.",
      points: ["who this person is", "how you know them", "what they did", "and explain why they were important to you"],
    },
    part3: [
      "What qualities make someone a good role model?",
      "Do people learn more from family or from friends?",
      "How has the way people travel changed over the past few decades?",
    ],
  },
];

export const getSpeakingSet = (id: string) => SPEAKING_SETS.find((s) => s.id === id);

/** Все вопросы сессии по порядку: Part 1 (4), Part 2 (карточка), Part 3 (3). */
export function speakingQuestions(set: SpeakingSet): { part: 1 | 2 | 3; text: string; seconds: number }[] {
  return [
    ...set.part1.questions.map((text) => ({ part: 1 as const, text, seconds: 30 })),
    {
      part: 2 as const,
      text: `${set.part2.cue} You should say: ${set.part2.points.join("; ")}.`,
      seconds: 120,
    },
    ...set.part3.map((text) => ({ part: 3 as const, text, seconds: 45 })),
  ];
}
