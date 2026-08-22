import {
  calculateNextReview,
  clozeShape,
  difficultyLabel,
  directionForDifficulty,
  gradeTarget,
  nextDifficulty,
  questionTypeForDifficulty,
  ratingFromVerdict,
} from "../src/lib/learning";
import { buildMissionPrompt } from "../src/lib/mission";
import { validateVoiceResultImport, VOICE_SCORE_KEYS } from "../src/lib/voice-result";
import type {
  AttemptResult, CanDoItem, CanDoStatus, CanDoUnit, ChoiceOption, CurriculumSummary, DifficultyLevel,
  DueItem, ExerciseShape, ItemType, LearningItem, Lesson, LessonStep, LessonSummary, MistakeSummary,
  ItemRegister, ItemSkill, PromptDirection, QuestionType, Recommendation, ReviewRating, ReviewState, StatusResponse, TrackCode,
  TrackSummary, UnitProgress, VoiceImportedFeedback, VoiceMission, VoiceResult, VoiceResultImport, VoiceScores,
} from "../src/lib/types";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENV?: string;
  PROFILE_ID?: string;
  REQUIRE_ACCESS_AUTH?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
}
interface ProfileRow { id: string; display_name: string; study_timezone: string; daily_new_limit: number; daily_review_limit: number; }
interface TrackRow { id: string; code: TrackCode; title: string; cefr: string; content_version: string; }
interface UnitRow { id: string; track_id?: string; track_code?: TrackCode; cefr_level?: TrackCode; unit_number: number; title_ja: string; title_pl: string; description: string; }
interface LessonRow { id: string; unit_id: string; lesson_number: number; title_ja: string; title_pl: string; description: string; estimated_minutes: number; completed?: number; step_count?: number; }
interface ItemRow { id: string; type: ItemType; polish: string; meaning_ja: string; meaning_en: string; grammar_note: string; topic: string; tags_json: string; accepted_answers_json: string; content_version: string; cefr_level?: TrackCode; skills_json?: string; scene?: string; register?: ItemRegister; speaker_gender?: "male" | "female" | "any"; dialogue_role?: "learner" | "partner"; }
interface StepRow extends ItemRow {
  unit_id: string; lesson_number: number; title_ja: string; title_pl: string; description: string;
  estimated_minutes: number; lesson_id: string; step_id: string; step_number: number;
  kind: "input" | "choice"; prompt_ja: string; explanation: string; options_json: string | null;
  question_type: QuestionType; direction: PromptDirection; answer_text: string;
  cloze_prefix: string; cloze_suffix: string; cloze_answer: string; tokens_json: string;
  scaffold_level: number; hint_text: string;
}
interface ReviewRow {
  item_id: string; due_at: string; interval_days: number; ease_factor: number; repetitions: number;
  lapses: number; last_rating: ReviewRating | null; last_attempt_at: string | null;
  status: ReviewState["status"]; difficulty_level: number; success_streak: number;
  failure_streak: number; last_question_type: QuestionType | null; last_direction: PromptDirection | null;
}
interface ItemReviewRow extends ItemRow {
  review_item_id: string | null; review_due_at: string | null; review_interval_days: number | null;
  review_ease_factor: number | null; review_repetitions: number | null; review_lapses: number | null;
  review_last_rating: ReviewRating | null; review_last_attempt_at: string | null;
  review_status: ReviewState["status"] | null; review_difficulty_level: number | null;
  review_success_streak: number | null; review_failure_streak: number | null;
  review_last_question_type: QuestionType | null; review_last_direction: PromptDirection | null;
}
interface AttemptRow {
  id: string; item_id: string; answer: string; expected_answer: string; is_correct: number;
  verdict: "correct" | "diacritic_missing" | "incorrect"; rating: ReviewRating | null;
  question_type: QuestionType; direction: PromptDirection; difficulty_before: number;
  difficulty_after: number; elapsed_ms?: number; created_at?: string;
}
interface SessionRow { id: string; lesson_id: string | null; lesson_title: string | null; mode: "lesson" | "review"; started_at: string; completed_at: string | null; duration_ms: number; }
interface MissionRow {
  id: string; unit_id: string; lesson_id: string; title: string; scenario: string; learner_role: string; partner_role: string;
  objective: string; learner_item_ids_json: string; partner_item_ids_json: string; required_item_ids_json: string;
  partner_behavior: string; difficulty_level: "A1" | "A2"; ending_condition: string; feedback_format: string;
}
interface VoiceAttemptRow {
  id: string; mission_id: string; session_id: string | null; heard: number; replied: number; asked_back: number;
  rephrased: number; confidence: number; notes: string; created_at: string; updated_at: string;
  source_kind: "self_report" | "chatgpt_file"; external_result_id: string | null; schema_version: string | null;
  evaluated_at: string | null; overall_score: number | null; scores_json: string | null; feedback_json: string | null;
}
interface CanDoRow {
  id: string; unit_id: string; code: string; cefr_level: TrackCode; skill: CanDoItem["skill"];
  statement_ja: string; statement_pl: string; evidence_rule: string; status: CanDoStatus | null;
  self_rating: number | null; evidence_notes: string | null; updated_at: string | null;
}

const PROFILE_FALLBACK = "master";
const CONTENT_VERSION = "a1-a2-2026.1";
const QUESTION_TYPES: QuestionType[] = ["multiple_choice", "cloze", "unscramble", "free_input"];
const DIRECTIONS: PromptDirection[] = ["meaning_to_polish", "polish_to_meaning"];
const RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];
const VOICE_RESULT_COLUMNS = "id, mission_id, session_id, heard, replied, asked_back, rephrased, confidence, notes, created_at, updated_at, source_kind, external_result_id, schema_version, evaluated_at, overall_score, scores_json, feedback_json";

function profileId(env: Env): string { return env.PROFILE_ID || PROFILE_FALLBACK; }
function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "content-type, cf-access-jwt-assertion");
  headers.set("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  return new Response(JSON.stringify(data), { ...init, headers });
}
function textResponse(text: string, contentType: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", contentType);
  headers.set("cache-control", "no-store");
  headers.set("access-control-allow-origin", "*");
  return new Response(text, { ...init, headers });
}
function errorResponse(status: number, message: string): Response { return jsonResponse({ error: status >= 500 ? "server_error" : "bad_request", message }, { status }); }
function parseArray(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch { return []; }
}
function parseJsonValue<T>(value: string | null | undefined): T | null {
  try { return value ? JSON.parse(value) as T : null; }
  catch { return null; }
}
function parseOptions(value: string | null | undefined): ChoiceOption[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is ChoiceOption => typeof entry === "object" && entry !== null
      && "value" in entry && "label" in entry && typeof entry.value === "string" && typeof entry.label === "string") : [];
  } catch { return []; }
}
function itemFromRow(row: ItemRow): LearningItem {
  const item: LearningItem = { id: row.id, type: row.type, polish: row.polish, meaningJa: row.meaning_ja, meaningEn: row.meaning_en,
    grammarNote: row.grammar_note, topic: row.topic, tags: parseArray(row.tags_json),
    acceptedAnswers: parseArray(row.accepted_answers_json), contentVersion: row.content_version };
  if (row.cefr_level) item.cefrLevel = row.cefr_level;
  if (row.skills_json) item.skills = parseArray(row.skills_json).filter((skill): skill is ItemSkill => ["listening", "spoken_interaction", "spoken_production"].includes(skill));
  if (row.scene) item.situation = row.scene;
  if (row.register) item.register = row.register;
  if (row.speaker_gender) item.speakerGender = row.speaker_gender;
  if (row.dialogue_role) item.dialogueRole = row.dialogue_role;
  return item;
}
function missionPrompt(row: MissionRow, requiredExpressions: string[], partnerExpressions: string[]): string {
  return buildMissionPrompt({ missionId: row.id, lessonId: row.lesson_id, scenario: row.scenario, learnerRole: row.learner_role, partnerRole: row.partner_role,
    difficultyLevel: row.difficulty_level, partnerBehavior: row.partner_behavior, endingCondition: row.ending_condition,
    feedbackFormat: row.feedback_format }, requiredExpressions, partnerExpressions);
}
function missionFromRow(row: MissionRow, items: LearningItem[]): VoiceMission {
  const learnerItemIds = parseArray(row.learner_item_ids_json);
  const partnerItemIds = parseArray(row.partner_item_ids_json);
  const requiredItemIds = parseArray(row.required_item_ids_json);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const requiredExpressions = requiredItemIds.map((id) => itemMap.get(id)?.polish).filter((value): value is string => Boolean(value));
  const partnerExpressions = partnerItemIds.map((id) => itemMap.get(id)?.polish).filter((value): value is string => Boolean(value));
  return { id: row.id, unitId: row.unit_id, lessonId: row.lesson_id, title: row.title, scenario: row.scenario,
    learnerRole: row.learner_role, partnerRole: row.partner_role, objective: row.objective, learnerItemIds,
    partnerItemIds, requiredItemIds, requiredExpressions, partnerExpressions, partnerBehavior: row.partner_behavior,
    difficultyLevel: row.difficulty_level, endingCondition: row.ending_condition, feedbackFormat: row.feedback_format,
    promptText: missionPrompt(row, requiredExpressions, partnerExpressions) };
}
function voiceResultFromRow(row: VoiceAttemptRow): VoiceResult {
  return { id: row.id, missionId: row.mission_id, sessionId: row.session_id, heard: row.heard === 1, replied: row.replied === 1,
    askedBack: row.asked_back === 1, needsRestatement: row.rephrased === 1, confidence: Math.max(1, Math.min(5, row.confidence)) as VoiceResult["confidence"],
    notes: row.notes, createdAt: row.created_at, sourceKind: row.source_kind ?? "self_report", externalResultId: row.external_result_id,
    schemaVersion: row.schema_version, evaluatedAt: row.evaluated_at, overallScore: row.overall_score,
    scores: parseJsonValue<VoiceScores>(row.scores_json), feedback: parseJsonValue<VoiceImportedFeedback>(row.feedback_json) };
}
function canDoFromRow(row: CanDoRow): CanDoItem {
  return { id: row.id, unitId: row.unit_id, code: row.code, cefrLevel: row.cefr_level, skill: row.skill, statementJa: row.statement_ja,
    statementPl: row.statement_pl, evidenceRule: row.evidence_rule, status: row.status ?? "not_started", selfRating: row.self_rating,
    evidenceNotes: row.evidence_notes ?? "", updatedAt: row.updated_at };
}
function reviewFromRow(row: ReviewRow): ReviewState {
  return { itemId: row.item_id, dueAt: row.due_at, intervalDays: row.interval_days, easeFactor: row.ease_factor,
    repetitions: row.repetitions, lapses: row.lapses, lastRating: row.last_rating, lastAttemptAt: row.last_attempt_at,
    status: row.status, difficultyLevel: Math.max(0, Math.min(3, row.difficulty_level ?? 0)) as DifficultyLevel,
    successStreak: row.success_streak ?? 0, failureStreak: row.failure_streak ?? 0,
    lastQuestionType: row.last_question_type ?? null, lastDirection: row.last_direction ?? null };
}
function reviewFromJoinedRow(row: ItemReviewRow): ReviewState | null {
  if (!row.review_item_id) return null;
  return { itemId: row.review_item_id, dueAt: row.review_due_at ?? new Date().toISOString(),
    intervalDays: row.review_interval_days ?? 0, easeFactor: row.review_ease_factor ?? 2.5,
    repetitions: row.review_repetitions ?? 0, lapses: row.review_lapses ?? 0, lastRating: row.review_last_rating,
    lastAttemptAt: row.review_last_attempt_at, status: row.review_status ?? "new",
    difficultyLevel: Math.max(0, Math.min(3, row.review_difficulty_level ?? 0)) as DifficultyLevel,
    successStreak: row.review_success_streak ?? 0, failureStreak: row.review_failure_streak ?? 0,
    lastQuestionType: row.review_last_question_type, lastDirection: row.review_last_direction };
}
function exerciseFromStep(row: StepRow): ExerciseShape {
  return { questionType: row.question_type, direction: row.direction,
    scaffoldLevel: Math.min(2, Math.max(0, row.scaffold_level)) as 0 | 1 | 2,
    options: parseOptions(row.options_json), tokens: parseArray(row.tokens_json),
    clozePrefix: row.cloze_prefix, clozeSuffix: row.cloze_suffix, hintText: row.hint_text };
}
function lessonSummaryFromRow(row: LessonRow): LessonSummary {
  return { id: row.id, unitId: row.unit_id, lessonNumber: row.lesson_number, titleJa: row.title_ja,
    titlePl: row.title_pl, description: row.description, estimatedMinutes: row.estimated_minutes,
    completed: row.completed === 1, stepCount: row.step_count ?? 0 };
}
function lessonFromRows(rows: StepRow[], mission: VoiceMission | null): Lesson {
  if (rows.length === 0) throw new Error("lesson_not_found");
  const first = rows[0];
  const steps: LessonStep[] = rows.map((row) => ({ id: row.step_id, stepNumber: row.step_number, kind: row.kind,
    promptJa: row.prompt_ja, explanation: row.explanation, item: itemFromRow(row), ...exerciseFromStep(row) }));
  return { id: first.lesson_id, unitId: first.unit_id, lessonNumber: first.lesson_number, titleJa: first.title_ja,
    titlePl: first.title_pl, description: first.description, estimatedMinutes: first.estimated_minutes,
    completed: false, stepCount: steps.length, steps, mission };
}
function dateKeyInZone(value: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(typeof value === "string" ? new Date(value) : value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return map.year + "-" + map.month + "-" + map.day;
}
function shiftDateKey(key: string, days: number): string {
  const parts = key.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days)).toISOString().slice(0, 10);
}
async function getReviewState(db: D1Database, currentProfileId: string, itemId: string): Promise<ReviewState | null> {
  const row = await db.prepare(
    "SELECT item_id, due_at, interval_days, ease_factor, repetitions, lapses, last_rating, last_attempt_at, status, " +
    "difficulty_level, success_streak, failure_streak, last_question_type, last_direction " +
    "FROM pl_review_states WHERE profile_id = ? AND item_id = ?",
  ).bind(currentProfileId, itemId).first<ReviewRow>();
  return row ? reviewFromRow(row) : null;
}
async function saveReviewState(db: D1Database, currentProfileId: string, itemId: string, state: Omit<ReviewState, "itemId">): Promise<ReviewState> {
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO pl_review_states (profile_id, item_id, due_at, interval_days, ease_factor, repetitions, lapses, last_rating, last_attempt_at, status, " +
    "difficulty_level, success_streak, failure_streak, last_question_type, last_direction, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(profile_id, item_id) DO UPDATE SET due_at = excluded.due_at, interval_days = excluded.interval_days, " +
    "ease_factor = excluded.ease_factor, repetitions = excluded.repetitions, lapses = excluded.lapses, last_rating = excluded.last_rating, " +
    "last_attempt_at = excluded.last_attempt_at, status = excluded.status, difficulty_level = excluded.difficulty_level, " +
    "success_streak = excluded.success_streak, failure_streak = excluded.failure_streak, last_question_type = excluded.last_question_type, " +
    "last_direction = excluded.last_direction, updated_at = excluded.updated_at",
  ).bind(currentProfileId, itemId, state.dueAt, state.intervalDays, state.easeFactor, state.repetitions, state.lapses,
    state.lastRating, state.lastAttemptAt, state.status, state.difficultyLevel, state.successStreak, state.failureStreak,
    state.lastQuestionType, state.lastDirection, now, now).run();
  return { itemId, ...state };
}
async function applyReviewRating(db: D1Database, currentProfileId: string, itemId: string, rating: ReviewRating,
  wasCorrect: boolean, attemptId: string | null, questionType: QuestionType, direction: PromptDirection): Promise<ReviewState> {
  const previous = await getReviewState(db, currentProfileId, itemId);
  const now = new Date();
  const base = calculateNextReview(previous, rating, now);
  const difficultyAfter = nextDifficulty(previous, rating, wasCorrect);
  const state = { ...base, difficultyLevel: difficultyAfter,
    successStreak: wasCorrect ? (previous?.successStreak ?? 0) + 1 : 0,
    failureStreak: wasCorrect ? 0 : (previous?.failureStreak ?? 0) + 1,
    lastQuestionType: questionType, lastDirection: direction };
  const saved = await saveReviewState(db, currentProfileId, itemId, state);
  await db.prepare("INSERT INTO pl_review_events (id, profile_id, item_id, attempt_id, rating, question_type, direction, was_correct, difficulty_before, difficulty_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), currentProfileId, itemId, attemptId, rating, questionType, direction, wasCorrect ? 1 : 0,
      previous?.difficultyLevel ?? 0, difficultyAfter, now.toISOString()).run();
  return saved;
}
function feedbackFor(verdict: AttemptResult["verdict"], grammarNote: string, questionType: QuestionType): string {
  if (verdict === "correct") return questionType === "multiple_choice" ? "正解です。選択肢から思い出せました。" : "正解です。" + grammarNote;
  if (verdict === "diacritic_missing") return "意味は合っています。ą ć ę ł ń ó ś ź ż の記号を確認して、もう一度入力しましょう。";
  return "まだ定着途中です。正解を確認したら、次の段階でまた思い出します。";
}
function expectedAnswer(item: LearningItem, questionType: QuestionType, direction: PromptDirection): string {
  return questionType === "multiple_choice" && direction === "polish_to_meaning" ? item.meaningJa : item.polish;
}
function answerCandidates(item: LearningItem, questionType: QuestionType, direction: PromptDirection, step: StepRow | null): string[] {
  if (questionType === "cloze") return [step?.cloze_answer || clozeShape(item.polish).answer];
  if (step?.answer_text) return [step.answer_text];
  if (questionType === "multiple_choice" && direction === "polish_to_meaning") return [item.meaningJa];
  return item.acceptedAnswers.length > 0 ? item.acceptedAnswers : [item.polish];
}
function targetLanguage(questionType: QuestionType, direction: PromptDirection): "polish" | "japanese" {
  return questionType === "multiple_choice" && direction === "polish_to_meaning" ? "japanese" : "polish";
}
function stableNumber(value: string): number {
  return Array.from(value).reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) % 997, 7);
}
function choiceOptions(item: LearningItem, otherItems: LearningItem[], direction: PromptDirection): ChoiceOption[] {
  const pool = [item, ...otherItems.filter((candidate) => candidate.id !== item.id)].slice(0, 4);
  const offset = pool.length > 0 ? stableNumber(item.id) % pool.length : 0;
  const rotated = pool.slice(offset).concat(pool.slice(0, offset));
  return rotated.map((candidate) => direction === "polish_to_meaning"
    ? { value: candidate.meaningJa, label: candidate.meaningJa } : { value: candidate.polish, label: candidate.polish });
}
function reviewExercise(item: LearningItem, state: ReviewState, otherItems: LearningItem[]): ExerciseShape {
  const questionType = questionTypeForDifficulty(state.difficultyLevel);
  const direction = directionForDifficulty(item.id, state.difficultyLevel);
  const cloze = clozeShape(item.polish);
  return { questionType, direction, scaffoldLevel: questionType === "multiple_choice" ? 0 : questionType === "free_input" ? 2 : 1,
    options: questionType === "multiple_choice" ? choiceOptions(item, otherItems, direction) : [],
    tokens: questionType === "unscramble" ? cloze.tokens : [], clozePrefix: questionType === "cloze" ? cloze.clozePrefix : "",
    clozeSuffix: questionType === "cloze" ? cloze.clozeSuffix : "", hintText: difficultyLabel(state.difficultyLevel) };
}
async function publishedItems(db: D1Database): Promise<LearningItem[]> {
  const result = await db.prepare("SELECT id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, cefr_level, skills_json, scene, register, speaker_gender, dialogue_role FROM pl_learning_items WHERE status = 'published' ORDER BY id").all<ItemRow>();
  return (result.results ?? []).map(itemFromRow);
}

async function verifyAccess(request: Request, env: Env): Promise<Response | null> {
  if (env.APP_ENV === "local" && env.REQUIRE_ACCESS_AUTH !== "true") return null;
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) return errorResponse(401, "Cloudflare Accessの認証が必要です。");
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUDIENCE) return errorResponse(503, "Access検証設定がありません。ローカル環境ではAPP_ENV=localを使用してください。");
  try {
    const parts = assertion.split(".");
    if (parts.length !== 3) throw new Error("malformed_jwt");
    const decode = (value: string): string => atob(value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
    const header = JSON.parse(decode(parts[0])) as { kid?: string; alg?: string };
    const payload = JSON.parse(decode(parts[1])) as { aud?: string | string[]; exp?: number };
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (header.alg !== "RS256" || !header.kid || !audience.includes(env.ACCESS_AUDIENCE) || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("invalid_claims");
    const keyResponse = await fetch("https://" + env.ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs");
    if (!keyResponse.ok) throw new Error("jwks_unavailable");
    const keySet = await keyResponse.json() as { keys?: JsonWebKey[] };
    const key = keySet.keys?.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!key) throw new Error("unknown_kid");
    const cryptoKey = await crypto.subtle.importKey("jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const data = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(parts[2].length / 4) * 4, "=")), (character) => character.charCodeAt(0));
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data)) throw new Error("invalid_signature");
    return null;
  } catch { return errorResponse(401, "Cloudflare Access assertionを検証できません。"); }
}
async function readJson<T>(request: Request): Promise<T> {
  try { return await request.json() as T; } catch { throw new Error("JSON形式のリクエストが必要です。"); }
}

async function unitProgressResponse(db: D1Database, currentProfileId: string, unit: UnitRow): Promise<{ progress: UnitProgress; lessons: Array<{ row: LessonRow; unit: UnitRow }> }> {
  const lessonsResult = await db.prepare(
    "SELECT l.id, l.unit_id, l.lesson_number, l.title_ja, l.title_pl, l.description, l.estimated_minutes, " +
    "CASE WHEN EXISTS (SELECT 1 FROM pl_study_sessions s WHERE s.profile_id = ? AND s.lesson_id = l.id AND s.completed_at IS NOT NULL) THEN 1 ELSE 0 END AS completed, " +
    "(SELECT COUNT(*) FROM pl_lesson_steps ls WHERE ls.lesson_id = l.id) AS step_count FROM pl_lessons l WHERE l.unit_id = ? AND l.status = 'published' ORDER BY l.lesson_number",
  ).bind(currentProfileId, unit.id).all<LessonRow>();
  const rows = lessonsResult.results ?? [];
  const canDo = await db.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(cp.status, 'not_started') IN ('self_assessed', 'evidenced') THEN 1 ELSE 0 END) AS completed " +
    "FROM pl_cando_items ci LEFT JOIN pl_cando_progress cp ON cp.cando_id = ci.id AND cp.profile_id = ? WHERE ci.unit_id = ?",
  ).bind(currentProfileId, unit.id).first<{ total: number; completed: number | null }>();
  const trackCode = unit.track_code ?? unit.cefr_level ?? "A1";
  const progress: UnitProgress = { id: unit.id, trackCode, cefrLevel: trackCode, unitNumber: unit.unit_number, titleJa: unit.title_ja,
    titlePl: unit.title_pl, description: unit.description, completedLessons: rows.filter((row) => row.completed === 1).length,
    totalLessons: rows.length, lessons: rows.map(lessonSummaryFromRow), canDoCompleted: canDo?.completed ?? 0, canDoTotal: canDo?.total ?? 0 };
  return { progress, lessons: rows.map((row) => ({ row, unit })) };
}

async function statusResponse(db: D1Database, currentProfileId: string, requestedTrack: TrackCode): Promise<StatusResponse> {
  const profile = await db.prepare("SELECT id, display_name, study_timezone, daily_new_limit, daily_review_limit FROM pl_profiles WHERE id = ?").bind(currentProfileId).first<ProfileRow>();
  const track = await db.prepare("SELECT id, code, title, cefr, content_version FROM pl_tracks WHERE code = ? AND status = 'published'").bind(requestedTrack).first<TrackRow>();
  if (!profile || !track) throw new Error("seed_data_missing");
  const unitsResult = await db.prepare("SELECT u.id, u.track_id, t.code AS track_code, u.cefr_level, u.unit_number, u.title_ja, u.title_pl, u.description FROM pl_units u JOIN pl_tracks t ON t.id = u.track_id WHERE u.track_id = ? AND u.status = 'published' ORDER BY u.unit_number").bind(track.id).all<UnitRow>();
  const units = unitsResult.results ?? [];
  if (units.length !== 10) throw new Error("seed_data_missing");
  const activeUnitResults = await Promise.all(units.map((unit) => unitProgressResponse(db, currentProfileId, unit)));
  const unitProgress = activeUnitResults.map((entry) => entry.progress);
  const allLessons = activeUnitResults.flatMap((entry) => entry.lessons);
  const allUnitsResult = await db.prepare("SELECT u.id, u.track_id, t.code AS track_code, u.cefr_level, u.unit_number, u.title_ja, u.title_pl, u.description FROM pl_units u JOIN pl_tracks t ON t.id = u.track_id WHERE u.status = 'published' AND t.status = 'published' ORDER BY t.code, u.unit_number").all<UnitRow>();
  const allUnitProgress = (await Promise.all((allUnitsResult.results ?? []).map((unit) => unitProgressResponse(db, currentProfileId, unit)))).map((entry) => entry.progress);
  const nextEntry = allLessons.find((entry) => entry.row.completed !== 1) ?? allLessons[allLessons.length - 1];
  if (!nextEntry) throw new Error("lesson_seed_missing");
  const trackRows = await db.prepare(
    "SELECT t.id, t.code, t.title, t.cefr, t.content_version, " +
    "(SELECT COUNT(*) FROM pl_units u WHERE u.track_id = t.id AND u.status = 'published') AS unit_count, " +
    "(SELECT COUNT(*) FROM pl_lessons l JOIN pl_units u ON u.id = l.unit_id WHERE u.track_id = t.id AND l.status = 'published') AS lesson_count, " +
    "(SELECT COUNT(*) FROM pl_learning_items i WHERE i.status = 'published' AND i.cefr_level = t.cefr) AS item_count " +
    "FROM pl_tracks t WHERE t.status = 'published' ORDER BY t.code",
  ).all<TrackRow & { unit_count: number; lesson_count: number; item_count: number }>();
  const tracks: TrackSummary[] = (trackRows.results ?? []).map((row) => ({ id: row.id, code: row.code, title: row.title, cefr: row.cefr,
    contentVersion: row.content_version, unitCount: row.unit_count, lessonCount: row.lesson_count, itemCount: row.item_count }));
  const counts = await db.prepare(
    "SELECT COUNT(*) AS published, COUNT(DISTINCT lower(trim(polish))) AS unique_published, " +
    "SUM(CASE WHEN cefr_level = 'A1' THEN 1 ELSE 0 END) AS a1, SUM(CASE WHEN cefr_level = 'A2' THEN 1 ELSE 0 END) AS a2 " +
    "FROM pl_learning_items WHERE status = 'published'",
  ).first<{ published: number; unique_published: number; a1: number; a2: number }>();
  const curriculum: CurriculumSummary = { unitCount: allUnitProgress.length, lessonCount: allUnitProgress.reduce((sum, unit) => sum + unit.totalLessons, 0),
    publishedItemCount: counts?.published ?? 0, uniquePublishedItemCount: counts?.unique_published ?? 0, a1ItemCount: counts?.a1 ?? 0, a2ItemCount: counts?.a2 ?? 0 };
  const now = new Date().toISOString();
  const due = await db.prepare("SELECT COUNT(*) AS count FROM pl_review_states WHERE profile_id = ? AND due_at <= ?").bind(currentProfileId, now).first<{ count: number }>();
  const learned = await db.prepare("SELECT COUNT(*) AS count FROM pl_review_states WHERE profile_id = ? AND status != 'new'").bind(currentProfileId).first<{ count: number }>();
  const mastered = await db.prepare("SELECT COUNT(*) AS count FROM pl_review_states WHERE profile_id = ? AND status = 'mastered'").bind(currentProfileId).first<{ count: number }>();
  const sessionRows = await db.prepare("SELECT s.id, s.lesson_id, l.title_ja AS lesson_title, s.mode, s.started_at, s.completed_at, s.duration_ms FROM pl_study_sessions s LEFT JOIN pl_lessons l ON l.id = s.lesson_id WHERE s.profile_id = ? ORDER BY s.started_at DESC LIMIT 200").bind(currentProfileId).all<SessionRow>();
  const sessions = sessionRows.results ?? [];
  const today = dateKeyInZone(new Date(), profile.study_timezone);
  const weekStart = shiftDateKey(today, -6);
  const sessionDays = new Set(sessions.filter((session) => session.completed_at).map((session) => dateKeyInZone(session.started_at, profile.study_timezone)));
  let streakDays = 0;
  for (let index = 0; sessionDays.has(shiftDateKey(today, -index)); index += 1) streakDays += 1;
  const weekSessions = sessions.filter((session) => session.completed_at && dateKeyInZone(session.started_at, profile.study_timezone) >= weekStart);
  const nextMission = await missionForLesson(db, nextEntry.row.id);
  if (!nextMission) throw new Error("mission_seed_missing");
  const nextCando = await db.prepare("SELECT ci.id, ci.unit_id FROM pl_cando_items ci LEFT JOIN pl_cando_progress cp ON cp.cando_id = ci.id AND cp.profile_id = ? WHERE ci.unit_id = ? AND COALESCE(cp.status, 'not_started') = 'not_started' ORDER BY ci.sort_order LIMIT 1").bind(currentProfileId, nextEntry.unit.id).first<{ id: string; unit_id: string }>();
  const recommendations: Recommendation[] = [];
  if ((due?.count ?? 0) > 0) recommendations.push({ kind: "review", title: "期限到来の復習", detail: `${due?.count ?? 0}件を先に思い出します。` });
  recommendations.push({ kind: "lesson", title: nextEntry.row.title_ja, detail: `${track.code}の次のlessonを進めます。`, lessonId: nextEntry.row.id, unitId: nextEntry.unit.id });
  if (nextMission) recommendations.push({ kind: "voice", title: "ChatGPT Voice mission", detail: "lesson後に会話し、ChatGPTの採点ファイルを同期します。", missionId: nextMission.id, lessonId: nextEntry.row.id });
  if (nextCando) recommendations.push({ kind: "cando", title: "Can-doを1つ確認", detail: "教材完了・想起成績とは別に、できることを記録します。", unitId: nextCando.unit_id });
  const unit = nextEntry.unit;
  return { profile: { id: profile.id, displayName: profile.display_name, studyTimezone: profile.study_timezone, dailyNewLimit: profile.daily_new_limit, dailyReviewLimit: profile.daily_review_limit },
    track: { id: track.id, code: track.code, title: track.title, cefr: track.cefr, contentVersion: track.content_version },
    unit: { id: unit.id, unitNumber: unit.unit_number, titleJa: unit.title_ja, titlePl: unit.title_pl, description: unit.description },
    units: unitProgress, allUnits: allUnitProgress, tracks, curriculum, nextLesson: lessonSummaryFromRow(nextEntry.row), nextMission,
    progress: { completedLessons: allLessons.filter((entry) => entry.row.completed === 1).length, totalLessons: allLessons.length,
      learnedItems: learned?.count ?? 0, masteredItems: mastered?.count ?? 0, dueReviews: due?.count ?? 0, streakDays,
      studyDaysThisWeek: new Set(weekSessions.map((session) => dateKeyInZone(session.started_at, profile.study_timezone))).size,
      minutesThisWeek: Math.round(weekSessions.reduce((total, session) => total + session.duration_ms, 0) / 60000) },
    recommendations,
    recentSessions: sessions.slice(0, 5).map((session) => ({ id: session.id, lessonTitle: session.lesson_title ?? (session.mode === "review" ? "復習" : "レッスン"), mode: session.mode, durationMs: session.duration_ms, completedAt: session.completed_at })) };
}

async function lessonResponse(db: D1Database, lessonId: string): Promise<Lesson> {
  const result = await db.prepare(
    "SELECT l.id AS lesson_id, l.unit_id, l.lesson_number, l.title_ja, l.title_pl, l.description, l.estimated_minutes, " +
    "ls.id AS step_id, ls.step_number, ls.kind, ls.prompt_ja, ls.explanation, ls.options_json, ls.question_type, ls.direction, ls.answer_text, ls.cloze_prefix, ls.cloze_suffix, ls.cloze_answer, ls.tokens_json, ls.scaffold_level, ls.hint_text, " +
    "i.id, i.type, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, i.cefr_level, i.skills_json, i.scene, i.register, i.speaker_gender, i.dialogue_role " +
    "FROM pl_lessons l JOIN pl_lesson_steps ls ON ls.lesson_id = l.id JOIN pl_learning_items i ON i.id = ls.item_id WHERE l.id = ? AND l.status = 'published' ORDER BY ls.step_number",
  ).bind(lessonId).all<StepRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) throw new Error("lesson_not_found");
  const mission = await missionForLesson(db, lessonId);
  return lessonFromRows(rows, mission);
}

async function missionForLesson(db: D1Database, lessonId: string): Promise<VoiceMission | null> {
  const row = await db.prepare("SELECT id, unit_id, lesson_id, title, scenario, learner_role, partner_role, objective, learner_item_ids_json, partner_item_ids_json, required_item_ids_json, partner_behavior, difficulty_level, ending_condition, feedback_format FROM pl_voice_missions WHERE lesson_id = ? AND status = 'published'").bind(lessonId).first<MissionRow>();
  return row ? missionFromRow(row, await publishedItems(db)) : null;
}

async function itemsResponse(db: D1Database, currentProfileId: string, url: URL): Promise<Array<LearningItem & { reviewState: ReviewState | null }>> {
  const search = url.searchParams.get("search")?.trim() ?? "";
  const type = url.searchParams.get("type") ?? "";
  const topic = url.searchParams.get("topic") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const clauses = ["i.status = 'published'"];
  const values: Array<string | number> = [];
  if (search) { clauses.push("(i.polish LIKE ? OR i.meaning_ja LIKE ? OR i.meaning_en LIKE ? OR i.tags_json LIKE ?)"); const pattern = "%" + search + "%"; values.push(pattern, pattern, pattern, pattern); }
  if (["word", "phrase", "sentence", "grammar"].includes(type)) { clauses.push("i.type = ?"); values.push(type); }
  if (topic) { clauses.push("i.topic = ?"); values.push(topic); }
  if (["new", "learning", "mastered", "difficult"].includes(state)) { clauses.push("COALESCE(rs.status, 'new') = ?"); values.push(state); }
  const result = await db.prepare(
    "SELECT i.id, i.type, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, i.cefr_level, i.skills_json, i.scene, i.register, i.speaker_gender, i.dialogue_role, " +
    "rs.item_id AS review_item_id, rs.due_at AS review_due_at, rs.interval_days AS review_interval_days, rs.ease_factor AS review_ease_factor, rs.repetitions AS review_repetitions, rs.lapses AS review_lapses, rs.last_rating AS review_last_rating, rs.last_attempt_at AS review_last_attempt_at, rs.status AS review_status, rs.difficulty_level AS review_difficulty_level, rs.success_streak AS review_success_streak, rs.failure_streak AS review_failure_streak, rs.last_question_type AS review_last_question_type, rs.last_direction AS review_last_direction " +
    "FROM pl_learning_items i LEFT JOIN pl_review_states rs ON rs.item_id = i.id AND rs.profile_id = ? WHERE " + clauses.join(" AND ") + " ORDER BY i.id",
  ).bind(currentProfileId, ...values).all<ItemReviewRow>();
  return (result.results ?? []).map((row) => ({ ...itemFromRow(row), reviewState: reviewFromJoinedRow(row) }));
}

async function dueResponse(db: D1Database, currentProfileId: string, limit: number): Promise<DueItem[]> {
  const result = await db.prepare(
    "SELECT i.id, i.type, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, i.cefr_level, i.skills_json, i.scene, i.register, i.speaker_gender, i.dialogue_role, " +
    "rs.item_id, rs.due_at, rs.interval_days, rs.ease_factor, rs.repetitions, rs.lapses, rs.last_rating, rs.last_attempt_at, rs.status, rs.difficulty_level, rs.success_streak, rs.failure_streak, rs.last_question_type, rs.last_direction " +
    "FROM pl_review_states rs JOIN pl_learning_items i ON i.id = rs.item_id WHERE rs.profile_id = ? AND rs.due_at <= ? AND i.status = 'published' ORDER BY rs.due_at LIMIT ?",
  ).bind(currentProfileId, new Date().toISOString(), Math.max(1, Math.min(limit, 50))).all<ItemRow & ReviewRow>();
  const allItems = await publishedItems(db);
  return (result.results ?? []).map((row) => {
    const item = itemFromRow(row);
    const state = reviewFromRow(row);
    const topicPeers = allItems.filter((candidate) => candidate.topic === item.topic);
    const distractorPool = topicPeers.length >= 4 ? topicPeers : allItems;
    return { ...item, reviewState: state, exercise: reviewExercise(item, state, distractorPool) };
  });
}

async function attemptById(db: D1Database, attemptId: string, currentProfileId: string): Promise<AttemptRow | null> {
  return db.prepare("SELECT id, item_id, answer, expected_answer, is_correct, verdict, rating, question_type, direction, difficulty_before, difficulty_after, elapsed_ms, created_at FROM pl_attempts WHERE id = ? AND profile_id = ?").bind(attemptId, currentProfileId).first<AttemptRow>();
}
async function resultFromAttempt(db: D1Database, attempt: AttemptRow, state: ReviewState | null): Promise<AttemptResult> {
  const item = await db.prepare("SELECT id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, cefr_level, skills_json, scene, register, speaker_gender, dialogue_role FROM pl_learning_items WHERE id = ?").bind(attempt.item_id).first<ItemRow>();
  return { attemptId: attempt.id, isCorrect: attempt.is_correct === 1, verdict: attempt.verdict, expectedAnswer: attempt.expected_answer,
    feedback: feedbackFor(attempt.verdict, item?.grammar_note ?? "", attempt.question_type), questionType: attempt.question_type,
    direction: attempt.direction, difficultyBefore: Math.max(0, Math.min(3, attempt.difficulty_before)) as DifficultyLevel,
    difficultyAfter: Math.max(0, Math.min(3, attempt.difficulty_after)) as DifficultyLevel,
    difficultyLabel: difficultyLabel(attempt.difficulty_after), reviewState: state };
}

async function attemptResponse(db: D1Database, currentProfileId: string, request: Request): Promise<AttemptResult> {
  const body = await readJson<{ itemId?: string; answer?: string; idempotencyKey?: string; sessionId?: string; lessonId?: string;
    stepId?: string; questionType?: QuestionType; direction?: PromptDirection; elapsedMs?: number; autoRate?: boolean }>(request);
  if (!body.itemId || typeof body.answer !== "string" || !body.idempotencyKey || !body.questionType || !body.direction) throw new Error("itemId、answer、idempotencyKey、questionType、directionが必要です。");
  if (!QUESTION_TYPES.includes(body.questionType) || !DIRECTIONS.includes(body.direction)) throw new Error("問題形式または出題方向が不正です。");
  if (body.answer.length > 1000) throw new Error("回答が長すぎます。");
  const previousAttempt = await db.prepare("SELECT id, item_id, answer, expected_answer, is_correct, verdict, rating, question_type, direction, difficulty_before, difficulty_after, elapsed_ms, created_at FROM pl_attempts WHERE idempotency_key = ?").bind(body.idempotencyKey).first<AttemptRow>();
  if (previousAttempt) return resultFromAttempt(db, previousAttempt, await getReviewState(db, currentProfileId, previousAttempt.item_id));
  const itemRow = await db.prepare("SELECT id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, cefr_level, skills_json, scene, register, speaker_gender, dialogue_role FROM pl_learning_items WHERE id = ? AND status = 'published'").bind(body.itemId).first<ItemRow>();
  if (!itemRow) throw new Error("learning_item_not_found");
  const item = itemFromRow(itemRow);
  let step: StepRow | null = null;
  if (body.stepId) {
    step = await db.prepare(
      "SELECT l.id AS lesson_id, l.unit_id, l.lesson_number, l.title_ja, l.title_pl, l.description, l.estimated_minutes, ls.id AS step_id, ls.step_number, ls.kind, ls.prompt_ja, ls.explanation, ls.options_json, ls.question_type, ls.direction, ls.answer_text, ls.cloze_prefix, ls.cloze_suffix, ls.cloze_answer, ls.tokens_json, ls.scaffold_level, ls.hint_text, i.id, i.type, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, i.cefr_level, i.skills_json, i.scene, i.register, i.speaker_gender, i.dialogue_role " +
      "FROM pl_lesson_steps ls JOIN pl_lessons l ON l.id = ls.lesson_id JOIN pl_learning_items i ON i.id = ls.item_id WHERE ls.id = ? AND i.id = ?",
    ).bind(body.stepId, body.itemId).first<StepRow>();
    if (!step) throw new Error("lesson_step_not_found");
  }
  const currentState = await getReviewState(db, currentProfileId, item.id);
  const questionType = step?.question_type ?? body.questionType;
  const direction = step?.direction ?? body.direction;
  if (step && (body.questionType !== step.question_type || body.direction !== step.direction)) throw new Error("問題形式または出題方向が一致しません。教材を再読み込みしてください。");
  if (!step && (questionType !== questionTypeForDifficulty(currentState?.difficultyLevel ?? 0)
    || direction !== directionForDifficulty(item.id, currentState?.difficultyLevel ?? 0))) throw new Error("復習の難易度が更新されました。もう一度キューを読み込んでください。");
  const grade = gradeTarget(body.answer, answerCandidates(item, questionType, direction, step), targetLanguage(questionType, direction));
  const difficultyBefore = currentState?.difficultyLevel ?? 0;
  const autoRating = body.autoRate ? ratingFromVerdict(grade.verdict) : null;
  const attemptId = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO pl_attempts (id, idempotency_key, profile_id, session_id, lesson_id, step_id, item_id, answer, expected_answer, is_correct, verdict, rating, elapsed_ms, question_type, direction, difficulty_before, difficulty_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(attemptId, body.idempotencyKey, currentProfileId, body.sessionId ?? null, body.lessonId ?? step?.lesson_id ?? null,
    body.stepId ?? null, item.id, body.answer, expectedAnswer(item, questionType, direction), grade.isCorrect ? 1 : 0, grade.verdict,
    autoRating, Math.max(0, Math.round(body.elapsedMs ?? 0)), questionType, direction, difficultyBefore, difficultyBefore, new Date().toISOString()).run();
  const reviewState = autoRating ? await applyReviewRating(db, currentProfileId, item.id, autoRating, grade.isCorrect, attemptId, questionType, direction) : currentState;
  const difficultyAfter = reviewState?.difficultyLevel ?? difficultyBefore;
  await db.prepare("UPDATE pl_attempts SET difficulty_after = ? WHERE id = ?").bind(difficultyAfter, attemptId).run();
  return { attemptId, isCorrect: grade.isCorrect, verdict: grade.verdict, expectedAnswer: expectedAnswer(item, questionType, direction),
    feedback: feedbackFor(grade.verdict, item.grammarNote, questionType), questionType, direction,
    difficultyBefore: difficultyBefore as DifficultyLevel, difficultyAfter: difficultyAfter as DifficultyLevel,
    difficultyLabel: difficultyLabel(difficultyAfter), reviewState };
}

async function rateReview(db: D1Database, currentProfileId: string, request: Request): Promise<AttemptResult> {
  const body = await readJson<{ itemId?: string; rating?: ReviewRating; attemptId?: string; questionType?: QuestionType; direction?: PromptDirection }>(request);
  if (!body.itemId || !body.rating || !body.attemptId || !body.questionType || !body.direction || !RATINGS.includes(body.rating)) throw new Error("itemId、rating、attemptId、questionType、directionが必要です。");
  const attempt = await attemptById(db, body.attemptId, currentProfileId);
  if (!attempt || attempt.item_id !== body.itemId) throw new Error("attempt_not_found");
  if (attempt.question_type !== body.questionType || attempt.direction !== body.direction) throw new Error("回答形式または出題方向が一致しません。");
  const state = await applyReviewRating(db, currentProfileId, body.itemId, body.rating, attempt.is_correct === 1, attempt.id, body.questionType, body.direction);
  await db.prepare("UPDATE pl_attempts SET rating = ?, difficulty_after = ? WHERE id = ?").bind(body.rating, state.difficultyLevel, attempt.id).run();
  return resultFromAttempt(db, { ...attempt, rating: body.rating, difficulty_after: state.difficultyLevel }, state);
}

async function mistakesResponse(db: D1Database, currentProfileId: string): Promise<MistakeSummary[]> {
  const result = await db.prepare("SELECT i.tags_json, i.polish, COUNT(*) AS count FROM pl_attempts a JOIN pl_learning_items i ON i.id = a.item_id WHERE a.profile_id = ? AND a.is_correct = 0 GROUP BY a.item_id ORDER BY count DESC LIMIT 50").bind(currentProfileId).all<{ tags_json: string; polish: string; count: number }>();
  const grouped = new Map<string, MistakeSummary>();
  for (const row of result.results ?? []) for (const tag of parseArray(row.tags_json).filter((entry) => entry.startsWith("grammar:") || entry.startsWith("skill:"))) {
    const current = grouped.get(tag) ?? { tag, count: 0, examples: [] };
    current.count += row.count;
    if (!current.examples.includes(row.polish) && current.examples.length < 3) current.examples.push(row.polish);
    grouped.set(tag, current);
  }
  return [...grouped.values()].sort((left, right) => right.count - left.count);
}
async function historyResponse(db: D1Database, currentProfileId: string, limit: number): Promise<unknown[]> {
  const result = await db.prepare("SELECT a.id, a.item_id AS itemId, i.polish, i.meaning_ja AS meaningJa, a.question_type AS questionType, a.direction, a.verdict, a.rating, a.is_correct AS isCorrect, a.elapsed_ms AS elapsedMs, a.created_at AS createdAt, a.difficulty_before AS difficultyBefore, a.difficulty_after AS difficultyAfter FROM pl_attempts a JOIN pl_learning_items i ON i.id = a.item_id WHERE a.profile_id = ? ORDER BY a.created_at DESC LIMIT ?").bind(currentProfileId, Math.max(1, Math.min(100, limit))).all();
  return result.results ?? [];
}
async function missionResponse(db: D1Database, lessonId: string | null, missionId: string | null): Promise<VoiceMission> {
  if (lessonId) {
    const mission = await missionForLesson(db, lessonId);
    if (!mission) throw new Error("mission_not_found");
    return mission;
  }
  const row = await db.prepare("SELECT id, unit_id, lesson_id, title, scenario, learner_role, partner_role, objective, learner_item_ids_json, partner_item_ids_json, required_item_ids_json, partner_behavior, difficulty_level, ending_condition, feedback_format FROM pl_voice_missions WHERE id = ? AND status = 'published'").bind(missionId).first<MissionRow>();
  if (!row) throw new Error("mission_not_found");
  return missionFromRow(row, await publishedItems(db));
}
async function voiceResultsResponse(db: D1Database, currentProfileId: string, limit: number): Promise<VoiceResult[]> {
  const result = await db.prepare("SELECT " + VOICE_RESULT_COLUMNS + " FROM pl_voice_attempts WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?").bind(currentProfileId, Math.max(1, Math.min(100, limit))).all<VoiceAttemptRow>();
  return (result.results ?? []).map(voiceResultFromRow);
}
async function saveVoiceResult(db: D1Database, currentProfileId: string, request: Request): Promise<VoiceResult> {
  const body = await readJson<{ missionId?: string; sessionId?: string; idempotencyKey?: string; heard?: boolean; replied?: boolean; askedBack?: boolean; needsRestatement?: boolean; confidence?: number; notes?: string }>(request);
  if (!body.missionId || !body.idempotencyKey || typeof body.heard !== "boolean" || typeof body.replied !== "boolean" || typeof body.askedBack !== "boolean" || typeof body.needsRestatement !== "boolean" || !Number.isInteger(body.confidence) || (body.confidence ?? 0) < 1 || (body.confidence ?? 0) > 5) throw new Error("missionId、idempotencyKey、4つの自己評価、confidence(1-5)が必要です。");
  const mission = await db.prepare("SELECT id FROM pl_voice_missions WHERE id = ? AND status = 'published'").bind(body.missionId).first<{ id: string }>();
  if (!mission) throw new Error("mission_not_found");
  if ((body.notes ?? "").length > 2000) throw new Error("メモが長すぎます。");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO pl_voice_attempts (id, idempotency_key, profile_id, mission_id, session_id, heard, replied, asked_back, rephrased, confidence, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, body.idempotencyKey, currentProfileId, body.missionId, body.sessionId ?? null, body.heard ? 1 : 0, body.replied ? 1 : 0, body.askedBack ? 1 : 0, body.needsRestatement ? 1 : 0, body.confidence, body.notes ?? "", now, now).run();
  const saved = await db.prepare("SELECT " + VOICE_RESULT_COLUMNS + " FROM pl_voice_attempts WHERE idempotency_key = ? AND profile_id = ?").bind(body.idempotencyKey, currentProfileId).first<VoiceAttemptRow>();
  if (!saved) throw new Error("voice_result_not_saved");
  return voiceResultFromRow(saved);
}

async function importVoiceResult(db: D1Database, currentProfileId: string, request: Request): Promise<VoiceResult> {
  const body = await readJson<VoiceResultImport>(request);
  validateVoiceResultImport(body);
  const mission = await db.prepare("SELECT id, lesson_id FROM pl_voice_missions WHERE id = ? AND status = 'published'").bind(body.missionId).first<{ id: string; lesson_id: string }>();
  if (!mission || mission.lesson_id !== body.lessonId) throw new Error("採点ファイルのmissionIdまたはlessonIdが現在の教材と一致しません。");
  const overallScore = Number((VOICE_SCORE_KEYS.reduce((sum, key) => sum + body.scores[key], 0) / VOICE_SCORE_KEYS.length).toFixed(1));
  const feedback: VoiceImportedFeedback = { summary: body.summary, strengths: body.strengths, corrections: body.corrections, nextStep: body.nextStep };
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO pl_voice_attempts (id, idempotency_key, profile_id, mission_id, session_id, heard, replied, asked_back, rephrased, confidence, notes, created_at, updated_at, source_kind, external_result_id, schema_version, evaluated_at, overall_score, scores_json, feedback_json, raw_result_json) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'chatgpt_file', ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), "chatgpt-file:" + body.resultId, currentProfileId, body.missionId,
      body.evidence.understoodPartner ? 1 : 0, body.evidence.respondedToPartner ? 1 : 0, body.evidence.usedRepairStrategy ? 1 : 0,
      body.evidence.neededRestatement ? 1 : 0, Math.max(1, Math.min(5, Math.round(overallScore))), body.summary, now, now,
      body.resultId, body.schemaVersion, body.evaluatedAt, overallScore, JSON.stringify(body.scores), JSON.stringify(feedback), JSON.stringify(body)).run();
  const saved = await db.prepare("SELECT " + VOICE_RESULT_COLUMNS + " FROM pl_voice_attempts WHERE profile_id = ? AND external_result_id = ?").bind(currentProfileId, body.resultId).first<VoiceAttemptRow>();
  if (!saved) throw new Error("採点結果を同期できませんでした。");
  return voiceResultFromRow(saved);
}
async function canDoResponse(db: D1Database, currentProfileId: string, unitId: string): Promise<CanDoUnit> {
  const unitRow = await db.prepare("SELECT u.id, u.track_id, t.code AS track_code, u.cefr_level, u.unit_number, u.title_ja, u.title_pl, u.description FROM pl_units u JOIN pl_tracks t ON t.id = u.track_id WHERE u.id = ? AND u.status = 'published'").bind(unitId).first<UnitRow>();
  if (!unitRow) throw new Error("unit_not_found");
  const { progress: unit } = await unitProgressResponse(db, currentProfileId, unitRow);
  const rows = await db.prepare("SELECT ci.id, ci.unit_id, ci.code, ci.cefr_level, ci.skill, ci.statement_ja, ci.statement_pl, ci.evidence_rule, cp.status, cp.self_rating, cp.evidence_notes, cp.updated_at FROM pl_cando_items ci LEFT JOIN pl_cando_progress cp ON cp.cando_id = ci.id AND cp.profile_id = ? WHERE ci.unit_id = ? ORDER BY ci.sort_order").bind(currentProfileId, unitId).all<CanDoRow>();
  const recall = await db.prepare("SELECT AVG(a.is_correct) * 100 AS accuracy FROM pl_attempts a JOIN pl_lesson_steps ls ON ls.item_id = a.item_id JOIN pl_lessons l ON l.id = ls.lesson_id WHERE a.profile_id = ? AND l.unit_id = ?").bind(currentProfileId, unitId).first<{ accuracy: number | null }>();
  const voice = await db.prepare("SELECT AVG(CASE WHEN v.source_kind = 'chatgpt_file' THEN v.overall_score ELSE v.confidence END) AS confidence, COUNT(*) AS count FROM pl_voice_attempts v JOIN pl_voice_missions m ON m.id = v.mission_id WHERE v.profile_id = ? AND m.unit_id = ?").bind(currentProfileId, unitId).first<{ confidence: number | null; count: number }>();
  const items = (rows.results ?? []).map(canDoFromRow);
  const completed = items.filter((item) => item.status === "self_assessed" || item.status === "evidenced").length;
  return { unit, items, completionPercent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
    recallAccuracy: recall?.accuracy === null || recall?.accuracy === undefined ? null : Math.round(recall.accuracy),
    voiceAverageConfidence: voice?.confidence === null || voice?.confidence === undefined ? null : Number(voice.confidence.toFixed(1)), voiceResultsCount: voice?.count ?? 0 };
}
async function updateCanDo(db: D1Database, currentProfileId: string, request: Request): Promise<CanDoItem> {
  const body = await readJson<{ candoId?: string; status?: CanDoStatus; selfRating?: number | null; evidenceNotes?: string }>(request);
  const statuses: CanDoStatus[] = ["not_started", "practicing", "self_assessed", "evidenced"];
  if (!body.candoId || !body.status || !statuses.includes(body.status)) throw new Error("candoIdとstatusが必要です。");
  if (body.selfRating !== null && body.selfRating !== undefined && (!Number.isInteger(body.selfRating) || body.selfRating < 1 || body.selfRating > 5)) throw new Error("selfRatingは1から5です。");
  if ((body.evidenceNotes ?? "").length > 2000) throw new Error("Can-doメモが長すぎます。");
  const exists = await db.prepare("SELECT id FROM pl_cando_items WHERE id = ?").bind(body.candoId).first<{ id: string }>();
  if (!exists) throw new Error("cando_not_found");
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO pl_cando_progress (profile_id, cando_id, status, self_rating, evidence_notes, last_mission_attempt_id, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(profile_id, cando_id) DO UPDATE SET status = excluded.status, self_rating = excluded.self_rating, evidence_notes = excluded.evidence_notes, updated_at = excluded.updated_at")
    .bind(currentProfileId, body.candoId, body.status, body.selfRating ?? null, body.evidenceNotes ?? "", now).run();
  const row = await db.prepare("SELECT ci.id, ci.unit_id, ci.code, ci.cefr_level, ci.skill, ci.statement_ja, ci.statement_pl, ci.evidence_rule, cp.status, cp.self_rating, cp.evidence_notes, cp.updated_at FROM pl_cando_items ci LEFT JOIN pl_cando_progress cp ON cp.cando_id = ci.id AND cp.profile_id = ? WHERE ci.id = ?").bind(currentProfileId, body.candoId).first<CanDoRow>();
  if (!row) throw new Error("cando_not_found");
  return canDoFromRow(row);
}
function csvCell(value: unknown): string { const text = value === null || value === undefined ? "" : String(value); return "\"" + text.replace(/"/gu, "\"\"") + "\""; }
async function exportResponse(db: D1Database, currentProfileId: string, format: string): Promise<Response> {
  const tableNames = ["pl_profiles", "pl_study_sessions", "pl_attempts", "pl_review_states", "pl_review_events", "pl_chatgpt_prompts", "pl_voice_attempts", "pl_cando_progress"];
  const data: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of tableNames) {
    const query = table === "pl_profiles" ? "SELECT * FROM pl_profiles WHERE id = ?" : "SELECT * FROM " + table + " WHERE profile_id = ?";
    const result = await db.prepare(query).bind(currentProfileId).all<Record<string, unknown>>();
    data[table] = result.results ?? [];
  }
  const exportedAt = new Date().toISOString();
  if (format === "csv") {
    const headers = ["record_type", "id", "item_id", "mission_id", "answer", "expected_answer", "is_correct", "verdict", "rating", "question_type", "direction", "heard", "replied", "asked_back", "needs_restatement", "confidence", "source_kind", "external_result_id", "schema_version", "evaluated_at", "overall_score", "scores_json", "feedback_json", "notes", "created_at"];
    const rows = [
      ...data.pl_attempts.map((row) => headers.map((header) => csvCell({ record_type: "attempt", ...row }[header])).join(",")),
      ...data.pl_voice_attempts.map((row) => headers.map((header) => csvCell({ record_type: "voice_result", needs_restatement: row.rephrased, ...row }[header])).join(",")),
      ...data.pl_cando_progress.map((row) => headers.map((header) => csvCell({ record_type: "cando", notes: row.evidence_notes, ...row }[header])).join(",")),
    ];
    return textResponse([headers.join(","), ...rows].join("\n"), "text/csv; charset=utf-8", { headers: { "content-disposition": "attachment; filename=\"polski-loop-export-" + exportedAt.slice(0, 10) + ".csv\"" } });
  }
  return jsonResponse({ exportedAt, profileId: currentProfileId, contentVersion: CONTENT_VERSION, data }, { headers: { "content-disposition": "attachment; filename=\"polski-loop-export-" + exportedAt.slice(0, 10) + ".json\"" } });
}
async function createItem(db: D1Database, request: Request): Promise<LearningItem> {
  const body = await readJson<Partial<LearningItem> & { id?: string }>(request);
  if (!body.polish || !body.meaningJa || !body.type || !body.acceptedAnswers?.length) throw new Error("教材候補にはpolish、meaningJa、type、acceptedAnswersが必要です。");
  if (!["word", "phrase", "sentence", "grammar"].includes(body.type)) throw new Error("typeが不正です。");
  const item: LearningItem = { id: body.id || "draft-" + crypto.randomUUID(), type: body.type, polish: body.polish, meaningJa: body.meaningJa,
    meaningEn: body.meaningEn ?? "", grammarNote: body.grammarNote ?? "", topic: body.topic ?? "general",
    tags: body.tags ?? ["cefr:a1"], acceptedAnswers: body.acceptedAnswers, contentVersion: body.contentVersion ?? "draft-" + new Date().toISOString().slice(0, 10) };
  await db.prepare("INSERT INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)")
    .bind(item.id, item.type, item.polish, item.meaningJa, item.meaningEn, item.grammarNote, item.topic, JSON.stringify(item.tags), JSON.stringify(item.acceptedAnswers), item.contentVersion, new Date().toISOString()).run();
  return item;
}

async function apiFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1/, "") || "/";
  const currentProfileId = profileId(env);
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method === "GET" && path === "/status") {
    const requestedTrack: TrackCode = url.searchParams.get("track") === "A2" ? "A2" : "A1";
    return jsonResponse(await statusResponse(env.DB, currentProfileId, requestedTrack));
  }
  if (request.method === "GET" && path.startsWith("/lessons/")) return jsonResponse(await lessonResponse(env.DB, path.slice("/lessons/".length)));
  if (request.method === "GET" && path === "/missions") return jsonResponse(await missionResponse(env.DB, url.searchParams.get("lessonId"), url.searchParams.get("missionId")));
  if (request.method === "GET" && path === "/cando") {
    const unitId = url.searchParams.get("unitId");
    if (!unitId) throw new Error("unitIdが必要です。");
    return jsonResponse(await canDoResponse(env.DB, currentProfileId, unitId));
  }
  if (request.method === "GET" && path === "/items") return jsonResponse(await itemsResponse(env.DB, currentProfileId, url));
  if (request.method === "GET" && path === "/reviews/due") return jsonResponse(await dueResponse(env.DB, currentProfileId, Number(url.searchParams.get("limit") ?? "15")));
  if (request.method === "GET" && path === "/mistakes") return jsonResponse(await mistakesResponse(env.DB, currentProfileId));
  if (request.method === "GET" && path === "/history") return jsonResponse(await historyResponse(env.DB, currentProfileId, Number(url.searchParams.get("limit") ?? "30")));
  if (request.method === "GET" && path === "/voice-results") return jsonResponse(await voiceResultsResponse(env.DB, currentProfileId, Number(url.searchParams.get("limit") ?? "30")));
  if (request.method === "GET" && path === "/sessions") {
    const result = await env.DB.prepare("SELECT s.id, s.lesson_id, l.title_ja AS lesson_title, s.mode, s.started_at, s.completed_at, s.duration_ms FROM pl_study_sessions s LEFT JOIN pl_lessons l ON l.id = s.lesson_id WHERE s.profile_id = ? ORDER BY s.started_at DESC LIMIT 100").bind(currentProfileId).all<SessionRow>();
    return jsonResponse(result.results ?? []);
  }
  if (request.method === "GET" && path === "/export") return exportResponse(env.DB, currentProfileId, url.searchParams.get("format") ?? "json");
  if (request.method === "POST" && path === "/sessions") {
    const body = await readJson<{ mode?: "lesson" | "review"; lessonId?: string; idempotencyKey?: string }>(request);
    if (!body.mode || !["lesson", "review"].includes(body.mode)) throw new Error("modeが必要です。");
    if (!body.idempotencyKey) throw new Error("idempotencyKeyが必要です。");
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT OR IGNORE INTO pl_study_sessions (id, idempotency_key, profile_id, lesson_id, mode, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), body.idempotencyKey, currentProfileId, body.lessonId ?? null, body.mode, now, now).run();
    const session = await env.DB.prepare("SELECT id, started_at FROM pl_study_sessions WHERE profile_id = ? AND idempotency_key = ?").bind(currentProfileId, body.idempotencyKey).first<{ id: string; started_at: string }>();
    if (!session) throw new Error("学習セッションを開始できませんでした。");
    return jsonResponse({ id: session.id, startedAt: session.started_at });
  }
  if (request.method === "PATCH" && path.startsWith("/sessions/")) {
    const sessionId = path.slice("/sessions/".length);
    const body = await readJson<{ completed?: boolean; durationMs?: number }>(request);
    if (body.completed !== true) throw new Error("completed=trueが必要です。");
    await env.DB.prepare("UPDATE pl_study_sessions SET completed_at = ?, duration_ms = ? WHERE id = ? AND profile_id = ?").bind(new Date().toISOString(), Math.max(0, Math.round(body.durationMs ?? 0)), sessionId, currentProfileId).run();
    return jsonResponse({ ok: true });
  }
  if (request.method === "POST" && path === "/attempts") return jsonResponse(await attemptResponse(env.DB, currentProfileId, request));
  if (request.method === "POST" && path === "/reviews/rate") return jsonResponse(await rateReview(env.DB, currentProfileId, request));
  if (request.method === "POST" && path === "/voice-results") return jsonResponse(await saveVoiceResult(env.DB, currentProfileId, request), { status: 201 });
  if (request.method === "POST" && path === "/voice-results/import") return jsonResponse(await importVoiceResult(env.DB, currentProfileId, request), { status: 201 });
  if (request.method === "POST" && path === "/cando") return jsonResponse(await updateCanDo(env.DB, currentProfileId, request));
  if (request.method === "POST" && path === "/prompts") {
    const body = await readJson<{ topic?: string; prompt?: string; missionId?: string }>(request);
    if (!body.topic || !body.prompt) throw new Error("topicとpromptが必要です。");
    await env.DB.prepare("INSERT INTO pl_chatgpt_prompts (id, profile_id, topic, prompt_text, copied_at, mission_id) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), currentProfileId, body.topic, body.prompt, new Date().toISOString(), body.missionId ?? null).run();
    return jsonResponse({ ok: true });
  }
  if (request.method === "POST" && path === "/items") return jsonResponse(await createItem(env.DB, request), { status: 201 });
  if (request.method === "POST" && path === "/content/import") {
    const body = await readJson<{ version?: string; trackId?: string; notes?: string; items?: Array<Partial<LearningItem>> }>(request);
    if (!body.version || !body.trackId || !Array.isArray(body.items)) throw new Error("version、trackId、itemsが必要です。");
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO pl_content_versions (version, track_id, status, notes, created_at) VALUES (?, ?, 'draft', ?, ?)").bind(body.version, body.trackId, body.notes ?? "Codex import draft", now).run();
    let imported = 0;
    for (const candidate of body.items) {
      if (!candidate.polish || !candidate.meaningJa || !candidate.type || !candidate.acceptedAnswers?.length) continue;
      await env.DB.prepare("INSERT OR IGNORE INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)")
        .bind(candidate.id ?? "draft-" + crypto.randomUUID(), candidate.type, candidate.polish, candidate.meaningJa, candidate.meaningEn ?? "", candidate.grammarNote ?? "", candidate.topic ?? "general", JSON.stringify(candidate.tags ?? ["cefr:a1"]), JSON.stringify(candidate.acceptedAnswers), body.version, now).run();
      imported += 1;
    }
    return jsonResponse({ version: body.version, imported, status: "draft" }, { status: 201 });
  }
  return errorResponse(404, "API endpointが見つかりません。");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const accessError = await verifyAccess(request, env);
    if (accessError) return accessError;
    try { return await apiFetch(request, env); }
    catch (error) {
      const message = error instanceof Error ? error.message : "予期しないエラーが発生しました。";
      if (message === "seed_data_missing" || message === "lesson_seed_missing" || message === "mission_seed_missing") return errorResponse(500, "D1の初期データが不足しています。npm run db:migrateを実行してください。");
      if (message === "lesson_not_found" || message === "lesson_step_not_found" || message === "learning_item_not_found" || message === "attempt_not_found" || message === "mission_not_found" || message === "unit_not_found" || message === "cando_not_found") return errorResponse(404, "指定された教材、mission、Can-do、または履歴が見つかりません。");
      return errorResponse(400, message);
    }
  },
};
