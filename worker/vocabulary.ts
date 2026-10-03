import { isVocabularyTopic, normalizeVocabularyPolish, VOCABULARY_TOPICS } from "../src/lib/vocabulary";
import { calculateVocabularyProgress } from "../src/lib/vocabulary-progress";
import type { ItemRegister, ItemSkill, TrackCode, VocabularyRating, VocabularyReviewEntry, VocabularyState, VocabularySummary, VocabularyWord } from "../src/lib/types";

export class VocabularyError extends Error {
  constructor(message: string, readonly status: number = 400) { super(message); }
}

interface WordRow {
  id: string; polish: string; meaning_ja: string; meaning_en: string; grammar_note: string; topic: string;
  tags_json: string; accepted_answers_json: string; content_version: string; cefr_level: TrackCode;
  skills_json: string; scene: string; register: ItemRegister; speaker_gender: "male" | "female" | "any";
  dialogue_role: "learner" | "partner"; example_pl: string; example_ja: string; owner_profile_id: string | null;
  state_item_id: string | null; due_at: string | null; interval_days: number | null; repetitions: number | null;
  lapses: number | null; last_rating: VocabularyRating | null; updated_at: string | null;
}
interface ReviewRow {
  id: string; item_id: string; polish: string; meaning_ja: string; rating: VocabularyRating;
  elapsed_ms: number; created_at: string; due_at: string;
}

const WORD_COLUMNS = "i.id, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, i.cefr_level, i.skills_json, i.scene, i.register, i.speaker_gender, i.dialogue_role, d.example_pl, d.example_ja, d.owner_profile_id, s.item_id AS state_item_id, s.due_at, s.interval_days, s.repetitions, s.lapses, s.last_rating, s.updated_at";
const WORD_FROM = " FROM pl_learning_items i JOIN pl_vocabulary_details d ON d.item_id = i.id LEFT JOIN pl_vocabulary_states s ON s.item_id = i.id AND s.profile_id = ?";
const VISIBLE = "i.status = 'published' AND i.type = 'word' AND (d.owner_profile_id IS NULL OR d.owner_profile_id = ?)";
const WORD_ORDER = " ORDER BY d.sort_order, i.id";

function stringArray(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []; }
  catch { return []; }
}
function toWord(row: WordRow): VocabularyWord {
  const state: VocabularyState | null = row.state_item_id ? {
    dueAt: row.due_at!, intervalDays: row.interval_days!, repetitions: row.repetitions!, lapses: row.lapses!,
    lastRating: row.last_rating!, updatedAt: row.updated_at!,
  } : null;
  return { id: row.id, type: "word", polish: row.polish, meaningJa: row.meaning_ja, meaningEn: row.meaning_en,
    grammarNote: row.grammar_note, topic: row.topic, tags: stringArray(row.tags_json), acceptedAnswers: stringArray(row.accepted_answers_json),
    contentVersion: row.content_version, cefrLevel: row.cefr_level, skills: stringArray(row.skills_json) as ItemSkill[],
    situation: row.scene, register: row.register, speakerGender: row.speaker_gender, dialogueRole: row.dialogue_role,
    examplePl: row.example_pl, exampleJa: row.example_ja, personal: row.owner_profile_id !== null, state };
}
function toReview(row: ReviewRow): VocabularyReviewEntry {
  return { id: row.id, wordId: row.item_id, polish: row.polish, meaningJa: row.meaning_ja, rating: row.rating,
    elapsedMs: row.elapsed_ms, createdAt: row.created_at, dueAt: row.due_at };
}
async function selectWords(db: D1Database, profile: string, clauses: string[] = [], values: Array<string | number> = [], order = WORD_ORDER): Promise<VocabularyWord[]> {
  const rows = await db.prepare("SELECT " + WORD_COLUMNS + WORD_FROM + " WHERE " + VISIBLE + clauses.map((clause) => " AND " + clause).join("") + order)
    .bind(profile, profile, ...values).all<WordRow>();
  return (rows.results ?? []).map(toWord);
}
async function findWord(db: D1Database, profile: string, wordId: string): Promise<VocabularyWord> {
  const words = await selectWords(db, profile, ["i.id = ?"], [wordId]);
  if (!words[0]) throw new VocabularyError("単語が見つかりません。", 404);
  return words[0];
}
function topicParam(value: string | null): string | null {
  if (value && !isVocabularyTopic(value)) throw new VocabularyError("単語のカテゴリが不正です。");
  return value || null;
}
function limitParam(value: string | null): number {
  if (value === null) return 5;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 20) throw new VocabularyError("limitは1〜20の整数で指定してください。");
  return number;
}
async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new VocabularyError("JSON形式のリクエストが必要です。"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new VocabularyError("JSONオブジェクトを指定してください。");
  return body as Record<string, unknown>;
}
function inputString(body: Record<string, unknown>, key: string, max: number, optional = false): string {
  const value = body[key];
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string" || (!optional && !value.trim()) || value.length > max) throw new VocabularyError(`${key}は${max}文字以内で指定してください。`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new VocabularyError(`${key}に使用できない文字が含まれています。`);
  return value.normalize("NFKC").trim();
}

export async function vocabularySummary(db: D1Database, profile: string, now = new Date()): Promise<VocabularySummary> {
  const reviewFrom = " FROM pl_vocabulary_reviews r JOIN pl_learning_items i ON i.id = r.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id WHERE r.profile_id = ? AND " + VISIBLE;
  const [words, reviews, history] = await Promise.all([
    selectWords(db, profile),
    db.prepare("SELECT r.id, r.item_id, i.polish, i.meaning_ja, r.rating, r.elapsed_ms, r.created_at, r.due_at" + reviewFrom + " AND r.created_at <= ? ORDER BY r.created_at DESC, r.id DESC LIMIT 20")
      .bind(profile, profile, now.toISOString()).all<ReviewRow>(),
    db.prepare("SELECT r.item_id, r.created_at" + reviewFrom + " AND r.created_at <= ?")
      .bind(profile, profile, now.toISOString()).all<Pick<ReviewRow, "item_id" | "created_at">>(),
  ]);
  const events = reviews.results ?? [];
  const progress = calculateVocabularyProgress((history.results ?? []).map((event) => ({ wordId: event.item_id, createdAt: event.created_at })), now);
  return { total: words.length, started: words.filter((word) => word.state).length,
    remembered: words.filter((word) => word.state?.lastRating === "known").length,
    due: words.filter((word) => word.state && word.state.dueAt <= now.toISOString()).length,
    learnedToday: progress.activity[progress.activity.length - 1].words, progress,
    topics: VOCABULARY_TOPICS.map((topic) => ({ ...topic, total: words.filter((word) => word.topic === topic.id).length,
      started: words.filter((word) => word.topic === topic.id && word.state).length })),
    today: words.filter((word) => !word.state).slice(0, 5), recentReviews: events.slice(0, 20).map(toReview) };
}

export async function vocabularyWords(db: D1Database, profile: string, url: URL): Promise<VocabularyWord[]> {
  const clauses: string[] = []; const values: Array<string | number> = [];
  const search = url.searchParams.get("search")?.trim(); const topic = topicParam(url.searchParams.get("topic"));
  if (search) { if (search.length > 100) throw new VocabularyError("検索語は100文字以内にしてください。"); clauses.push("(i.polish LIKE ? OR i.meaning_ja LIKE ?)"); values.push("%" + search + "%", "%" + search + "%"); }
  if (topic) { clauses.push("i.topic = ?"); values.push(topic); }
  const state = url.searchParams.get("state");
  if (state && !["new", "learning", "remembered"].includes(state)) throw new VocabularyError("単語の学習状態が不正です。");
  if (state === "new") clauses.push("s.item_id IS NULL");
  if (state === "learning") clauses.push("s.last_rating = 'again'");
  if (state === "remembered") clauses.push("s.last_rating = 'known'");
  if (url.searchParams.get("personal") === "true") { clauses.push("d.owner_profile_id = ?"); values.push(profile); }
  return selectWords(db, profile, clauses, values);
}

export async function vocabularyQueue(db: D1Database, profile: string, url: URL, now = new Date()): Promise<VocabularyWord[]> {
  const mode = url.searchParams.get("mode") ?? "learn";
  if (!["learn", "review"].includes(mode)) throw new VocabularyError("modeはlearnまたはreviewで指定してください。");
  const topic = topicParam(url.searchParams.get("topic")); const limit = limitParam(url.searchParams.get("limit"));
  const selectedId = url.searchParams.get("wordId");
  const selected = selectedId ? await findWord(db, profile, selectedId) : null;
  const clauses = [mode === "review" ? "s.due_at <= ?" : "s.item_id IS NULL"];
  const values: Array<string | number> = mode === "review" ? [now.toISOString()] : [];
  if (topic) { clauses.push("i.topic = ?"); values.push(topic); }
  if (selected) { clauses.push("i.id != ?"); values.push(selected.id); }
  values.push(limit - (selected ? 1 : 0));
  const others = await selectWords(db, profile, clauses, values,
    (mode === "review" ? " ORDER BY s.due_at, d.sort_order, i.id" : WORD_ORDER) + " LIMIT ?");
  // Selecting a word permits deliberate practice; its stored due date stays unchanged.
  return selected ? [selected, ...others] : others;
}

async function findReview(db: D1Database, profile: string, key: string): Promise<ReviewRow | null> {
  return db.prepare("SELECT r.id, r.item_id, i.polish, i.meaning_ja, r.rating, r.elapsed_ms, r.created_at, r.due_at FROM pl_vocabulary_reviews r JOIN pl_learning_items i ON i.id = r.item_id JOIN pl_vocabulary_details d ON d.item_id = i.id WHERE r.profile_id = ? AND r.idempotency_key = ? AND " + VISIBLE)
    .bind(profile, key, profile).first<ReviewRow>();
}

export async function rateVocabulary(db: D1Database, profile: string, request: Request, now = new Date()): Promise<{ eventId: string; word: VocabularyWord }> {
  const body = await bodyObject(request); const wordId = inputString(body, "wordId", 160); const key = inputString(body, "idempotencyKey", 160);
  if (body.rating !== "again" && body.rating !== "known") throw new VocabularyError("ratingはagainまたはknownで指定してください。");
  const rating = body.rating; const elapsedMs = body.elapsedMs ?? 0;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 24 * 60 * 60 * 1000) throw new VocabularyError("elapsedMsが不正です。");
  await findWord(db, profile, wordId);
  const previousEvent = await findReview(db, profile, key);
  if (previousEvent) {
    if (previousEvent.item_id !== wordId || previousEvent.rating !== rating) throw new VocabularyError("同じ操作キーで異なる評価は保存できません。", 409);
    return { eventId: previousEvent.id, word: await findWord(db, profile, wordId) };
  }
  const eventId = crypto.randomUUID(); const timestamp = now.toISOString();
  // Scheduling reads the current state inside the transaction, so simultaneous ratings cannot lose an update.
  const interval = "CASE WHEN ? = 'again' THEN 15.0 / 1440 ELSE MIN(365, MAX(1, COALESCE(s.interval_days, 0) * 2.5)) END";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO pl_vocabulary_reviews (id, profile_id, item_id, idempotency_key, rating, elapsed_ms, created_at, due_at) SELECT ?, ?, i.id, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || ((" + interval + ") * 86400) || ' seconds')" + WORD_FROM + " WHERE " + VISIBLE + " AND i.id = ?")
      .bind(eventId, profile, key, rating, Math.round(elapsedMs), timestamp, timestamp, rating, profile, profile, wordId),
    db.prepare("INSERT INTO pl_vocabulary_states (profile_id, item_id, due_at, interval_days, repetitions, lapses, last_rating, updated_at) SELECT r.profile_id, r.item_id, r.due_at, ROUND(julianday(r.due_at) - julianday(r.created_at), 4), CASE WHEN r.rating = 'again' THEN 0 ELSE COALESCE(s.repetitions, 0) + 1 END, COALESCE(s.lapses, 0) + CASE WHEN r.rating = 'again' THEN 1 ELSE 0 END, r.rating, r.created_at FROM pl_vocabulary_reviews r LEFT JOIN pl_vocabulary_states s ON s.item_id = r.item_id AND s.profile_id = r.profile_id WHERE r.id = ? AND r.profile_id = ? ON CONFLICT(profile_id, item_id) DO UPDATE SET due_at = excluded.due_at, interval_days = excluded.interval_days, repetitions = excluded.repetitions, lapses = excluded.lapses, last_rating = excluded.last_rating, updated_at = excluded.updated_at")
      .bind(eventId, profile),
  ]);
  const event = await findReview(db, profile, key);
  if (!event) throw new VocabularyError("単語の評価を保存できませんでした。", 500);
  if (event.item_id !== wordId || event.rating !== rating) throw new VocabularyError("同じ操作キーで異なる評価は保存できません。", 409);
  return { eventId: event.id, word: await findWord(db, profile, wordId) };
}

export async function createVocabularyWord(db: D1Database, profile: string, request: Request, now = new Date()): Promise<VocabularyWord> {
  const body = await bodyObject(request); const polish = normalizeVocabularyPolish(inputString(body, "polish", 80));
  const meaningJa = inputString(body, "meaningJa", 160); const topic = inputString(body, "topic", 30); const key = inputString(body, "idempotencyKey", 160);
  const examplePl = inputString(body, "examplePl", 300, true); const exampleJa = inputString(body, "exampleJa", 300, true);
  if (!isVocabularyTopic(topic)) throw new VocabularyError("単語のカテゴリが不正です。");
  if (!/\p{L}/u.test(polish) || /[\r\n.!?。！？]/u.test(polish) || polish.split(" ").length > 5) throw new VocabularyError("ポーランド語の単語または短い語句を入力してください。");
  const normalizedPolish = polish.toLocaleLowerCase("pl-PL");
  const fingerprint = JSON.stringify({ polish: normalizedPolish, meaningJa, topic, examplePl, exampleJa });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([profile, normalizedPolish, meaningJa])));
  const id = "personal-word-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const previous = await db.prepare("SELECT item_id, request_fingerprint FROM pl_vocabulary_word_requests WHERE profile_id = ? AND idempotency_key = ?").bind(profile, key).first<{ item_id: string; request_fingerprint: string }>();
  if (previous) {
    if (previous.request_fingerprint !== fingerprint) throw new VocabularyError("同じ操作キーで異なる単語は保存できません。", 409);
    return findWord(db, profile, previous.item_id);
  }
  const timestamp = now.toISOString();
  await db.batch([
    db.prepare("INSERT INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) SELECT ?, 'word', ?, ?, '', '', ?, ?, ?, 'vocabulary-personal-v1', 'published', ? WHERE NOT EXISTS (SELECT 1 FROM pl_vocabulary_word_requests WHERE profile_id = ? AND idempotency_key = ?) ON CONFLICT(id) DO NOTHING")
      .bind(id, polish, meaningJa, topic, JSON.stringify(["vocabulary", "personal", "topic:" + topic]), JSON.stringify([polish]), timestamp, profile, key),
    db.prepare("INSERT INTO pl_vocabulary_details (item_id, example_pl, example_ja, owner_profile_id, sort_order) SELECT id, ?, ?, ?, 1000000 FROM pl_learning_items WHERE id = ? AND NOT EXISTS (SELECT 1 FROM pl_vocabulary_word_requests WHERE profile_id = ? AND idempotency_key = ?) ON CONFLICT(item_id) DO NOTHING")
      .bind(examplePl, exampleJa, profile, id, profile, key),
    db.prepare("INSERT INTO pl_vocabulary_word_requests (profile_id, idempotency_key, item_id, request_fingerprint) SELECT ?, ?, d.item_id, ? FROM pl_vocabulary_details d JOIN pl_learning_items i ON i.id = d.item_id WHERE d.item_id = ? AND d.owner_profile_id = ? AND i.topic = ? AND d.example_pl = ? AND d.example_ja = ? ON CONFLICT(profile_id, idempotency_key) DO NOTHING")
      .bind(profile, key, fingerprint, id, profile, topic, examplePl, exampleJa),
  ]);
  const saved = await db.prepare("SELECT item_id, request_fingerprint FROM pl_vocabulary_word_requests WHERE profile_id = ? AND idempotency_key = ?").bind(profile, key).first<{ item_id: string; request_fingerprint: string }>();
  if (!saved) throw new VocabularyError("この単語はすでに登録されています。場面や例文が異なるため、新しい入力は保存していません。", 409);
  if (saved.request_fingerprint !== fingerprint) throw new VocabularyError("同じ操作キーで異なる単語は保存できません。", 409);
  return findWord(db, profile, saved.item_id);
}

export async function vocabularyExport(db: D1Database, profile: string): Promise<Record<string, Array<Record<string, unknown>>>> {
  const queries: Record<string, string> = {
    pl_vocabulary_details: "SELECT d.* FROM pl_vocabulary_details d JOIN pl_learning_items i ON i.id = d.item_id WHERE " + VISIBLE,
    pl_vocabulary_states: "SELECT s.* FROM pl_vocabulary_states s JOIN pl_vocabulary_details d ON d.item_id = s.item_id JOIN pl_learning_items i ON i.id = d.item_id WHERE s.profile_id = ? AND " + VISIBLE,
    pl_vocabulary_reviews: "SELECT r.* FROM pl_vocabulary_reviews r JOIN pl_vocabulary_details d ON d.item_id = r.item_id JOIN pl_learning_items i ON i.id = d.item_id WHERE r.profile_id = ? AND " + VISIBLE,
    pl_vocabulary_word_requests: "SELECT w.* FROM pl_vocabulary_word_requests w JOIN pl_vocabulary_details d ON d.item_id = w.item_id JOIN pl_learning_items i ON i.id = d.item_id WHERE w.profile_id = ? AND " + VISIBLE,
    pl_vocabulary_learning_items: "SELECT i.* FROM pl_learning_items i JOIN pl_vocabulary_details d ON d.item_id = i.id WHERE " + VISIBLE,
    pl_personal_learning_items: "SELECT i.* FROM pl_learning_items i JOIN pl_vocabulary_details d ON d.item_id = i.id WHERE " + VISIBLE + " AND d.owner_profile_id = ?",
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([name, query]) => {
    const values = name === "pl_vocabulary_details" || name === "pl_vocabulary_learning_items" ? [profile] : [profile, profile];
    const result = await db.prepare(query).bind(...values).all<Record<string, unknown>>();
    return [name, result.results ?? []] as const;
  }));
  return Object.fromEntries(entries);
}

export async function vocabularyRoute(request: Request, db: D1Database, profile: string, path: string, url: URL): Promise<unknown> {
  if (request.method === "GET" && (path === "/vocabulary" || path === "/vocabulary/")) return vocabularySummary(db, profile);
  if (request.method === "GET" && path === "/vocabulary/words") return vocabularyWords(db, profile, url);
  if (request.method === "GET" && path === "/vocabulary/queue") return vocabularyQueue(db, profile, url);
  if (request.method === "POST" && path === "/vocabulary/reviews") return rateVocabulary(db, profile, request);
  if (request.method === "POST" && path === "/vocabulary/words") return createVocabularyWord(db, profile, request);
  throw new VocabularyError("単語学習のAPI endpointが見つかりません。", 404);
}
