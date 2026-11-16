import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PhrasebookClient } from "@/components/phrasebook/phrasebook-client";
import { db } from "@/db";
import { phraseFavorites } from "@/db/schema";
import { buildSituations } from "@/lib/phrasebook";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Разговорник" };

export default async function PhrasebookPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);
  const rows = await db.select({ id: phraseFavorites.phraseId }).from(phraseFavorites).where(eq(phraseFavorites.userId, user.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Разговорник</h1>
        <p className="text-muted">Готовые фразы по ситуациям: слушайте, ищите, сохраняйте и заучивайте карточками.</p>
      </div>
      <PhrasebookClient situations={buildSituations(plan)} initialFavorites={rows.map((r) => r.id)} isPro={plan === "pro"} />
    </div>
  );
}
