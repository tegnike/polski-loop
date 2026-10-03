import { describe, expect, it } from "vitest";
import { calculateVocabularyProgress, type VocabularyProgressEvent } from "../src/lib/vocabulary-progress";

const event = (wordId: string, createdAt: string): VocabularyProgressEvent => ({ wordId, createdAt });

describe("vocabulary progress", () => {
  it("starts at level one and fills all 28 Warsaw calendar dates with zero activity", () => {
    const progress = calculateVocabularyProgress([], new Date("2026-10-02T22:30:00.000Z"));
    expect(progress).toMatchObject({
      today: "2026-10-03", dailyGoal: 5, totalPoints: 0, level: 1, pointsIntoLevel: 0,
      pointsToNextLevel: 10, pointsPerLevel: 10, currentStreak: 0, longestStreak: 0, totalStudyDays: 0,
    });
    expect(progress.activity).toHaveLength(28);
    expect(progress.activity[0]).toEqual({ date: "2026-09-06", words: 0, newWords: 0, reviews: 0 });
    expect(progress.activity.at(-1)).toEqual({ date: "2026-10-03", words: 0, newWords: 0, reviews: 0 });
    expect(progress.activity.every((day) => day.words === 0 && day.newWords === 0 && day.reviews === 0)).toBe(true);
  });

  it("counts a word once per day, counts every saved review, and discovers the first review in unordered history", () => {
    const progress = calculateVocabularyProgress([
      event("a", "2026-10-03T09:00:00.000Z"),
      event("b", "2026-10-03T10:00:00.000Z"),
      event("a", "2026-10-02T10:00:00.000Z"),
      event("a", "2026-10-03T09:01:00.000Z"),
      event("a", "2026-10-03T09:02:00.000Z"),
      event("future", "2026-10-03T10:00:00.001Z"),
      event("invalid", "not a timestamp"),
    ], new Date("2026-10-03T10:00:00.000Z"));
    expect(progress).toMatchObject({ totalPoints: 3, currentStreak: 2, longestStreak: 2, totalStudyDays: 2 });
    expect(progress.activity.slice(-2)).toEqual([
      { date: "2026-10-02", words: 1, newWords: 1, reviews: 1 },
      { date: "2026-10-03", words: 2, newWords: 1, reviews: 4 },
    ]);
  });

  it.each([
    [9, 1, 9, 1], [10, 2, 0, 10], [20, 3, 0, 10], [31, 4, 1, 9],
  ])("converts %i points to level %i with %i points earned and %i remaining", (points, level, into, remaining) => {
    const events = Array.from({ length: points }, (_, index) => event("word-" + index, "2026-10-03T09:00:00.000Z"));
    const progress = calculateVocabularyProgress(events, new Date("2026-10-03T10:00:00.000Z"));
    expect(progress).toMatchObject({ totalPoints: points, level, pointsIntoLevel: into, pointsToNextLevel: remaining });
  });

  it("keeps yesterday's streak until today ends and remembers the longest run outside the activity window", () => {
    const dates = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-12-29", "2026-12-30", "2026-12-31"];
    const progress = calculateVocabularyProgress(dates.map((date) => event("same-word", date + "T12:00:00.000Z")), new Date("2027-01-01T12:00:00.000Z"));
    expect(progress).toMatchObject({ today: "2027-01-01", totalPoints: 8, currentStreak: 3, longestStreak: 5, totalStudyDays: 8 });
    expect(progress.activity.at(-1)).toEqual({ date: "2027-01-01", words: 0, newWords: 0, reviews: 0 });
    expect(progress.activity.filter((day) => day.words)).toHaveLength(3);
    expect(progress.activity.reduce((sum, day) => sum + day.newWords, 0)).toBe(0);
    const broken = calculateVocabularyProgress(dates.map((date) => event("same-word", date + "T12:00:00.000Z")), new Date("2027-01-02T12:00:00.000Z"));
    expect(broken.currentStreak).toBe(0);
    expect(broken.longestStreak).toBe(5);
  });

  it("groups the 23-hour spring DST day by Warsaw calendar date", () => {
    const progress = calculateVocabularyProgress([
      event("a", "2026-03-28T22:30:00.000Z"),
      event("a", "2026-03-28T23:30:00.000Z"),
      event("a", "2026-03-29T01:30:00.000Z"),
      event("a", "2026-03-29T22:00:00.000Z"),
    ], new Date("2026-03-30T10:00:00.000Z"));
    expect(progress).toMatchObject({ totalPoints: 3, currentStreak: 3, longestStreak: 3, totalStudyDays: 3 });
    expect(progress.activity.slice(-3)).toEqual([
      { date: "2026-03-28", words: 1, newWords: 1, reviews: 1 },
      { date: "2026-03-29", words: 1, newWords: 0, reviews: 2 },
      { date: "2026-03-30", words: 1, newWords: 0, reviews: 1 },
    ]);
    expect(new Set(progress.activity.map((day) => day.date)).size).toBe(28);
  });

  it("groups both repeated autumn DST hours together and uses winter midnight after the transition", () => {
    const progress = calculateVocabularyProgress([
      event("a", "2026-10-24T21:59:00.000Z"),
      event("a", "2026-10-24T22:00:00.000Z"),
      event("a", "2026-10-25T00:30:00.000Z"),
      event("a", "2026-10-25T01:30:00.000Z"),
      event("a", "2026-10-25T23:00:00.000Z"),
    ], new Date("2026-10-26T10:00:00.000Z"));
    expect(progress).toMatchObject({ totalPoints: 3, currentStreak: 3, longestStreak: 3 });
    expect(progress.activity.slice(-3)).toEqual([
      { date: "2026-10-24", words: 1, newWords: 1, reviews: 1 },
      { date: "2026-10-25", words: 1, newWords: 0, reviews: 3 },
      { date: "2026-10-26", words: 1, newWords: 0, reviews: 1 },
    ]);
    expect(new Set(progress.activity.map((day) => day.date)).size).toBe(28);
  });
});
