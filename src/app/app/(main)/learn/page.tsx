import type { Metadata } from "next";
import { SectionStub } from "@/components/section-stub";

export const metadata: Metadata = { title: "Обучение" };

export default function Page() {
  return <SectionStub title="Обучение" stage={5} />;
}
