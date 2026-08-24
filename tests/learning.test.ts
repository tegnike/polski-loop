import { describe, expect, it } from "vitest";
import { calculateNextReview, clozeShape, gradeAnswer, nextDifficulty, normalizeAnswer, removePolishDiacritics, suggestedReviewRating } from "../src/lib/learning";

describe("answer grading", () => {
  it("normalizes surrounding whitespace and final punctuation", () => {
    expect(normalizeAnswer("  Dzień dobry!!! ")).toBe("dzień dobry");
    expect(gradeAnswer("  Dzień dobry! ", ["Dzień dobry."])).toEqual({ verdict: "correct", isCorrect: true });
  });

  it("keeps missing Polish diacritics as a separate verdict", () => {
    expect(removePolishDiacritics("Dziękuję")).toBe("dziekuje");
    expect(gradeAnswer("Dziekuje", ["Dziękuję"])).toEqual({ verdict: "diacritic_missing", isCorrect: false });
  });

  it("does not accept a different phrase", () => {
    expect(gradeAnswer("Przepraszam", ["Dziękuję"])).toEqual({ verdict: "incorrect", isCorrect: false });
  });
});

describe("review schedule", () => {
  it("selects a usable default rating after checking an answer", () => {
    expect(suggestedReviewRating(true)).toBe("good");
    expect(suggestedReviewRating(false)).toBe("again");
  });

  it("moves from recognition to scaffolded and free recall", () => {
    expect(nextDifficulty(null, "good", true)).toBe(1);
    expect(nextDifficulty({ difficultyLevel: 1 }, "good", true)).toBe(2);
    expect(nextDifficulty({ difficultyLevel: 2 }, "easy", true)).toBe(3);
    expect(nextDifficulty({ difficultyLevel: 2 }, "hard", true)).toBe(1);
    expect(nextDifficulty({ difficultyLevel: 3 }, "again", false)).toBe(2);
    expect(nextDifficulty({ difficultyLevel: 0 }, "again", false)).toBe(0);
  });

  it("builds a cloze answer from the middle token", () => {
    expect(clozeShape("Mam na imię Anna.")).toEqual({
      tokens: ["Mam", "na", "imię", "Anna."],
      answer: "imię",
      clozePrefix: "Mam na",
      clozeSuffix: "Anna.",
    });
  });

  it("puts a first good answer one day out", () => {
    const now = new Date("2026-08-21T10:00:00.000Z");
    const next = calculateNextReview(null, "good", now);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
    expect(next.dueAt).toBe("2026-08-22T10:00:00.000Z");
    expect(next.status).toBe("learning");
  });

  it("keeps a missed answer in the queue shortly after the attempt", () => {
    const now = new Date("2026-08-21T10:00:00.000Z");
    const next = calculateNextReview(null, "again", now);
    expect(next.dueAt).toBe("2026-08-21T10:15:00.000Z");
    expect(next.lapses).toBe(1);
    expect(next.status).toBe("difficult");
  });

  it("promotes repeated easy reviews to mastered", () => {
    const next = calculateNextReview({ intervalDays: 4, easeFactor: 2.5, repetitions: 2, lapses: 0 }, "easy", new Date("2026-08-21T10:00:00.000Z"));
    expect(next.status).toBe("mastered");
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(13);
  });
});
