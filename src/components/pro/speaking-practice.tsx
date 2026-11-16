"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { assessSpeaking, type SpeakingAssessmentResponse } from "@/app/app/(main)/pro/ielts/actions";
import { SpeakButton } from "@/components/lesson/speak-button";
import { BandResult } from "@/components/pro/band-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SPEAKING_CRITERIA } from "@/lib/ielts";
import { speak, stopSpeaking } from "@/lib/tts";
import { useSpeechRecognition } from "@/lib/use-speech";

export interface SpeakingSetView {
  id: string;
  title: string;
  questions: { part: 1 | 2 | 3; text: string; seconds: number }[];
}

interface Answer {
  answer: string;
  seconds: number;
}

const PART_TITLE = { 1: "Part 1: знакомство", 2: "Part 2: монолог", 3: "Part 3: обсуждение" } as const;

export function SpeakingPractice({ sets }: { sets: SpeakingSetView[] }) {
  const [set, setSet] = useState<SpeakingSetView | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<SpeakingAssessmentResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const speech = useSpeechRecognition();
  const startedAt = useRef<number | null>(null);
  const spentSeconds = useRef(0);

  const question = set?.questions[index];

  // Текст распознавания попадает в поле ответа, где его можно поправить.
  useEffect(() => {
    if (speech.transcript) setDraft(speech.transcript);
  }, [speech.transcript]);

  // Вопрос озвучивается при появлении; переход к следующему обрывает предыдущую озвучку.
  useEffect(() => {
    if (!question) return;
    speak(question.text, 0.95);
    return () => stopSpeaking();
  }, [question]);

  function begin(s: SpeakingSetView) {
    setSet(s);
    setIndex(0);
    setAnswers([]);
    setDraft("");
    setResult(null);
    spentSeconds.current = 0;
  }

  function leave() {
    speech.stop();
    stopSpeaking();
    setSet(null);
    setResult(null);
  }

  function record() {
    stopSpeaking();
    startedAt.current = Date.now();
    speech.start();
  }

  function stopRecord() {
    speech.stop();
    if (startedAt.current) spentSeconds.current += Math.round((Date.now() - startedAt.current) / 1000);
    startedAt.current = null;
  }

  function next() {
    if (!set) return;
    if (speech.listening) stopRecord();
    const all = [...answers, { answer: draft.trim(), seconds: spentSeconds.current }];
    setAnswers(all);
    setDraft("");
    spentSeconds.current = 0;
    if (index + 1 < set.questions.length) {
      setIndex(index + 1);
      return;
    }
    startTransition(async () => {
      try {
        setResult(await assessSpeaking({ setId: set.id, answers: all.map((a) => ({ answer: a.answer, seconds: a.seconds || undefined })) }));
      } catch {
        setResult({ ok: false, code: "error", error: "Не получилось получить оценку. Проверьте соединение и попробуйте ещё раз." });
      }
    });
  }

  if (!set) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl">Как проходит сессия</h2>
          <p className="text-muted">
            Восемь вопросов: четыре в Part 1, карточка в Part 2 и три вопроса в Part 3. Вопрос звучит голосом, вы отвечаете вслух, речь
            превращается в текст, и по нему вы получаете оценку по четырём критериям. Распознавание речи работает в Chrome, Edge и Safari. В
            других браузерах ответы можно печатать.
          </p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {sets.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => begin(s)}
              className="lift rounded-lg border border-line bg-surface p-5 text-left shadow-card hover:bg-surface-alt"
            >
              <span className="block text-lg font-medium">{s.title}</span>
              <span className="mt-1 block text-muted">{s.questions.length} вопросов</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col gap-6">
        <Button variant="secondary" className="w-fit" onClick={leave}>
          Другая сессия
        </Button>
        <BandResult
          band={result.band}
          criteria={result.criteria}
          comments={result.assessment.comments}
          labels={SPEAKING_CRITERIA}
          strengths={result.assessment.strengths}
          improvements={result.assessment.improvements}
          note="Произношение оценивается по тексту распознавания и поэтому приблизительно. Результат сохранён в истории."
        />
      </div>
    );
  }

  if (pending || result) {
    return (
      <div className="flex flex-col gap-4">
        {pending && (
          <p role="status" className="text-muted">
            Экзаменатор слушает ваши ответы. Это занимает до минуты, не закрывайте страницу.
          </p>
        )}
        {result && !result.ok && (
          <Card role="alert" className="flex flex-col gap-4 border-danger">
            <p className="font-medium">{result.error}</p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  const all = answers;
                  setResult(null);
                  startTransition(async () => {
                    try {
                      setResult(await assessSpeaking({ setId: set.id, answers: all.map((a) => ({ answer: a.answer, seconds: a.seconds || undefined })) }));
                    } catch {
                      setResult({ ok: false, code: "error", error: "Не получилось получить оценку. Проверьте соединение и попробуйте ещё раз." });
                    }
                  });
                }}
              >
                Повторить
              </Button>
              <Button variant="secondary" onClick={leave}>
                Выйти
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  const isLast = index + 1 === set.questions.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="action">{PART_TITLE[question!.part]}</Badge>
        <p className="text-muted">
          Вопрос {index + 1} из {set.questions.length}
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <p lang="en" className="text-2xl font-medium">
          {question!.text}
        </p>
        <div className="flex flex-wrap gap-3">
          <SpeakButton text={question!.text} label="Повторить вопрос" />
        </div>
        <p className="text-sm text-muted">
          {question!.part === 2 ? "Говорите 1–2 минуты." : question!.part === 1 ? "Отвечайте в два-три предложения." : "Развёрнутый ответ с примером."}
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        {speech.supported ? (
          <div className="flex flex-wrap items-center gap-3">
            {speech.listening ? (
              <Button variant="danger" size="lg" onClick={stopRecord}>
                Остановить запись
              </Button>
            ) : (
              <Button size="lg" onClick={record}>
                {draft ? "Записать заново" : "Начать запись"}
              </Button>
            )}
            {speech.listening && <span role="status" className="text-muted">Слушаю… {speech.interim}</span>}
          </div>
        ) : (
          <p className="text-muted">Распознавание речи в этом браузере недоступно: напишите ответ, как бы вы сказали его вслух.</p>
        )}
        {speech.error && (
          <p role="alert" className="text-danger">
            {speech.error}
          </p>
        )}
        <label htmlFor="speaking-answer" className="text-base font-medium">
          Ваш ответ {speech.supported && <span className="font-normal text-muted">(можно поправить распознанное)</span>}
        </label>
        <textarea
          id="speaking-answer"
          lang="en"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          rows={5}
          className="min-h-32 resize-y rounded-md border border-line bg-surface px-4 py-3 text-lg text-ink hover:border-muted"
        />
        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="ghost" onClick={leave}>
            Выйти
          </Button>
          <Button onClick={next}>{isLast ? "Закончить и получить оценку" : draft.trim() ? "Дальше" : "Пропустить"}</Button>
        </div>
      </Card>
    </div>
  );
}
