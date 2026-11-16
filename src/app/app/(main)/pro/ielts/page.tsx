import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { ProGate } from "@/components/gate/screens";
import { IeltsHistory, type HistoryItem } from "@/components/pro/ielts-history";
import { Tabs } from "@/components/pro/ielts-tabs";
import { SpeakingPractice } from "@/components/pro/speaking-practice";
import { StudyPlanView } from "@/components/pro/study-plan";
import { WritingPractice } from "@/components/pro/writing-practice";
import { Card } from "@/components/ui/card";
import { SPEAKING_SETS, WRITING_TASKS, getSpeakingSet, getWritingTask, speakingQuestions } from "@/content/ielts-tasks";
import { db } from "@/db";
import { ieltsSubmissions } from "@/db/schema";
import { isAiConfigured } from "@/lib/ai/client";
import { SPEAKING_CRITERIA, WRITING_CRITERIA, buildStudyPlan, currentBandEstimate, weakestCriterion } from "@/lib/ielts";
import { getProTool } from "@/lib/pro-tools";
import { getAccount, requireUser } from "@/lib/session";
import { localDate } from "@/lib/streak";

export const metadata: Metadata = { title: "IELTS Writing и Speaking" };
// Оценка сильной моделью при высокой нагрузке занимает около минуты: серверное действие должно успеть.
export const maxDuration = 120;

const ALL_LABELS: Record<string, string> = Object.fromEntries(
  [...WRITING_CRITERIA, ...SPEAKING_CRITERIA].map((c) => [c.key, c.label]),
);

export default async function IeltsPage() {
  const user = await requireUser();
  const { plan, profile } = await getAccount(user.id);
  const tool = getProTool("ielts")!;

  // Доступ проверяется на сервере: закрытый инструмент Free не получит, даже зная адрес.
  if (plan !== "pro") return <ProGate title={tool.title} text={tool.text} />;

  const rows = await db
    .select()
    .from(ieltsSubmissions)
    .where(eq(ieltsSubmissions.userId, user.id))
    .orderBy(desc(ieltsSubmissions.createdAt))
    .limit(40);

  const history: HistoryItem[] = rows.map((r) => {
    const speaking = r.task === "speaking";
    const labels = speaking ? SPEAKING_CRITERIA : WRITING_CRITERIA;
    const criteria = (r.criteria ?? {}) as Record<string, number>;
    const feedback = (r.feedback ?? {}) as { improvements?: string[] };
    return {
      id: r.id,
      kind: speaking ? "Speaking" : r.task === "writing1" ? "Writing Task 1" : "Writing Task 2",
      title: (speaking ? getSpeakingSet(r.prompt)?.title : getWritingTask(r.prompt)?.title) ?? "Задание",
      band: r.bandOverall ?? 0,
      createdAtMs: r.createdAt.getTime(),
      wordCount: r.wordCount,
      criteria: labels.map((l) => ({ label: l.short, value: criteria[l.key] ?? 0 })),
      improvements: feedback.improvements ?? [],
      response: r.response,
    };
  });

  const today = localDate(new Date(), profile.timezone);
  const bands = rows.map((r) => r.bandOverall).filter((b): b is number => typeof b === "number");
  const currentBand = currentBandEstimate(bands, profile.level);
  const studyPlan =
    profile.examDate && profile.targetBand
      ? buildStudyPlan({ today, examDate: profile.examDate, targetBand: profile.targetBand, currentBand })
      : null;
  const weakest = weakestCriterion(
    rows.map((r) => ({ criteria: (r.criteria ?? null) as Record<string, number> | null })),
    ALL_LABELS,
  );

  const aiReady = isAiConfigured();
  const unavailable = (
    <Card className="flex max-w-xl flex-col gap-3 p-8">
      <h2 className="text-xl">Оценка пока недоступна</h2>
      <p className="text-muted">AI-ментор ещё не подключён к сервису. Загляните позже: история и план подготовки доступны.</p>
    </Card>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">{tool.title}</h1>
        <p className="text-muted">{tool.text}</p>
      </div>
      <Tabs
        tabs={[
          { id: "writing", label: "Writing", content: aiReady ? <WritingPractice tasks={WRITING_TASKS} /> : unavailable },
          {
            id: "speaking",
            label: "Speaking",
            content: aiReady ? (
              <SpeakingPractice sets={SPEAKING_SETS.map((s) => ({ id: s.id, title: s.title, questions: speakingQuestions(s) }))} />
            ) : (
              unavailable
            ),
          },
          { id: "history", label: `История${history.length ? ` (${history.length})` : ""}`, content: <IeltsHistory items={history} /> },
          {
            id: "plan",
            label: "План",
            content: (
              <StudyPlanView
                examDate={profile.examDate}
                targetBand={profile.targetBand}
                today={today}
                plan={studyPlan}
                currentBand={currentBand}
                basedOnChecks={bands.length > 0}
                weakest={weakest}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
