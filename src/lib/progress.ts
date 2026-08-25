import type { DailyProgressActivity } from "./types";

export interface DatedSessionActivity {
  date: string;
  mode: "lesson" | "review";
  durationMs: number;
}

export interface DatedAttemptActivity {
  date: string;
  isCorrect: boolean;
}

export interface DatedVoiceActivity {
  date: string;
}

export function shiftProgressDate(key: string, days: number): string {
  const parts = key.split("-").map(Number);
  return new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2] + days),
  )
    .toISOString()
    .slice(0, 10);
}

export function buildDailyProgressActivity(
  today: string,
  dayCount: number,
  sessions: DatedSessionActivity[],
  attempts: DatedAttemptActivity[],
  voiceResults: DatedVoiceActivity[],
): DailyProgressActivity[] {
  const safeDayCount = Math.max(1, Math.floor(dayCount));
  const days = Array.from({ length: safeDayCount }, (_, index) => {
    const date = shiftProgressDate(today, index - safeDayCount + 1);
    return [
      date,
      {
        date,
        completedSessions: 0,
        lessonSessions: 0,
        reviewSessions: 0,
        minutes: 0,
        attempts: 0,
        correctAttempts: 0,
        voiceResults: 0,
      },
    ] as const;
  });
  const activityByDate = new Map<string, DailyProgressActivity>(days);
  const durationByDate = new Map<string, number>();

  for (const session of sessions) {
    const day = activityByDate.get(session.date);
    if (!day) continue;
    day.completedSessions += 1;
    day.lessonSessions += session.mode === "lesson" ? 1 : 0;
    day.reviewSessions += session.mode === "review" ? 1 : 0;
    durationByDate.set(
      session.date,
      (durationByDate.get(session.date) ?? 0) + Math.max(0, session.durationMs),
    );
  }
  for (const attempt of attempts) {
    const day = activityByDate.get(attempt.date);
    if (!day) continue;
    day.attempts += 1;
    day.correctAttempts += attempt.isCorrect ? 1 : 0;
  }
  for (const voiceResult of voiceResults) {
    const day = activityByDate.get(voiceResult.date);
    if (day) day.voiceResults += 1;
  }

  for (const [date, durationMs] of durationByDate) {
    const day = activityByDate.get(date);
    if (day) day.minutes = Math.round(durationMs / 60_000);
  }

  return days.map(([, day]) => day);
}

export function isActiveProgressDay(day: DailyProgressActivity): boolean {
  return (
    day.completedSessions > 0 || day.attempts > 0 || day.voiceResults > 0
  );
}

export function longestActivityStreak(
  activity: DailyProgressActivity[],
): number {
  let longest = 0;
  let current = 0;
  for (const day of activity) {
    current = isActiveProgressDay(day) ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function currentActivityStreak(
  activity: DailyProgressActivity[],
): number {
  let streak = 0;
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if (!isActiveProgressDay(activity[index])) break;
    streak += 1;
  }
  return streak;
}
