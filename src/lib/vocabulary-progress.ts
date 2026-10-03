import type { VocabularyActivityDay, VocabularyProgress } from "./types";
import { vocabularyDateKey } from "./vocabulary";

export interface VocabularyProgressEvent {
  wordId: string;
  createdAt: string;
}

const DAILY_GOAL = 5;
const POINTS_PER_LEVEL = 10;
const ACTIVITY_DAYS = 28;

// Shift a calendar date, not a Warsaw timestamp: DST days can be 23 or 25 hours.
function shiftDate(date: string, days: number): string {
  const value = new Date(date + "T00:00:00.000Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calculateVocabularyProgress(events: readonly VocabularyProgressEvent[], now = new Date()): VocabularyProgress {
  const today = vocabularyDateKey(now);
  const nowTime = now.getTime();
  const days = new Map<string, { words: Set<string>; newWords: number; reviews: number }>();
  const firstReviews = new Map<string, { timestamp: number; date: string }>();

  for (const event of events) {
    const timestamp = Date.parse(event.createdAt);
    if (!Number.isFinite(timestamp) || timestamp > nowTime) continue;
    const date = vocabularyDateKey(new Date(timestamp));
    let day = days.get(date);
    if (!day) {
      day = { words: new Set(), newWords: 0, reviews: 0 };
      days.set(date, day);
    }
    day.words.add(event.wordId);
    day.reviews++;
    const firstReview = firstReviews.get(event.wordId);
    if (!firstReview || timestamp < firstReview.timestamp) firstReviews.set(event.wordId, { timestamp, date });
  }
  for (const firstReview of firstReviews.values()) days.get(firstReview.date)!.newWords++;

  let totalPoints = 0;
  let longestStreak = 0;
  let run = 0;
  let previousDate: string | null = null;
  for (const date of [...days.keys()].sort()) {
    totalPoints += days.get(date)!.words.size;
    run = previousDate && shiftDate(previousDate, 1) === date ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previousDate = date;
  }

  let currentStreak = 0;
  let streakDate = days.has(today) ? today : shiftDate(today, -1);
  while (days.has(streakDate)) {
    currentStreak++;
    streakDate = shiftDate(streakDate, -1);
  }

  const activity: VocabularyActivityDay[] = Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const date = shiftDate(today, index - ACTIVITY_DAYS + 1);
    const day = days.get(date);
    return { date, words: day?.words.size ?? 0, newWords: day?.newWords ?? 0, reviews: day?.reviews ?? 0 };
  });
  const pointsIntoLevel = totalPoints % POINTS_PER_LEVEL;
  return {
    today,
    dailyGoal: DAILY_GOAL,
    totalPoints,
    level: Math.floor(totalPoints / POINTS_PER_LEVEL) + 1,
    pointsIntoLevel,
    pointsToNextLevel: POINTS_PER_LEVEL - pointsIntoLevel,
    pointsPerLevel: POINTS_PER_LEVEL,
    currentStreak,
    longestStreak,
    totalStudyDays: days.size,
    activity,
  };
}
