import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { PLACEMENT } from "@/content/placement";
import { getAccount, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Знакомство" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const { profile } = await getAccount(user.id);
  if (profile.onboardedAt) redirect("/app");

  // Верные ответы в браузер не отправляем: проверка идёт на сервере.
  const questions = PLACEMENT.map(({ id, prompt, options }) => ({ id, prompt, options }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-12">
      <OnboardingFlow name={user.name} questions={questions} />
    </main>
  );
}
