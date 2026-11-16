import { describe, expect, it } from "vitest";
import {
  MAX_BOX,
  REVIEW_INTERVAL_DAYS,
  RETRY_DELAY_MS,
  describeNextReview,
  isDue,
  isDueToday,
  reviewOutcome,
  sortReviewQueue,
} from "./srs";

const now = new Date("2026-11-16T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(now.getTime() + ms);

describe("reviewOutcome", () => {
  it("верный ответ двигает по коробкам с растущей паузой: 1, 3, 7, 14, 30 дней", () => {
    let box = 0;
    const days: number[] = [];
    for (let i = 0; i < MAX_BOX; i++) {
      const o = reviewOutcome({ box, correct: true, now });
      days.push(Math.round((o.dueAt.getTime() - now.getTime()) / DAY));
      expect(o.resolved).toBe(false);
      expect(o.box).toBe(box + 1);
      box = o.box;
    }
    expect(days).toEqual([...REVIEW_INTERVAL_DAYS]);
  });

  it("верный ответ в последней коробке: ошибка усвоена", () => {
    const o = reviewOutcome({ box: MAX_BOX, correct: true, now });
    expect(o.resolved).toBe(true);
    expect(o.box).toBe(MAX_BOX);
  });

  it("неверный ответ возвращает в коробку 0 и откладывает на 10 минут, где бы ошибка ни была", () => {
    for (const box of [0, 1, 3, MAX_BOX]) {
      const o = reviewOutcome({ box, correct: false, now });
      expect(o).toEqual({ box: 0, dueAt: at(RETRY_DELAY_MS), resolved: false });
    }
  });

  it("мусорная коробка приводится к допустимой", () => {
    expect(reviewOutcome({ box: -5, correct: true, now }).box).toBe(1);
    expect(reviewOutcome({ box: 99, correct: true, now }).resolved).toBe(true);
    expect(reviewOutcome({ box: 2.7, correct: true, now }).box).toBe(3);
  });
});

describe("isDue и isDueToday", () => {
  const m = (dueAt: Date, resolvedAt: Date | null = null) => ({ dueAt, box: 0, resolvedAt });

  it("срок наступил ровно сейчас или раньше: пора; позже: нет; усвоенное никогда", () => {
    expect(isDue(m(at(0)), now)).toBe(true);
    expect(isDue(m(at(-1000)), now)).toBe(true);
    expect(isDue(m(at(1000)), now)).toBe(false);
    expect(isDue(m(at(-1000), at(-500)), now)).toBe(false);
  });

  it("«сегодня» считается по локальным суткам: граница полуночи пользователя", () => {
    // 12:00 UTC = 17:00 в Ташкенте (UTC+5): локальная полночь в 19:00 UTC
    const tz = "Asia/Tashkent";
    expect(isDueToday(m(at(6 * 60 * 60 * 1000)), now, tz)).toBe(true); // 18:00 UTC = 23:00 локально
    expect(isDueToday(m(at(7 * 60 * 60 * 1000)), now, tz)).toBe(false); // 19:00 UTC = полночь
    expect(isDueToday(m(at(-DAY)), now, tz)).toBe(true); // просрочено
    expect(isDueToday(m(at(0), at(-1)), now, tz)).toBe(false); // усвоено
  });
});

describe("sortReviewQueue", () => {
  it("сначала самое просроченное, при равенстве младшие коробки; исходный массив не меняется", () => {
    const a = { id: "a", dueAt: at(-1000), box: 3, resolvedAt: null };
    const b = { id: "b", dueAt: at(-5000), box: 4, resolvedAt: null };
    const c = { id: "c", dueAt: at(-1000), box: 1, resolvedAt: null };
    const input = [a, b, c];
    expect(sortReviewQueue(input).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("describeNextReview", () => {
  it("человеческие подписи", () => {
    const tz = "UTC";
    expect(describeNextReview(at(-5), now, tz)).toBe("сейчас");
    expect(describeNextReview(at(10 * 60 * 1000), now, tz)).toBe("через 10 мин");
    expect(describeNextReview(at(2 * 60 * 60 * 1000), now, tz)).toBe("сегодня");
    expect(describeNextReview(at(DAY), now, tz)).toBe("завтра");
    expect(describeNextReview(at(3 * DAY), now, tz)).toBe("через 3 дня");
    expect(describeNextReview(at(7 * DAY), now, tz)).toBe("через 7 дней");
    expect(describeNextReview(at(21 * DAY), now, tz)).toBe("через 21 день");
    expect(describeNextReview(at(30 * DAY), now, tz)).toBe("через 30 дней");
  });
});
