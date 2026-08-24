import type {
  AttemptVerdict,
  DifficultyLevel,
  ExerciseShape,
  PromptDirection,
  QuestionType,
  ReviewRating,
  ReviewState,
} from "./types";

const POLISH_DIACRITIC_MAP: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/[.!?。！？]+$/u, "")
    .replace(/\s+/gu, " ");
}

export function removePolishDiacritics(value: string): string {
  return Array.from(normalizeAnswer(value), (character) => POLISH_DIACRITIC_MAP[character] ?? character).join("");
}

export function suggestedReviewRating(isCorrect: boolean): ReviewRating {
  return isCorrect ? "good" : "again";
}

export function seededShuffleIndexes(length: number, seed: string): number[] {
  const values = Array.from({ length }, (_, index) => index);
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619) >>> 0;
  }
  const nextRandom = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = nextRandom() % (index + 1);
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

export function gradeTarget(
  answer: string,
  acceptedAnswers: string[],
  targetLanguage: "polish" | "japanese",
): { verdict: AttemptVerdict; isCorrect: boolean } {
  const normalized = normalizeAnswer(answer);
  const exact = acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized);
  if (exact) return { verdict: "correct", isCorrect: true };
  if (targetLanguage === "polish") {
    const close = acceptedAnswers.some((accepted) => removePolishDiacritics(accepted) === removePolishDiacritics(answer));
    if (close) return { verdict: "diacritic_missing", isCorrect: false };
  }
  return { verdict: "incorrect", isCorrect: false };
}

export function gradeAnswer(answer: string, acceptedAnswers: string[]): { verdict: AttemptVerdict; isCorrect: boolean } {
  return gradeTarget(answer, acceptedAnswers, "polish");
}

export function ratingFromVerdict(verdict: AttemptVerdict): ReviewRating {
  return verdict === "correct" ? "good" : "again";
}

export function questionTypeForDifficulty(level: number): QuestionType {
  if (level <= 0) return "multiple_choice";
  if (level === 1) return "cloze";
  if (level === 2) return "unscramble";
  return "free_input";
}

export function directionForDifficulty(itemId: string, level: number): PromptDirection {
  if (level === 0) {
    const numeric = Array.from(itemId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return numeric % 2 === 0 ? "meaning_to_polish" : "polish_to_meaning";
  }
  return "meaning_to_polish";
}

export function difficultyLabel(level: number): string {
  if (level <= 0) return "認識（4択）";
  if (level === 1) return "足場付き想起（穴埋め）";
  if (level === 2) return "足場付き想起（語順）";
  return "自由想起（自由入力）";
}

export function nextDifficulty(
  previous: Partial<ReviewState> | null,
  rating: ReviewRating,
  wasCorrect: boolean,
): DifficultyLevel {
  const current = Math.max(0, Math.min(3, previous?.difficultyLevel ?? 0));
  if (!wasCorrect || rating === "again" || rating === "hard") return Math.max(0, current - 1) as DifficultyLevel;
  if (rating === "easy") return Math.min(3, current + 2) as DifficultyLevel;
  return Math.min(3, current + 1) as DifficultyLevel;
}

export function calculateNextReview(
  previous: Partial<ReviewState> | null,
  rating: ReviewRating,
  now = new Date(),
): Omit<ReviewState, "itemId" | "difficultyLevel" | "successStreak" | "failureStreak" | "lastQuestionType" | "lastDirection"> {
  const oldInterval = previous?.intervalDays ?? 0;
  const oldEase = previous?.easeFactor ?? 2.5;
  const oldRepetitions = previous?.repetitions ?? 0;
  const oldLapses = previous?.lapses ?? 0;
  let intervalDays: number;
  let easeFactor = oldEase;
  let repetitions = oldRepetitions;
  let lapses = oldLapses;

  if (rating === "again") {
    intervalDays = 15 / (24 * 60);
    easeFactor = Math.max(1.3, oldEase - 0.2);
    repetitions = 0;
    lapses += 1;
  } else if (rating === "hard") {
    intervalDays = Math.max(1 / 24, oldInterval * 1.2 || 1);
    easeFactor = Math.max(1.3, oldEase - 0.15);
    repetitions += 1;
  } else if (rating === "easy") {
    intervalDays = oldInterval > 0 ? oldInterval * easeFactor * 1.3 : 4;
    easeFactor += 0.15;
    repetitions += 1;
  } else {
    intervalDays = oldInterval > 0 ? oldInterval * easeFactor : 1;
    repetitions += 1;
  }

  const due = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const status: ReviewState["status"] = rating === "again"
    ? "difficult"
    : rating === "easy" || repetitions >= 3
      ? "mastered"
      : "learning";

  return {
    dueAt: due.toISOString(),
    intervalDays: Number(intervalDays.toFixed(4)),
    easeFactor: Number(easeFactor.toFixed(3)),
    repetitions,
    lapses,
    lastRating: rating,
    lastAttemptAt: now.toISOString(),
    status,
  };
}

export function clozeShape(value: string): Pick<ExerciseShape, "tokens" | "clozePrefix" | "clozeSuffix"> & { answer: string } {
  const tokens = value.trim().split(/\s+/u);
  const blankIndex = Math.min(tokens.length - 1, Math.max(0, Math.floor(tokens.length / 2)));
  return {
    tokens,
    answer: tokens[blankIndex] ?? value.trim(),
    clozePrefix: tokens.slice(0, blankIndex).join(" "),
    clozeSuffix: tokens.slice(blankIndex + 1).join(" "),
  };
}

export function unscrambleShape(value: string): string[] {
  return value.trim().split(/\s+/u);
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60000));
  return `${minutes}分`;
}

export function formatDueDate(value: string, now = new Date()): string {
  const due = new Date(value);
  const deltaHours = (due.getTime() - now.getTime()) / 3600000;
  if (deltaHours <= 0) return "今すぐ";
  if (deltaHours < 24) return `${Math.max(1, Math.round(deltaHours))}時間後`;
  return `${Math.round(deltaHours / 24)}日後`;
}
