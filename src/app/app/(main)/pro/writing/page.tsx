import type { Metadata } from "next";
import { ProGate } from "@/components/gate/screens";
import { WritingChecker } from "@/components/pro/writing-checker";
import { Card } from "@/components/ui/card";
import { isAiConfigured } from "@/lib/ai/client";
import { getProTool } from "@/lib/pro-tools";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Проверка текста" };

export default async function WritingPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);
  const tool = getProTool("writing")!;

  // Доступ проверяется на сервере: закрытый инструмент Free не получит, даже зная адрес.
  if (plan !== "pro") return <ProGate title={tool.title} text={tool.text} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">{tool.title}</h1>
        <p className="text-muted">{tool.text}</p>
      </div>
      {isAiConfigured() ? (
        <WritingChecker />
      ) : (
        <Card className="flex max-w-xl flex-col gap-3 p-8">
          <h2 className="text-xl">Проверка пока недоступна</h2>
          <p className="text-muted">AI-ментор ещё не подключён к сервису. Загляните позже: уроки и повторение работают как обычно.</p>
        </Card>
      )}
    </div>
  );
}
