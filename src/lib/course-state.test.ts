import { describe, expect, it } from "vitest";
import { courseLessons, courseTopics } from "@/lib/course-index";
import { computeCourseState, findNextLesson, isTestPassed, PASS_SCORE, xpForResult, type ProgressRow } from "./course-state";

const done = (best = 100): ProgressRow => ({ status: "completed", score: best, bestScore: best });
const progressOf = (ids: string[], best = 100) => new Map(ids.map((id) => [id, done(best)]));
const topicLessons = (topicId: string) => courseLessons.filter((l) => l.topicId === topicId).map((l) => l.id);

describe("computeCourseState", () => {
  it("новый пользователь: открыта только первая тема, доступна только её теория", () => {
    const views = computeCourseState(courseTopics, courseLessons, new Map(), "A1");
    expect(views.map((v) => v.open)).toEqual([true, false, false, false, false, false]);
    expect(views[0].lessons.map((l) => l.state)).toEqual(["available", "locked", "locked", "locked", "locked", "locked"]);
    expect(views[1].lessons.every((l) => l.state === "locked")).toBe(true);
  });

  it("уроки темы открываются по порядку", () => {
    const p = progressOf(["present-simple-theory", "present-simple-p1"]);
    const states = computeCourseState(courseTopics, courseLessons, p, "A1")[0].lessons.map((l) => l.state);
    expect(states).toEqual(["completed", "completed", "available", "locked", "locked", "locked"]);
  });

  it("итоговый тест ниже порога не открывает следующую тему и не считается пройденным", () => {
    const all = topicLessons("present-simple");
    const p = progressOf(all.slice(0, -1));
    p.set("present-simple-test", { status: "in_progress", score: PASS_SCORE - 1, bestScore: PASS_SCORE - 1 });
    const views = computeCourseState(courseTopics, courseLessons, p, "A1");
    expect(views[0].testPassed).toBe(false);
    expect(views[0].lessons.at(-1)?.state).toBe("available");
    expect(views[1].open).toBe(false);
  });

  it("тест с результатом от 80% открывает следующую тему", () => {
    const p = progressOf(topicLessons("present-simple"), PASS_SCORE);
    const views = computeCourseState(courseTopics, courseLessons, p, "A1");
    expect(views[0].testPassed).toBe(true);
    expect(views[1].open).toBe(true);
    expect(views[1].openedBy).toBe("previous-test");
    expect(views[1].lessons[0].state).toBe("available");
    expect(views[2].open).toBe(false);
  });

  it("уровень пользователя открывает темы строго ниже его уровня, свой уровень идёт по порядку", () => {
    const open = (lvl: "A1" | "A2" | "B1" | "B2" | "C1") =>
      computeCourseState(courseTopics, courseLessons, new Map(), lvl).map((v) => v.open);
    // темы: A1, A1, A2, A2, B1, B2 (IELTS)
    expect(open("A1")).toEqual([true, false, false, false, false, false]);
    expect(open("A2")).toEqual([true, true, false, false, false, false]);
    expect(open("B1")).toEqual([true, true, true, true, false, false]);
    expect(open("B2")).toEqual([true, true, true, true, true, false]);
    expect(open("C1")).toEqual([true, true, true, true, true, true]);
    expect(computeCourseState(courseTopics, courseLessons, new Map(), "B1")[2].openedBy).toBe("level");
  });

  it("без уровня (null) открыта только первая тема", () => {
    expect(computeCourseState(courseTopics, courseLessons, new Map(), null).filter((v) => v.open)).toHaveLength(1);
  });

  it("счётчик пройденных уроков", () => {
    const p = progressOf(["present-simple-theory", "present-simple-p1", "present-simple-p2"]);
    expect(computeCourseState(courseTopics, courseLessons, p, "A1")[0].completedCount).toBe(3);
  });
});

describe("findNextLesson", () => {
  it("первый доступный урок в порядке курса", () => {
    const views = computeCourseState(courseTopics, courseLessons, new Map(), "A1");
    expect(findNextLesson(views)?.lesson.id).toBe("present-simple-theory");
    const p = progressOf(["present-simple-theory", "present-simple-p1"]);
    expect(findNextLesson(computeCourseState(courseTopics, courseLessons, p, "A1"))?.lesson.id).toBe("present-simple-p2");
  });

  it("когда всё пройдено, возвращает null", () => {
    const p = progressOf(courseLessons.map((l) => l.id));
    expect(findNextLesson(computeCourseState(courseTopics, courseLessons, p, "C1"))).toBeNull();
  });
});

describe("isTestPassed и xpForResult", () => {
  it("порог теста", () => {
    expect(isTestPassed(undefined)).toBe(false);
    expect(isTestPassed({ status: "completed", score: 80, bestScore: 80 })).toBe(true);
    expect(isTestPassed({ status: "completed", score: 79, bestScore: 79 })).toBe(false);
    expect(isTestPassed({ status: "in_progress", score: 100, bestScore: 100 })).toBe(false);
  });

  it("XP растёт только при улучшении результата", () => {
    expect(xpForResult(10, 100, null)).toBe(10);
    expect(xpForResult(10, 60, null)).toBe(6);
    expect(xpForResult(10, 60, 60)).toBe(0);
    expect(xpForResult(10, 40, 60)).toBe(0);
    expect(xpForResult(10, 100, 60)).toBe(4);
    expect(xpForResult(20, 0, null)).toBe(0);
  });
});
