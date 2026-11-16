import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { LimitScreen } from "@/components/gate/screens";
import { ReviewPlayer } from "@/components/mistakes/review-player";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { mistakes } from "@/db/schema";
import { getExercise } from "@/lib/course-index";
import { toClientExercise } from "@/lib/exercise-view";
import { isPracticeExhausted } from "@/lib/limits";
import { getAccount, requireUser } from "@/lib/session";
import { isDue, sortReviewQueue } from "@/lib/srs";
import { getUsage } from "@/lib/usage";

export const metadata: Metadata = { title: "Повторение ошибок" };

const SESSION_SIZE = 10;

export default async function ReviewPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);

  const usage = await getUsage(user.id);
  if (isPracticeExhausted(plan, usage.practiceSeconds) && usage.resetsAt) {
    return <LimitScreen resetsAtMs={usage.resetsAt.getTime()} fullscreen={false} />;
  }

  const rows = await db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.userId, user.id), isNull(mistakes.resolvedAt)));
  const now = new Date();
  const due = sortReviewQueue(rows.filter((r) => isDue(r, now))).slice(0, SESSION_SIZE);

  // В браузер уходят задания без правильных ответов.
  const items = due.flatMap((m) => {
    const ex = getExercise(m.exerciseId);
    return ex ? [toClientExercise(m.exerciseId, ex.def)] : [];
  });

  if (items.length === 0) {
    return (
      <Card className="flex flex-col gap-4 p-8">
        <h1 className="text-3xl">Повторять пока нечего</h1>
        <p className="text-muted">Когда придёт срок повторения ошибок, они появятся здесь.</p>
        <ButtonLink href="/app/mistakes" className="w-fit">
          К ошибкам
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ReviewPlayer items={items} />
    </div>
  );
}
