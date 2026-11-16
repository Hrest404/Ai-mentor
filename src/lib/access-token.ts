import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan } from "./limits";

/**
 * Токен доступа к уроку. Страница урока выдаёт его после проверки тарифа, замков и лимитов,
 * а проверка ответов принимает только его. Так обойти замки прямым запросом нельзя,
 * и при этом каждый ответ не требует лишних чтений из базы.
 */
export interface LessonTokenPayload {
  /** id пользователя */
  u: string;
  /** id урока */
  l: string;
  /** тариф на момент входа в урок */
  p: Plan;
  /** срок действия, мс с начала эпохи */
  e: number;
}

export const LESSON_TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("BETTER_AUTH_SECRET не задан: токены доступа подписать нечем");
  return s;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest();

export function createLessonToken(
  input: { userId: string; lessonId: string; plan: Plan },
  now: Date = new Date(),
  key: string = secret(),
): string {
  const payload: LessonTokenPayload = { u: input.userId, l: input.lessonId, p: input.plan, e: now.getTime() + LESSON_TOKEN_TTL_MS };
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(sign(body, key))}`;
}

export type TokenCheck =
  | { ok: true; plan: Plan }
  | { ok: false; reason: "invalid" | "expired" | "mismatch" };

/** Проверяет подпись, срок, пользователя и урок. */
export function verifyLessonToken(
  token: unknown,
  expected: { userId: string; lessonId: string },
  now: Date = new Date(),
  key: string = secret(),
): TokenCheck {
  if (typeof token !== "string" || token.length > 2000) return { ok: false, reason: "invalid" };
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return { ok: false, reason: "invalid" };

  const given = Buffer.from(sig, "base64url");
  const want = sign(body, key);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return { ok: false, reason: "invalid" };

  let payload: LessonTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof payload.e !== "number" || (payload.p !== "free" && payload.p !== "pro")) return { ok: false, reason: "invalid" };
  if (payload.e <= now.getTime()) return { ok: false, reason: "expired" };
  if (payload.u !== expected.userId || payload.l !== expected.lessonId) return { ok: false, reason: "mismatch" };
  return { ok: true, plan: payload.p };
}
