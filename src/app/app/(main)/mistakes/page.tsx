import type { Metadata } from "next";
import { SectionStub } from "@/components/section-stub";

export const metadata: Metadata = { title: "Мои ошибки" };

export default function Page() {
  return <SectionStub title="Мои ошибки" stage={7} />;
}
