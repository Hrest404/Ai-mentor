import type { Metadata } from "next";
import { SectionStub } from "@/components/section-stub";

export const metadata: Metadata = { title: "Профиль" };

export default function Page() {
  return <SectionStub title="Профиль" stage={11} />;
}
