import type { Metadata } from "next";
import { SectionStub } from "@/components/section-stub";

export const metadata: Metadata = { title: "Разговорник" };

export default function Page() {
  return <SectionStub title="Разговорник" stage={9} />;
}
