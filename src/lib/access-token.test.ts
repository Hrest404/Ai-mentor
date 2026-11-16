import { describe, expect, it } from "vitest";
import { LESSON_TOKEN_TTL_MS, createLessonToken, verifyLessonToken } from "./access-token";

const KEY = "test-secret-key-0123456789abcdef";
const now = new Date("2026-11-16T12:00:00Z");
const who = { userId: "user-1", lessonId: "present-simple-p1" };

describe("токен доступа к уроку", () => {
  it("круг: выданный токен проходит проверку и несёт тариф", () => {
    const token = createLessonToken({ ...who, plan: "free" }, now, KEY);
    expect(verifyLessonToken(token, who, now, KEY)).toEqual({ ok: true, plan: "free" });
    const pro = createLessonToken({ ...who, plan: "pro" }, now, KEY);
    expect(verifyLessonToken(pro, who, now, KEY)).toEqual({ ok: true, plan: "pro" });
  });

  it("чужой пользователь или другой урок не проходят", () => {
    const token = createLessonToken({ ...who, plan: "free" }, now, KEY);
    expect(verifyLessonToken(token, { ...who, userId: "user-2" }, now, KEY)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyLessonToken(token, { ...who, lessonId: "past-simple-p1" }, now, KEY)).toEqual({ ok: false, reason: "mismatch" });
  });

  it("истёкший токен отклоняется ровно по сроку", () => {
    const token = createLessonToken({ ...who, plan: "free" }, now, KEY);
    const justBefore = new Date(now.getTime() + LESSON_TOKEN_TTL_MS - 1);
    const atExpiry = new Date(now.getTime() + LESSON_TOKEN_TTL_MS);
    expect(verifyLessonToken(token, who, justBefore, KEY).ok).toBe(true);
    expect(verifyLessonToken(token, who, atExpiry, KEY)).toEqual({ ok: false, reason: "expired" });
  });

  it("подделка отклоняется: смена тарифа в теле, чужой ключ, мусор", () => {
    const token = createLessonToken({ ...who, plan: "free" }, now, KEY);
    const [body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body, "base64url").toString());
    forged.p = "pro";
    const forgedToken = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect(verifyLessonToken(forgedToken, who, now, KEY)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyLessonToken(token, who, now, "another-secret-key-0123456789")).toEqual({ ok: false, reason: "invalid" });
    for (const junk of ["", "abc", "a.b.c", null, undefined, 42, {}, "x".repeat(3000)]) {
      expect(verifyLessonToken(junk, who, now, KEY)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});
