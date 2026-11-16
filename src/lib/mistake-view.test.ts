import { describe, expect, it } from "vitest";
import { weakReviewQueue, weakestTags } from "./mistake-view";

const m = (tag: string, timesWrong: number, box = 0, resolved = false) => ({
  tag,
  timesWrong,
  box,
  resolvedAt: resolved ? new Date() : null,
});

describe("weakReviewQueue", () => {
  const rows = [m("a", 1), m("a", 3), m("a", 2), m("b", 1), m("b", 1), m("c", 5), m("d", 1, 0, true)];

  it("берёт ошибки только из двух самых слабых категорий", () => {
    expect(weakestTags(rows, 2).map((t) => t.tag)).toEqual(["a", "b"]);
    expect(weakReviewQueue(rows).every((r) => r.tag === "a" || r.tag === "b")).toBe(true);
    expect(weakReviewQueue(rows)).toHaveLength(5);
  });

  it("сортирует по числу промахов, затем по коробке", () => {
    const q = weakReviewQueue([m("a", 2, 3), m("a", 2, 1), m("a", 4, 5), m("b", 1)]);
    expect(q.map((r) => [r.timesWrong, r.box])).toEqual([[4, 5], [2, 1], [2, 3], [1, 0]]);
  });

  it("усвоенные не попадают, лимит соблюдается, пустой список даёт пустую очередь", () => {
    expect(weakReviewQueue([m("a", 5, 0, true)])).toEqual([]);
    expect(weakReviewQueue(rows, 2)).toHaveLength(2);
    expect(weakReviewQueue([])).toEqual([]);
  });
});
