import type { Metadata } from "next";
import { SITUATIONS } from "@/content/phrasebook";
import { ProGate } from "@/components/gate/screens";
import { PronunciationTrainer } from "@/components/pro/pronunciation-trainer";
import { getProTool } from "@/lib/pro-tools";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Проверка произношения" };

export default async function PronunciationPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);
  const tool = getProTool("pronunciation")!;

  // Доступ проверяется на сервере: закрытый инструмент Free не получит, даже зная адрес.
  if (plan !== "pro") return <ProGate title={tool.title} text={tool.text} />;

  const situations = SITUATIONS.map((s) => ({ id: s.id, title: s.title, phrases: s.phrases.map(([en]) => en) }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">{tool.title}</h1>
        <p className="text-muted">{tool.text}</p>
      </div>
      <PronunciationTrainer situations={situations} />
    </div>
  );
}
