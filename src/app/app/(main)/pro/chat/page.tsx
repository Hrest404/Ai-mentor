import type { Metadata } from "next";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ChatClient, type InitialChat } from "@/components/chat/chat-client";
import { ProGate } from "@/components/gate/screens";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";
import { isAiConfigured } from "@/lib/ai/client";
import { getProTool } from "@/lib/pro-tools";
import { getScenario } from "@/lib/chat-scenarios";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Чат-ментор" };

export default async function ChatPage() {
  const user = await requireUser();
  const { plan } = await getAccount(user.id);
  const tool = getProTool("chat")!;

  // Доступ проверяется на сервере: закрытый инструмент Free не получит, даже зная адрес.
  if (plan !== "pro") return <ProGate title={tool.title} text={tool.text} />;

  if (!isAiConfigured()) {
    return (
      <Card className="flex max-w-xl flex-col gap-3 p-8">
        <h1 className="text-3xl">Чат-ментор пока недоступен</h1>
        <p className="text-muted">AI-ментор ещё не подключён к сервису. Загляните позже: уроки и повторение работают как обычно.</p>
      </Card>
    );
  }

  // Продолжаем последний диалог, если он есть.
  const [latest] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.userId, user.id))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(1);

  let initial: InitialChat | null = null;
  if (latest && getScenario(latest.scenario)) {
    const rows = await db
      .select({ role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, user.id), eq(chatMessages.conversationId, latest.id)))
      .orderBy(asc(chatMessages.createdAt), sql`rowid`);
    initial = { conversationId: latest.id, scenario: latest.scenario, messages: rows.slice(-100) };
  }

  return <ChatClient initial={initial} />;
}
