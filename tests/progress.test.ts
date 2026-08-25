import { describe, expect, it } from "vitest";
import {
  buildDailyProgressActivity,
  currentActivityStreak,
  isActiveProgressDay,
  longestActivityStreak,
  shiftProgressDate,
} from "../src/lib/progress";

describe("progress activity", () => {
  it("builds a continuous window and aggregates existing learning records", () => {
    const activity = buildDailyProgressActivity(
      "2026-08-25",
      4,
      [
        { date: "2026-08-23", mode: "lesson", durationMs: 5 * 60_000 },
        { date: "2026-08-23", mode: "review", durationMs: 90_000 },
      ],
      [
        { date: "2026-08-23", isCorrect: true },
        { date: "2026-08-23", isCorrect: false },
        { date: "2026-08-25", isCorrect: true },
      ],
      [{ date: "2026-08-24" }],
    );

    expect(activity.map((day) => day.date)).toEqual([
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
    ]);
    expect(activity[1]).toMatchObject({
      completedSessions: 2,
      lessonSessions: 1,
      reviewSessions: 1,
      minutes: 7,
      attempts: 2,
      correctAttempts: 1,
    });
    expect(activity[2].voiceResults).toBe(1);
    expect(activity[3].attempts).toBe(1);
  });

  it("keeps a missed day visible without erasing the best run", () => {
    const activity = buildDailyProgressActivity(
      "2026-08-25",
      6,
      [],
      [
        { date: "2026-08-20", isCorrect: true },
        { date: "2026-08-21", isCorrect: true },
        { date: "2026-08-23", isCorrect: true },
        { date: "2026-08-24", isCorrect: true },
        { date: "2026-08-25", isCorrect: true },
      ],
      [],
    );

    expect(activity.map(isActiveProgressDay)).toEqual([
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
    expect(longestActivityStreak(activity)).toBe(3);
    expect(currentActivityStreak(activity)).toBe(3);
  });

  it("resets only the current run when the latest day has no activity", () => {
    const activity = buildDailyProgressActivity(
      "2026-08-25",
      3,
      [{ date: "2026-08-24", mode: "lesson", durationMs: 60_000 }],
      [],
      [],
    );

    expect(longestActivityStreak(activity)).toBe(1);
    expect(currentActivityStreak(activity)).toBe(0);
  });

  it("moves date keys without depending on the machine timezone", () => {
    expect(shiftProgressDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftProgressDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
