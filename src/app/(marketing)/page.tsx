import type { Metadata } from "next";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { CourseMapMock, EssayMock, MistakeMock, PhrasebookMock } from "@/components/marketing/mocks";
import { SiteFooter } from "@/components/site/footer";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { presentContinuous } from "@/content/topics/present-continuous";
import { presentSimple } from "@/content/topics/present-simple";
import { SITUATIONS } from "@/content/phrasebook";
import { TOPICS } from "@/content/course";
import type { ExerciseDef } from "@/content/types";
import { FREE_FEATURES, FREE_LIMITS, PRO_FEATURES } from "@/lib/plans";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: { absolute: "Репетитор: AI-ментор по английскому для IELTS" },
  description:
    "Уроки с теорией и тестами, разбор ошибок, проверка эссе IELTS и разговорник. Бесплатно: 20 минут практики в день.",
};

// Реальный контент курса для фрагментов интерфейса.
function choiceOf(e: ExerciseDef) {
  if (e.kind !== "choice") throw new Error("Фрагменты лендинга рассчитаны на упражнения типа choice");
  return e;
}
const heroExercise = choiceOf(presentSimple.lessons[0].exercises[0]);
const mistakeExercise = choiceOf(presentContinuous.lessons[2].exercises[0]);

const courseRows = [
  { title: "Настоящее простое время", kind: "Теория" },
  ...presentSimple.lessons.map((l) => ({ title: l.title, kind: l.type === "test" ? "Тест" : "Урок" })),
];

const faq = [
  {
    q: "Что даёт бесплатный тариф?",
    a: `Каждый день ${FREE_LIMITS.practiceMinutesPerDay} минут практики, лимит обновляется каждые 24 часа. Открыты первые ${FREE_LIMITS.lessons} уроков, тест уровня, все типы упражнений и ${FREE_LIMITS.aiExplanationsPerDay} AI-разборов ошибок в день.`,
  },
  {
    q: "Что открывает PRO?",
    a: "Практику без лимита и весь курс, проверку произношения, грамматики и правописания, IELTS Writing и Speaking, чат-ментора и план подготовки под дату экзамена.",
  },
  {
    q: "Как определяется мой уровень?",
    a: "После регистрации вы проходите тест из 12 вопросов, от A1 до C1. Если начинаете с нуля, тест можно пропустить.",
  },
  {
    q: "Как проверяется произношение?",
    a: "Браузер распознаёт вашу речь, а Репетитор сравнивает её с эталоном по словам и отмечает проблемные. Лучше всего работает в Chrome и Edge.",
  },
];

function Head({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-x-6", className)}>
      <h2 className="t-h2 lg:col-span-5">{title}</h2>
      {children && <div className="t-lead measure text-muted lg:col-span-6 lg:col-start-7">{children}</div>}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <main id="top">
        {/* 1. Hero: что это, для кого, одно действие; рядом живой фрагмент урока */}
        <section className="hero flex flex-col" style={{ ["--h" as string]: 1 }}>
          <div className="wrap grid grid-cols-1 content-start gap-12 lg:grid-cols-12 lg:gap-x-6">
            <div data-enter className="flex flex-col items-start gap-6 lg:col-span-5">
              <h1 className="t-h1">AI-ментор по английскому и IELTS</h1>
              <p className="t-lead measure text-muted">
                В каждой теме сначала правило, потом уроки и тест. Ошибки разбираем сразу, эссе IELTS проверяем по
                четырём критериям.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <ButtonLink href="/register" size="lg">
                  Начать бесплатно
                </ButtonLink>
                <ButtonLink href="/pricing" variant="secondary" size="lg">
                  Смотреть тарифы
                </ButtonLink>
              </div>
              <p className="text-muted">
                Бесплатно: {FREE_LIMITS.practiceMinutesPerDay} минут практики в день и первые {FREE_LIMITS.lessons} уроков.
              </p>
            </div>
            <div data-enter className="hidden min-w-0 sm:block lg:col-span-6 lg:col-start-7">
              <HeroDemo
                lessonTitle={presentSimple.lessons[0].title}
                prompt={heroExercise.prompt}
                options={heroExercise.options}
                answer={heroExercise.answer}
                explanation={heroExercise.explanation}
              />
            </div>
          </div>
          <div className="wrap hero-strip mt-auto pt-12">
            <dl className="grid grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                ["36 уроков", "в 6 темах, от Present Simple до IELTS Writing"],
                ["156 упражнений", "семи типов, с разбором каждого ответа"],
                ["120 фраз", "в разговорнике, 8 ситуаций с озвучкой"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <dt className="text-xl font-medium tracking-tight">{k}</dt>
                  <dd className="text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2. Как проходит тема: split, карта темы справа */}
        <section id="how">
          <div className="wrap grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-6">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <h2 className="t-h2">Теория, уроки и тест в каждой теме</h2>
              <p className="t-lead measure text-muted">
                Правило с примерами, четыре урока и итоговый тест. Следующая тема открывается при результате от 80%.
              </p>
              <p className="t-lead measure text-muted">Тест уровня на входе подскажет, с чего начать.</p>
            </div>
            <div className="min-w-0 lg:col-span-6 lg:col-start-7">
              <CourseMapMock rows={courseRows} />
            </div>
          </div>
        </section>

        {/* 3. Разбор ошибок: голова + две карточки в ряд */}
        <section id="mistakes">
          <div className="wrap flex flex-col gap-12">
            <Head title="Разбор каждой ошибки">
              Репетитор объясняет, почему ответ неверен, показывает правило и даёт три похожих задания. Ошибка
              возвращается в повторение, пока вы не ответите верно.
            </Head>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <MistakeMock
                  prompt={mistakeExercise.prompt}
                  yourAnswer="am drinking"
                  rightAnswer={mistakeExercise.answer}
                  explanation={mistakeExercise.explanation}
                />
              </div>
              <Card className="flex flex-col gap-4 lg:col-span-5">
                <h3 className="t-h3">Мои ошибки по темам</h3>
                <ul className="flex flex-col">
                  {[
                    ["Present Simple и Continuous", "Глаголы состояния"],
                    ["Past Simple", "Неправильные глаголы"],
                    ["Артикли", "A или an"],
                  ].map(([topic, tag]) => (
                    <li key={topic} className="flex min-h-14 items-center justify-between gap-4 border-b border-line last:border-0">
                      <span>
                        <span className="block font-medium">{topic}</span>
                        <span className="block text-muted">{tag}</span>
                      </span>
                      <Badge tone="xp">Повторить</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* 4. IELTS: окно эссе на всю ширину, на другой подложке */}
        <section id="ielts" className="bg-surface-alt">
          <div className="wrap flex flex-col gap-12">
            <Head title="Подготовка к IELTS">
              Writing Task 1 и 2 с оценкой по четырём критериям. В Speaking вопросы Part 1–3 звучат голосом, ответ
              разбирается по критериям.
            </Head>
            <EssayMock
              task="Governments should spend money on public transport rather than roads. To what extent do you agree?"
              criteria={["Task Response", "Coherence and Cohesion", "Lexical Resource", "Grammatical Range and Accuracy"]}
            />
          </div>
        </section>

        {/* 5. Что внутри: таблица фактов + разговорник */}
        <section id="inside">
          <div className="wrap grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-6">
            <div className="flex flex-col gap-10 lg:col-span-6">
              <h2 className="t-h2">Что внутри курса</h2>
              <dl>
                {[
                  ["Темы", `${TOPICS.length}, от Present Simple до IELTS Writing`],
                  ["Уроки", "36: теория, практика и тест в каждой теме"],
                  ["Упражнения", "156 семи типов, от выбора ответа до диктанта"],
                  ["Разговорник", `${SITUATIONS.length} ситуаций, 120 фраз с озвучкой`],
                  ["Тест уровня", "12 вопросов, результат от A1 до C1"],
                ].map(([k, v]) => (
                  <div key={k} className="grid min-h-16 grid-cols-[7rem_1fr] items-baseline gap-4 border-b border-line py-4 first:border-t">
                    <dt className="font-medium">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <PhrasebookMock
                title={SITUATIONS[1].title}
                items={SITUATIONS[1].phrases.slice(0, 5).map(([en, ru]) => ({ en, ru }))}
              />
            </div>
          </div>
        </section>

        {/* 6. Тарифы: две карточки */}
        <section id="pricing" className="bg-surface-alt">
          <div className="wrap flex flex-col gap-12">
            <Head title="Тарифы">
              Free остаётся бесплатным: лимит практики обновляется каждые 24 часа. PRO снимает лимиты.
            </Head>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="flex flex-col gap-6 p-8">
                <div className="flex flex-col gap-1">
                  <h3 className="t-h3">Free</h3>
                  <p className="text-muted">Бесплатно, без срока</p>
                </div>
                <ul className="flex flex-1 flex-col gap-3">
                  {FREE_FEATURES.slice(0, 5).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/register">Начать бесплатно</ButtonLink>
              </Card>
              <Card className="flex flex-col gap-6 p-8">
                <div className="flex flex-col gap-1">
                  <h3 className="t-h3 flex items-center gap-3">
                    PRO <Badge tone="action">Все инструменты</Badge>
                  </h3>
                  <p className="text-muted">Без дневного лимита</p>
                </div>
                <ul className="flex flex-1 flex-col gap-3">
                  {PRO_FEATURES.slice(0, 5).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <ButtonLink href="/pricing" variant="secondary">
                  Смотреть тариф PRO
                </ButtonLink>
              </Card>
            </div>
          </div>
        </section>

        {/* 7. Вопросы: ответы открыты целиком */}
        <section id="faq">
          <div className="wrap grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-x-6">
            <h2 className="t-h2 lg:col-span-5">Вопросы и ответы</h2>
            <div className="min-w-0 lg:col-span-6 lg:col-start-7">
              {faq.map((item) => (
                <div key={item.q} className="flex flex-col gap-2 border-b border-line py-4 first:pt-0">
                  <h3 className="text-xl font-medium tracking-tight">{item.q}</h3>
                  <p className="text-muted">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter title="Тест уровня и первый урок бесплатно" text="Регистрация по почте, карта не нужна." />
    </>
  );
}
