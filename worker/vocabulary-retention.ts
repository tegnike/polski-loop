import type {
  VocabularyRetentionStage, VocabularyRetentionSummary, VocabularyRetentionWord, VocabularyTestAnswerResponse,
  VocabularyTestAttempt, VocabularyTestMode, VocabularyTestQuestion, VocabularyTestStartResponse,
} from "../src/lib/types";

export class VocabularyRetentionError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const DAY_MS = 86_400_000;
const STAGE_DAYS = [1, 3, 7, 30] as const;
const VISIBLE = "i.status = 'published' AND i.type = 'word' AND (d.owner_profile_id IS NULL OR d.owner_profile_id = ?)";
const LEARNED_FROM = " FROM pl_learning_items i JOIN pl_vocabulary_details d ON d.item_id = i.id JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = ? LEFT JOIN pl_vocabulary_retention_states r ON r.item_id = i.id AND r.profile_id = s.profile_id";
const ATTEMPT_FROM = " FROM pl_vocabulary_test_attempts a JOIN pl_learning_items i ON i.id = a.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id WHERE a.profile_id = ? AND " + VISIBLE;

interface RetentionRow {
  id: string; polish: string; meaning_ja: string; accepted_answers_json: string; sort_order: number;
  self_updated_at: string; stage: VocabularyRetentionStage | null; next_test_at: string | null; last_test_at: string | null;
  last_correct: number | null; last_gap_days: number | null; total_attempts: number | null; revision: number | null;
}
interface ChallengeRow {
  id: string; item_id: string; prompt_ja: string; correct_polish: string; accepted_answers_json: string;
  required_days: number; due_at: string; eligible_for_retention: number; created_at: string; expires_at: string;
}
interface AttemptRow {
  id: string; item_id: string; question_id: string; request_fingerprint: string; answer: string;
  correct_polish: string; prompt_ja: string; accepted_answers_json: string; is_correct: number; tested_at: string;
  gap_days: number; required_days: number; counts_for_retention: number; stage_before: VocabularyRetentionStage;
  stage_after: VocabularyRetentionStage; next_test_at: string;
}
interface StartRow { id: string; mode: VocabularyTestMode; request_fingerprint: string }

export function normalizeVocabularyTestAnswer(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL");
}
function acceptedAnswers(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((answer): answer is string => typeof answer === "string" && Boolean(answer.trim())) : [];
  } catch { return []; }
}
function baseline(row: RetentionRow): string {
  return row.last_test_at && row.last_test_at > row.self_updated_at ? row.last_test_at : row.self_updated_at;
}
function retentionWord(row: RetentionRow): VocabularyRetentionWord {
  const stage = row.stage ?? 0;
  const requiredDays = STAGE_DAYS[stage];
  return { wordId: row.id, polish: row.polish, meaningJa: row.meaning_ja, stage, requiredDays,
    nextTestAt: new Date(Date.parse(baseline(row)) + requiredDays * DAY_MS).toISOString(),
    lastTestAt: row.last_test_at, lastCorrect: row.last_correct === null ? null : Boolean(row.last_correct),
    lastGapDays: row.last_gap_days, totalAttempts: row.total_attempts ?? 0 };
}
function attempt(row: AttemptRow): VocabularyTestAttempt {
  return { id: row.id, wordId: row.item_id, polish: row.correct_polish, meaningJa: row.prompt_ja,
    answer: row.answer, isCorrect: Boolean(row.is_correct), testedAt: row.tested_at, gapDays: row.gap_days,
    requiredDays: row.required_days, countsForRetention: Boolean(row.counts_for_retention),
    stageBefore: row.stage_before, stageAfter: row.stage_after, nextTestAt: row.next_test_at };
}
function answerResponse(row: AttemptRow): VocabularyTestAnswerResponse {
  return { attempt: attempt(row), correctPolish: row.correct_polish, meaningJa: row.prompt_ja, acceptedAnswers: acceptedAnswers(row.accepted_answers_json) };
}
function question(row: ChallengeRow): VocabularyTestQuestion {
  return { id: row.id, promptJa: row.prompt_ja, requiredDays: row.required_days,
    dueAt: row.due_at, eligibleForRetention: Boolean(row.eligible_for_retention), createdAt: row.created_at };
}
async function learnedWords(db: D1Database, profile: string): Promise<RetentionRow[]> {
  const rows = await db.prepare("SELECT i.id, i.polish, i.meaning_ja, i.accepted_answers_json, d.sort_order, s.updated_at AS self_updated_at, r.stage, r.next_test_at, r.last_test_at, r.last_correct, r.last_gap_days, r.total_attempts, r.revision" + LEARNED_FROM + " WHERE " + VISIBLE)
    .bind(profile, profile).all<RetentionRow>();
  return rows.results ?? [];
}
async function requestBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new VocabularyRetentionError("JSON形式のリクエストが必要です。"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new VocabularyRetentionError("JSONオブジェクトを指定してください。");
  return body as Record<string, unknown>;
}
function textInput(body: Record<string, unknown>, name: string, max: number, empty = false): string {
  const value = body[name];
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw new VocabularyRetentionError(`${name}は${max}文字以内で指定してください。`);
  }
  return value.normalize("NFKC").trim();
}

export async function vocabularyRetentionSummary(db: D1Database, profile: string, now = new Date()): Promise<VocabularyRetentionSummary> {
  const [rows, recent] = await Promise.all([
    learnedWords(db, profile),
    db.prepare("SELECT a.*" + ATTEMPT_FROM + " AND a.tested_at <= ? ORDER BY a.tested_at DESC, a.id DESC LIMIT 20")
      .bind(profile, profile, now.toISOString()).all<AttemptRow>(),
  ]);
  const words = rows.map(retentionWord).sort((left, right) => left.nextTestAt.localeCompare(right.nextTestAt) || left.wordId.localeCompare(right.wordId));
  return { due: words.filter((word) => word.nextTestAt <= now.toISOString()).length,
    totalTested: words.filter((word) => word.totalAttempts > 0).length,
    confirmed1: words.filter((word) => word.stage >= 1).length, confirmed3: words.filter((word) => word.stage >= 2).length,
    confirmed7: words.filter((word) => word.stage >= 3).length, recheck: words.filter((word) => word.lastCorrect === false).length,
    words, recentTests: (recent.results ?? []).map(attempt) };
}

async function findStart(db: D1Database, profile: string, key: string): Promise<StartRow | null> {
  return db.prepare("SELECT id, mode, request_fingerprint FROM pl_vocabulary_test_starts WHERE profile_id = ? AND idempotency_key = ?")
    .bind(profile, key).first<StartRow>();
}
async function startResponse(db: D1Database, profile: string, start: StartRow): Promise<VocabularyTestStartResponse> {
  const rows = await db.prepare("SELECT c.* FROM pl_vocabulary_test_challenges c JOIN pl_learning_items i ON i.id = c.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = c.profile_id WHERE c.start_id = ? AND c.profile_id = ? AND " + VISIBLE + " ORDER BY c.position")
    .bind(start.id, profile, profile).all<ChallengeRow>();
  return { mode: start.mode, questions: (rows.results ?? []).map(question) };
}

export async function startVocabularyTest(db: D1Database, profile: string, request: Request, now = new Date()): Promise<VocabularyTestStartResponse> {
  const body = await requestBody(request);
  if (body.mode !== "due" && body.mode !== "practice") throw new VocabularyRetentionError("modeはdueまたはpracticeで指定してください。");
  const mode = body.mode;
  const key = textInput(body, "idempotencyKey", 160);
  const wordId = body.wordId === undefined ? null : textInput(body, "wordId", 160);
  const limit = body.limit ?? 5;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 5) throw new VocabularyRetentionError("limitは1〜5の整数で指定してください。");
  const fingerprint = JSON.stringify({ mode, wordId, limit });
  const existing = await findStart(db, profile, key);
  if (existing) {
    if (existing.request_fingerprint !== fingerprint) throw new VocabularyRetentionError("同じ操作キーで異なるテストは開始できません。", 409);
    return startResponse(db, profile, existing);
  }
  const rows = await learnedWords(db, profile);
  if (wordId && !rows.some((row) => row.id === wordId)) throw new VocabularyRetentionError("学習済みの単語が見つかりません。", 404);
  const candidates = rows.filter((row) => !wordId || row.id === wordId)
    .map((row) => ({ row, word: retentionWord(row) }))
    .filter(({ row, word }) => row.meaning_ja.trim() && acceptedAnswers(row.accepted_answers_json).length && (mode === "practice" || word.nextTestAt <= now.toISOString()))
    .sort((left, right) => left.word.nextTestAt.localeCompare(right.word.nextTestAt) || left.row.sort_order - right.row.sort_order || left.row.id.localeCompare(right.row.id))
    .slice(0, limit);
  const startId = crypto.randomUUID();
  const timestamp = now.toISOString();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO pl_vocabulary_test_starts (id, profile_id, idempotency_key, request_fingerprint, mode, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(startId, profile, key, fingerprint, mode, timestamp),
    ...candidates.map(({ row, word }, position) => db.prepare("INSERT INTO pl_vocabulary_test_challenges (id, start_id, profile_id, item_id, position, prompt_ja, correct_polish, accepted_answers_json, stage_before, required_days, due_at, baseline_at, self_review_updated_at, retention_revision, eligible_for_retention, created_at, expires_at) SELECT ?, t.id, t.profile_id, i.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM pl_vocabulary_test_starts t JOIN pl_learning_items i ON i.id = ? JOIN pl_vocabulary_details d ON d.item_id = i.id JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = t.profile_id WHERE t.id = ? AND t.profile_id = ? AND " + VISIBLE)
      .bind(crypto.randomUUID(), position, row.meaning_ja, row.polish, row.accepted_answers_json, word.stage, word.requiredDays, word.nextTestAt, baseline(row), row.self_updated_at, row.revision ?? 0, Number(mode === "due" && word.nextTestAt <= timestamp), timestamp, expiresAt, row.id, startId, profile, profile)),
  ]);
  const saved = await findStart(db, profile, key);
  if (!saved || saved.request_fingerprint !== fingerprint) throw new VocabularyRetentionError("同じ操作キーで異なるテストは開始できません。", 409);
  return startResponse(db, profile, saved);
}

async function findAttempt(db: D1Database, profile: string, clause: string, value: string): Promise<AttemptRow | null> {
  return db.prepare("SELECT a.*" + ATTEMPT_FROM + " AND " + clause).bind(profile, profile, value).first<AttemptRow>();
}

// All current scheduling reads occur inside the same transaction as the attempt and state write.
// A challenge revision/anchor match permits one advance, even when different challenges race.
const SAVE_ANSWER = `
WITH input AS (SELECT ? AS event_id, ? AS profile_id, ? AS question_id, ? AS idempotency_key,
  ? AS answer, ? AS request_fingerprint, ? AS is_correct, ? AS elapsed_ms, ? AS tested_at),
current AS (
  SELECT input.*, c.item_id, c.correct_polish, c.prompt_ja, c.accepted_answers_json,
    c.eligible_for_retention, c.stage_before AS challenge_stage, c.retention_revision AS challenge_revision,
    c.self_review_updated_at AS challenge_self_updated_at, c.baseline_at AS challenge_baseline, c.due_at AS challenge_due,
    s.updated_at AS self_updated_at, COALESCE(r.stage, 0) AS stage_before, COALESCE(r.revision, 0) AS revision_before,
    CASE WHEN s.updated_at > COALESCE(r.last_test_at, s.updated_at) THEN s.updated_at ELSE COALESCE(r.last_test_at, s.updated_at) END AS baseline_at
  FROM input JOIN pl_vocabulary_test_challenges c ON c.id = input.question_id AND c.profile_id = input.profile_id
  JOIN pl_learning_items i ON i.id = c.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id
  JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = input.profile_id
  LEFT JOIN pl_vocabulary_retention_states r ON r.item_id = i.id AND r.profile_id = input.profile_id
  WHERE i.status = 'published' AND i.type = 'word' AND (d.owner_profile_id IS NULL OR d.owner_profile_id = input.profile_id)
    AND c.expires_at > input.tested_at
), scheduling AS (
  SELECT *, CASE stage_before WHEN 0 THEN 1 WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 30 END AS required_days,
    MAX(0, julianday(tested_at) - julianday(baseline_at)) AS gap_days FROM current
), graded AS (
  SELECT *, CASE WHEN is_correct = 1 AND eligible_for_retention = 1 AND challenge_stage = stage_before
    AND challenge_revision = revision_before AND challenge_self_updated_at = self_updated_at
    AND challenge_baseline = baseline_at AND challenge_due <= tested_at
    AND strftime('%Y-%m-%dT%H:%M:%fZ', baseline_at, '+' || (required_days * 86400) || ' seconds') <= tested_at
    THEN 1 ELSE 0 END AS counts_for_retention FROM scheduling
), outcome AS (
  SELECT *, CASE WHEN is_correct = 0 THEN 0 WHEN counts_for_retention = 1 THEN MIN(3, stage_before + 1) ELSE stage_before END AS stage_after FROM graded
)
INSERT OR IGNORE INTO pl_vocabulary_test_attempts
  (id, profile_id, item_id, question_id, idempotency_key, request_fingerprint, answer, correct_polish, prompt_ja,
   accepted_answers_json, is_correct, elapsed_ms, tested_at, baseline_at, gap_days, required_days,
   counts_for_retention, stage_before, stage_after, next_test_at)
SELECT event_id, profile_id, item_id, question_id, idempotency_key, request_fingerprint, answer, correct_polish, prompt_ja,
  accepted_answers_json, is_correct, elapsed_ms, tested_at, baseline_at, gap_days, required_days,
  counts_for_retention, stage_before, stage_after,
  strftime('%Y-%m-%dT%H:%M:%fZ', tested_at, '+' || ((CASE stage_after WHEN 0 THEN 1 WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 30 END) * 86400) || ' seconds')
FROM outcome`;

export async function answerVocabularyTest(db: D1Database, profile: string, request: Request, now = new Date()): Promise<VocabularyTestAnswerResponse> {
  const body = await requestBody(request);
  const questionId = textInput(body, "questionId", 160);
  const key = textInput(body, "idempotencyKey", 160);
  const answer = textInput(body, "answer", 300, true);
  const elapsedMs = body.elapsedMs ?? 0;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > DAY_MS) throw new VocabularyRetentionError("elapsedMsが不正です。");
  const fingerprint = JSON.stringify({ questionId, answer: normalizeVocabularyTestAnswer(answer) });
  const previous = await findAttempt(db, profile, "a.idempotency_key = ?", key);
  if (previous) {
    if (previous.request_fingerprint !== fingerprint) throw new VocabularyRetentionError("同じ操作キーで異なる回答は保存できません。", 409);
    return answerResponse(previous);
  }
  const challenge = await db.prepare("SELECT c.* FROM pl_vocabulary_test_challenges c JOIN pl_learning_items i ON i.id = c.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = c.profile_id WHERE c.id = ? AND c.profile_id = ? AND " + VISIBLE)
    .bind(questionId, profile, profile).first<ChallengeRow>();
  if (!challenge) throw new VocabularyRetentionError("テストの問題が見つかりません。", 404);
  if (await findAttempt(db, profile, "a.question_id = ?", questionId)) throw new VocabularyRetentionError("この問題にはすでに回答しています。", 409);
  if (Date.parse(challenge.expires_at) <= now.getTime()) throw new VocabularyRetentionError("問題の有効期限が切れました。新しいテストを始めてください。", 410);
  const normalized = normalizeVocabularyTestAnswer(answer);
  const isCorrect = Boolean(normalized) && acceptedAnswers(challenge.accepted_answers_json).some((expected) => normalizeVocabularyTestAnswer(expected) === normalized);
  const eventId = crypto.randomUUID();
  const timestamp = now.toISOString();
  await db.batch([
    db.prepare(SAVE_ANSWER).bind(eventId, profile, questionId, key, answer, fingerprint, Number(isCorrect), Math.round(elapsedMs), timestamp),
    db.prepare("INSERT INTO pl_vocabulary_retention_states (profile_id, item_id, stage, next_test_at, last_test_at, last_correct, last_gap_days, total_attempts, revision, updated_at) SELECT a.profile_id, a.item_id, a.stage_after, a.next_test_at, a.tested_at, a.is_correct, a.gap_days, COALESCE(r.total_attempts, 0) + 1, COALESCE(r.revision, 0) + 1, a.tested_at FROM pl_vocabulary_test_attempts a LEFT JOIN pl_vocabulary_retention_states r ON r.item_id = a.item_id AND r.profile_id = a.profile_id WHERE a.id = ? AND a.profile_id = ? ON CONFLICT(profile_id, item_id) DO UPDATE SET stage = excluded.stage, next_test_at = excluded.next_test_at, last_test_at = excluded.last_test_at, last_correct = excluded.last_correct, last_gap_days = excluded.last_gap_days, total_attempts = excluded.total_attempts, revision = excluded.revision, updated_at = excluded.updated_at")
      .bind(eventId, profile),
  ]);
  const saved = await findAttempt(db, profile, "a.idempotency_key = ?", key);
  if (!saved || saved.request_fingerprint !== fingerprint) throw new VocabularyRetentionError("この問題にはすでに回答しているか、同じ操作キーで別の回答が保存されています。", 409);
  return answerResponse(saved);
}

export async function vocabularyTestHistory(db: D1Database, profile: string, url: URL): Promise<VocabularyTestAttempt[]> {
  const wordId = url.searchParams.get("wordId");
  if (wordId) {
    if (wordId.length > 160 || !(await learnedWords(db, profile)).some((word) => word.id === wordId)) throw new VocabularyRetentionError("学習済みの単語が見つかりません。", 404);
  }
  const rows = await db.prepare("SELECT a.*" + ATTEMPT_FROM + (wordId ? " AND a.item_id = ?" : "") + " AND a.tested_at <= ? ORDER BY a.tested_at DESC, a.id DESC" + (wordId ? "" : " LIMIT 100"))
    .bind(profile, profile, ...(wordId ? [wordId] : []), new Date().toISOString()).all<AttemptRow>();
  return (rows.results ?? []).map(attempt);
}
