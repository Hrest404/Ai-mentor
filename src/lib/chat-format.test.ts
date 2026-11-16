import { describe, expect, it } from "vitest";
import { splitReply } from "./chat-format";
import { CHAT_SCENARIOS } from "./chat-scenarios";

describe("splitReply", () => {
  it("реплика и поправка делятся по метке", () => {
    const r = splitReply("Sure! What kind of cake?\n---CORRECTION---\nВместо «I am have» скажи «I have».");
    expect(r.reply).toBe("Sure! What kind of cake?");
    expect(r.correction).toBe("Вместо «I am have» скажи «I have».");
  });

  it("метка без текста после неё: поправки нет", () => {
    expect(splitReply("Great choice!\n---CORRECTION---\n")).toEqual({ reply: "Great choice!", correction: null });
    expect(splitReply("Great choice!\n---CORRECTION---")).toEqual({ reply: "Great choice!", correction: null });
  });

  it("нет метки: вся реплика", () => {
    expect(splitReply("Hello there!")).toEqual({ reply: "Hello there!", correction: null });
    expect(splitReply("")).toEqual({ reply: "", correction: null });
  });

  it("во время потока недописанная метка не просачивается в реплику", () => {
    for (const partial of ["---", "---C", "---CORR", "---CORRECTION--"]) {
      expect(splitReply(`Sure!\n${partial}`).reply).toBe("Sure!");
    }
    // дефис внутри слова не обрезается; одиночный дефис на конце показывается, когда ответ закончен
    expect(splitReply("A well-known cafe").reply).toBe("A well-known cafe");
    expect(splitReply("A well-known cafe -", true).reply).toBe("A well-known cafe -");
  });

  it("регистр и пробелы внутри метки не важны", () => {
    expect(splitReply("Hi\n--- correction ---\nисправь").correction).toBe("исправь");
  });
});

describe("сценарии чата", () => {
  it("id уникальны, у каждого есть роль, место и первая реплика на английском", () => {
    expect(new Set(CHAT_SCENARIOS.map((s) => s.id)).size).toBe(CHAT_SCENARIOS.length);
    for (const s of CHAT_SCENARIOS) {
      expect(s.persona.length).toBeGreaterThan(5);
      expect(s.setting.length).toBeGreaterThan(5);
      expect(s.opening).toMatch(/[A-Za-z]/);
      expect(s.opening).not.toMatch(/[А-Яа-я]/);
    }
  });
});
