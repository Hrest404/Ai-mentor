import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProGate } from "@/components/gate/screens";
import { SectionStub } from "@/components/section-stub";
import { getProTool } from "@/lib/pro-tools";
import { getAccount, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const tool = getProTool((await params).tool);
  return { title: tool?.title ?? "PRO" };
}

export default async function ProToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const tool = getProTool((await params).tool);
  if (!tool) notFound();

  const user = await requireUser();
  const { plan } = await getAccount(user.id);
  // Доступ проверяется на сервере: закрытый инструмент Free не получит, даже зная адрес.
  if (plan !== "pro") return <ProGate title={tool.title} text={tool.text} />;

  return <SectionStub title={tool.title} stage={tool.stage} />;
}
