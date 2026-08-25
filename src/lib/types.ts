export type ItemType = "word" | "phrase" | "sentence" | "grammar";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type AttemptVerdict = "correct" | "diacritic_missing" | "incorrect";
export type QuestionType = "multiple_choice" | "cloze" | "unscramble" | "free_input";
export type PromptDirection = "meaning_to_polish" | "polish_to_meaning";
export type DifficultyLevel = 0 | 1 | 2 | 3;
export type TrackCode = "A1" | "A2";
export type CanDoStatus = "not_started" | "practicing" | "self_assessed" | "evidenced";
export type ItemSkill = "listening" | "spoken_interaction" | "spoken_production";
export type ItemRegister = "formal" | "informal" | "neutral";

export type AiChatRole = "user" | "assistant";

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiPageContext {
  key: string;
  label: string;
  content: string;
}

export interface AiChatRequest {
  context: AiPageContext;
  messages: AiChatMessage[];
}

export interface AiChatResponse {
  message: string;
  model: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface LearningItem {
  id: string;
  type: ItemType;
  polish: string;
  meaningJa: string;
  meaningEn: string;
  grammarNote: string;
  topic: string;
  tags: string[];
  acceptedAnswers: string[];
  contentVersion: string;
  cefrLevel?: TrackCode;
  skills?: ItemSkill[];
  situation?: string;
  register?: ItemRegister;
  speakerGender?: "male" | "female" | "any";
  dialogueRole?: "learner" | "partner";
}

export interface ReviewState {
  itemId: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating: ReviewRating | null;
  lastAttemptAt: string | null;
  status: "new" | "learning" | "mastered" | "difficult";
  difficultyLevel: DifficultyLevel;
  successStreak: number;
  failureStreak: number;
  lastQuestionType: QuestionType | null;
  lastDirection: PromptDirection | null;
}

export interface ExerciseShape {
  questionType: QuestionType;
  direction: PromptDirection;
  scaffoldLevel: 0 | 1 | 2;
  options: ChoiceOption[];
  tokens: string[];
  clozePrefix: string;
  clozeSuffix: string;
  hintText: string;
}

export interface LessonStep extends ExerciseShape {
  id: string;
  stepNumber: number;
  kind: "input" | "choice";
  promptJa: string;
  explanation: string;
  item: LearningItem;
}

export interface LessonSummary {
  id: string;
  unitId: string;
  lessonNumber: number;
  titleJa: string;
  titlePl: string;
  description: string;
  estimatedMinutes: number;
  completed: boolean;
  stepCount: number;
}

export interface Lesson extends LessonSummary {
  steps: LessonStep[];
  mission: VoiceMission | null;
}

export interface DueItem extends LearningItem {
  reviewState: ReviewState;
  exercise: ExerciseShape;
}

export interface UnitProgress {
  id: string;
  trackCode?: TrackCode;
  cefrLevel?: TrackCode;
  unitNumber: number;
  titleJa: string;
  titlePl: string;
  description: string;
  completedLessons: number;
  totalLessons: number;
  lessons: LessonSummary[];
  canDoCompleted?: number;
  canDoTotal?: number;
}

export interface TrackSummary {
  id: string;
  code: TrackCode;
  title: string;
  cefr: string;
  contentVersion: string;
  unitCount: number;
  lessonCount: number;
  itemCount: number;
}

export interface CurriculumSummary {
  unitCount: number;
  lessonCount: number;
  publishedItemCount: number;
  uniquePublishedItemCount: number;
  a1ItemCount: number;
  a2ItemCount: number;
}

export interface VoiceMission {
  id: string;
  unitId: string;
  lessonId: string;
  title: string;
  scenario: string;
  learnerRole: string;
  partnerRole: string;
  objective: string;
  learnerItemIds: string[];
  partnerItemIds: string[];
  requiredItemIds: string[];
  requiredExpressions: string[];
  requiredExpressionGenders: Array<"male" | "female" | "any">;
  partnerExpressions: string[];
  partnerExpressionGenders: Array<"male" | "female" | "any">;
  partnerBehavior: string;
  difficultyLevel: "A1" | "A2";
  endingCondition: string;
  feedbackFormat: string;
  promptText: string;
}

export interface VoiceResult {
  id: string;
  missionId: string;
  trackCode: TrackCode | null;
  unitNumber: number | null;
  lessonId: string | null;
  lessonTitle: string | null;
  sessionId: string | null;
  heard: boolean;
  replied: boolean;
  askedBack: boolean;
  needsRestatement: boolean;
  confidence: 1 | 2 | 3 | 4 | 5;
  notes: string;
  createdAt: string;
  sourceKind: "self_report" | "chatgpt_file";
  externalResultId: string | null;
  schemaVersion: string | null;
  evaluatedAt: string | null;
  overallScore: number | null;
  scores: VoiceScores | null;
  feedback: VoiceImportedFeedback | null;
}

export interface VoiceScores {
  taskCompletion: number;
  comprehension: number;
  responseAccuracy: number;
  targetExpressionUse: number;
  interactionFluency: number;
}

export interface VoiceCorrection { original: string; suggested: string; reason: string }
export interface VoiceImportedFeedback {
  summary: string;
  strengths: string[];
  corrections: VoiceCorrection[];
  nextStep: string;
}

export interface VoiceResultImport {
  schemaVersion: "polski-loop.voice-result.v1";
  resultId: string;
  missionId: string;
  lessonId: string;
  evaluatedAt: string;
  scores: VoiceScores;
  evidence: {
    understoodPartner: boolean;
    respondedToPartner: boolean;
    usedRepairStrategy: boolean;
    neededRestatement: boolean;
  };
  summary: string;
  strengths: string[];
  corrections: VoiceCorrection[];
  nextStep: string;
}

export interface CanDoItem {
  id: string;
  unitId: string;
  code: string;
  cefrLevel: TrackCode;
  skill: "listening" | "spoken_interaction" | "spoken_production";
  statementJa: string;
  statementPl: string;
  evidenceRule: string;
  status: CanDoStatus;
  selfRating: number | null;
  evidenceNotes: string;
  updatedAt: string | null;
}

export interface CanDoUnit {
  unit: UnitProgress;
  items: CanDoItem[];
  completionPercent: number;
  recallAccuracy: number | null;
  voiceAverageConfidence: number | null;
  voiceResultsCount: number;
}

export interface Recommendation {
  kind: "lesson" | "review" | "voice" | "cando";
  title: string;
  detail: string;
  lessonId?: string;
  unitId?: string;
  missionId?: string;
}

export interface DailyProgressActivity {
  date: string;
  completedSessions: number;
  lessonSessions: number;
  reviewSessions: number;
  minutes: number;
  attempts: number;
  correctAttempts: number;
  voiceResults: number;
}

export interface StatusResponse {
  profile: {
    id: string;
    displayName: string;
    studyTimezone: string;
    dailyNewLimit: number;
    dailyReviewLimit: number;
  };
  track: { id: string; code: string; title: string; cefr: string; contentVersion: string };
  unit: { id: string; unitNumber: number; titleJa: string; titlePl: string; description: string };
  units: UnitProgress[];
  allUnits: UnitProgress[];
  tracks: TrackSummary[];
  curriculum: CurriculumSummary;
  nextLesson: LessonSummary;
  nextMission: VoiceMission;
  progress: {
    completedLessons: number;
    totalLessons: number;
    learnedItems: number;
    masteredItems: number;
    dueReviews: number;
    streakDays: number;
    studyDaysThisWeek: number;
    minutesThisWeek: number;
    dailyActivity: DailyProgressActivity[];
  };
  recommendations: Recommendation[];
  recentSessions: Array<{ id: string; lessonTitle: string; mode: string; durationMs: number; completedAt: string | null }>;
}

export interface AttemptResult {
  attemptId: string;
  isCorrect: boolean;
  verdict: AttemptVerdict;
  expectedAnswer: string;
  feedback: string;
  questionType: QuestionType;
  direction: PromptDirection;
  difficultyBefore: DifficultyLevel;
  difficultyAfter: DifficultyLevel;
  difficultyLabel: string;
  reviewState: ReviewState | null;
}

export interface MistakeSummary {
  tag: string;
  count: number;
  examples: string[];
}

export interface HistoryEntry {
  id: string;
  itemId: string;
  polish: string;
  meaningJa: string;
  questionType: QuestionType;
  direction: PromptDirection;
  verdict: AttemptVerdict;
  rating: ReviewRating | null;
  isCorrect: boolean;
  elapsedMs: number;
  createdAt: string;
  difficultyBefore: DifficultyLevel | null;
  difficultyAfter: DifficultyLevel | null;
}

export type TimelineEventType = "attempt" | "session" | "voice";
export type TimelineFilter = "all" | TimelineEventType;

interface TimelineEventBase {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  trackCode: TrackCode | null;
  unitNumber: number | null;
  unitTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
}

export interface AttemptTimelineEvent extends TimelineEventBase {
  type: "attempt";
  itemId: string;
  polish: string;
  meaningJa: string;
  answer: string;
  expectedAnswer: string;
  isCorrect: boolean;
  verdict: AttemptVerdict;
  rating: ReviewRating | null;
  elapsedMs: number;
  questionType: QuestionType;
  direction: PromptDirection;
  difficultyBefore: DifficultyLevel | null;
  difficultyAfter: DifficultyLevel | null;
}

export interface SessionTimelineEvent extends TimelineEventBase {
  type: "session";
  mode: "lesson" | "review";
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
}

export interface VoiceTimelineEvent extends TimelineEventBase {
  type: "voice";
  missionId: string;
  missionTitle: string;
  sourceKind: "self_report" | "chatgpt_file";
  overallScore: number | null;
  confidence: number;
  notes: string;
  scores: VoiceScores | null;
  feedback: VoiceImportedFeedback | null;
}

export type TimelineEvent = AttemptTimelineEvent | SessionTimelineEvent | VoiceTimelineEvent;

export interface TimelinePage {
  items: TimelineEvent[];
  nextCursor: string | null;
}

export interface ApiError {
  error: string;
  message: string;
}
