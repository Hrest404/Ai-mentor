import "server-only";
import { aiErrorMessage, AiError, type AiErrorCode } from "./ai/errors";
import { getAccount, getSession } from "./session";

export type ProCheck =
  | { ok: true; userId: string; profile: Awaited<ReturnType<typeof getAccount>>["profile"] }
  | { ok: false; code: "auth" | "pro"; error: string };

/**
 * Проверка доступа для серверных действий PRO-инструментов: вошедший пользователь с активным PRO.
 * Действия вызываются напрямую, минуя страницу, поэтому проверка делается в каждом из них.
 */
export async function checkPro(): Promise<ProCheck> {
  const session = await getSession();
  if (!session) return { ok: false, code: "auth", error: "Войдите в аккаунт" };
  const { plan, profile } = await getAccount(session.user.id);
  if (plan !== "pro") return { ok: false, code: "pro", error: "Этот инструмент доступен в PRO" };
  return { ok: true, userId: session.user.id, profile };
}

/** Код и сообщение для пользователя по сбою AI-слоя; в журнал пишется причина. */
export function aiFailure(label: string, err: unknown): { code: "unavailable" | "busy"; error: string } {
  const code: AiErrorCode = err instanceof AiError ? err.code : "busy";
  console.error(`[ai] ${label}:`, err instanceof AiError ? `${err.code}: ${String(err.cause ?? err.message).slice(0, 300)}` : err);
  return code === "unavailable" || code === "auth"
    ? { code: "unavailable", error: aiErrorMessage(code) }
    : { code: "busy", error: aiErrorMessage(code) };
}
