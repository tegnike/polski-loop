import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import worker from "../worker/index";
import type { VocabularySummary, VocabularyTestQuestion } from "../src/lib/types";

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  failBatchAt = -1;
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement, index) => {
        if (index === this.failBatchAt) throw new Error("injected batch failure");
        return statement.runSync();
      });
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}
class Statement {
  constructor(readonly db: SqliteD1, readonly sql: string, readonly values: Array<string | number | null> = []) {}
  bind(...values: Array<string | number | null>) { return new Statement(this.db, this.sql, values); }
  async first<T>() { return (this.db.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  async all<T>() { return { results: this.db.sqlite.prepare(this.sql).all(...this.values) as T[], success: true, meta: {} }; }
  runSync() { const result = this.db.sqlite.prepare(this.sql).run(...this.values); return { results: [], success: true, meta: { changes: Number(result.changes) } }; }
  async run() { return this.runSync(); }
}

let db: SqliteD1;
const INITIAL = "2026-01-05T12:00:00.000Z";
const DAY = 86_400_000;
const samples = [
  ["r-one", "chleb", "パン", ["chleb"]],
  ["r-two", "woda", "水", ["woda"]],
  ["r-three", "pociąg", "電車", ["pociąg"]],
  ["r-four", "dziś", "今日", ["dziś", "dzisiaj"]],
  ["r-five", "stół", "テーブル", ["stół"]],
  ["r-six", "dzień dobry", "こんにちは", ["dzień dobry"]],
] as const;

async function call(path: string, body?: unknown, profile = "master") {
  const response = await worker.fetch(new Request("https://polski.test/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }), { DB: db as unknown as D1Database, APP_ENV: "local", PROFILE_ID: profile, ASSETS: {} as Fetcher }, {} as ExecutionContext);
  return { status: response.status, body: await response.json() };
}
async function rate(wordId = "r-one", profile = "master") {
  const result = await call("/vocabulary/reviews", { wordId, rating: "known", idempotencyKey: crypto.randomUUID(), elapsedMs: 200 }, profile);
  expect(result.status).toBe(200);
}
const start = (mode: "due" | "practice", wordId?: string, key = crypto.randomUUID(), profile = "master") =>
  call("/vocabulary/tests/start", { mode, ...(wordId ? { wordId } : {}), idempotencyKey: key }, profile);
const answer = (questionId: string, value = "chleb", key = crypto.randomUUID(), profile = "master") =>
  call("/vocabulary/tests/answer", { questionId, answer: value, idempotencyKey: key, elapsedMs: 900 }, profile);
async function testWord(mode: "due" | "practice" = "due", wordId = "r-one", value = "chleb") {
  const result = await start(mode, wordId);
  expect(result.status).toBe(200);
  expect(result.body.questions).toHaveLength(1);
  const saved = await answer(result.body.questions[0].id, value);
  expect(saved.status).toBe(200);
  return saved.body;
}
async function summary(): Promise<VocabularySummary> {
  const result = await call("/vocabulary"); expect(result.status).toBe(200); return result.body;
}
function moveDays(days: number) { vi.setSystemTime(new Date(Date.now() + days * DAY)); }
function count(table: string) { return Number(db.sqlite.prepare("SELECT COUNT(*) AS count FROM " + table).get()!.count); }

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(INITIAL));
  db = new SqliteD1();
  const directory = resolve(process.cwd(), "migrations");
  for (const filename of readdirSync(directory).filter((name) => /^\d{4}_.*\.sql$/u.test(name) && !name.startsWith("0009_")).sort()) {
    db.sqlite.exec(readFileSync(resolve(directory, filename), "utf8"));
  }
  db.sqlite.exec("INSERT INTO pl_profiles (id, display_name, created_at, updated_at) VALUES ('other', 'Other', '2026-01-01', '2026-01-01')");
  for (const [index, [id, polish, meaning, accepted]] of samples.entries()) {
    db.sqlite.prepare("INSERT INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES (?, 'word', ?, ?, '', 'secret chleb', 'supermarket', '[]', ?, 'retention-test', 'published', ?)")
      .run(id, polish, meaning, JSON.stringify(accepted), INITIAL);
    db.sqlite.prepare("INSERT INTO pl_vocabulary_details (item_id, example_pl, example_ja, sort_order) VALUES (?, 'Secret example.', '秘密の例文', ?)").run(id, index);
  }
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });

describe("vocabulary recall tests", () => {
  it("keeps untouched words out of tests and initializes learned words without inventing confirmed stages", async () => {
    expect((await summary()).retention).toMatchObject({ due: 0, totalTested: 0, confirmed1: 0, confirmed3: 0, confirmed7: 0, recheck: 0, words: [] });
    expect((await start("practice", "r-one")).status).toBe(404);
    await rate();
    const learned = (await summary()).retention!;
    expect(learned.words[0]).toMatchObject({ stage: 0, requiredDays: 1, nextTestAt: "2026-01-06T12:00:00.000Z", lastTestAt: null, lastCorrect: null, totalAttempts: 0 });
    expect(count("pl_vocabulary_retention_states")).toBe(0);
    expect((await start("due")).body.questions).toEqual([]);
    const question = (await start("practice", "r-one")).body.questions[0];
    expect(Object.keys(question).sort()).toEqual(["createdAt", "dueAt", "eligibleForRetention", "id", "promptJa", "requiredDays"]);
    expect(question).toMatchObject({ promptJa: "パン", eligibleForRetention: false });
    expect(question).not.toHaveProperty("wordId");
    expect(JSON.stringify(question)).not.toMatch(/chleb|accepted|example|secret/iu);
  });

  it("keeps answer-bearing curriculum IDs out of the complete blind-start response until grading", async () => {
    const answerBearingId = "voc-supermarket-chleb";
    db.sqlite.prepare("INSERT INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES (?, 'word', 'chleb', 'パン', '', '', 'supermarket', '[]', '[\"chleb\"]', 'privacy-test', 'published', ?)")
      .run(answerBearingId, INITIAL);
    db.sqlite.prepare("INSERT INTO pl_vocabulary_details (item_id) VALUES (?)").run(answerBearingId);
    await rate(answerBearingId); moveDays(1);
    const response = await start("due");
    expect(response.status).toBe(200);
    expect(response.body.questions).toHaveLength(1);
    expect(response.body.questions[0]).not.toHaveProperty("wordId");
    expect(JSON.stringify(response.body)).not.toMatch(/chleb|voc-supermarket|wordId|acceptedAnswers|example/iu);
    const graded = await answer(response.body.questions[0].id);
    expect(graded.status).toBe(200);
    expect(graded.body).toMatchObject({ correctPolish: "chleb", attempt: { wordId: answerBearingId, isCorrect: true } });
  });

  it("advances only one stage at each exact 1/3/7-day boundary and maintains stage three every 30 days", async () => {
    await rate();
    for (const [days, stage, nextDays] of [[1, 1, 3], [3, 2, 7], [7, 3, 30], [30, 3, 30]] as const) {
      moveDays(days); vi.setSystemTime(new Date(Date.now() - 1));
      expect((await start("due", "r-one")).body.questions).toEqual([]);
      vi.setSystemTime(new Date(Date.now() + 1));
      const result = await testWord();
      expect(result.attempt).toMatchObject({ isCorrect: true, countsForRetention: true, stageAfter: stage, requiredDays: days });
      expect(result.attempt.gapDays).toBeCloseTo(days, 6);
      expect(result.attempt.nextTestAt).toBe(new Date(Date.now() + nextDays * DAY).toISOString());
      expect((await summary()).retention!.words[0]).toMatchObject({ stage, requiredDays: nextDays });
    }
    expect((await summary()).retention).toMatchObject({ totalTested: 1, confirmed1: 1, confirmed3: 1, confirmed7: 1, due: 0 });
  });

  it("treats a late first test as one-day evidence rather than skipping directly to seven-day confirmation", async () => {
    await rate(); moveDays(15);
    const result = await testWord();
    expect(result.attempt).toMatchObject({ gapDays: 15, requiredDays: 1, stageBefore: 0, stageAfter: 1, countsForRetention: true });
    expect((await summary()).retention).toMatchObject({ confirmed1: 1, confirmed3: 0, confirmed7: 0 });
  });

  it("never promotes practice, even after its due date, and schedules from feedback rather than question creation", async () => {
    await rate();
    const early = await testWord("practice");
    expect(early.attempt).toMatchObject({ isCorrect: true, countsForRetention: false, stageAfter: 0, gapDays: 0 });
    moveDays(1);
    const duePractice = (await start("practice", "r-one")).body.questions[0];
    expect(duePractice.eligibleForRetention).toBe(false);
    vi.setSystemTime(new Date(Date.now() + 10 * 60 * 1000));
    const saved = (await answer(duePractice.id)).body;
    expect(saved.attempt).toMatchObject({ isCorrect: true, countsForRetention: false, stageAfter: 0 });
    expect(saved.attempt.gapDays).toBeCloseTo(1 + 10 / 1440, 6);
    expect(saved.attempt.nextTestAt).toBe(new Date(Date.now() + DAY).toISOString());
    expect((await start("due", "r-one")).body.questions).toEqual([]);
  });

  it("restarts at stage zero on failure and records the failed interval separately from self-assessment", async () => {
    await rate();
    for (const days of [1, 3, 7]) { moveDays(days); await testWord(); }
    const selfBefore = db.sqlite.prepare("SELECT * FROM pl_vocabulary_states").all();
    moveDays(30);
    const failure = await testWord("due", "r-one", "wrong");
    expect(failure.attempt).toMatchObject({ isCorrect: false, stageBefore: 3, stageAfter: 0, requiredDays: 30, gapDays: 30, countsForRetention: false });
    expect(failure.attempt.nextTestAt).toBe(new Date(Date.now() + DAY).toISOString());
    expect((await summary()).retention).toMatchObject({ confirmed1: 0, confirmed3: 0, confirmed7: 0, recheck: 1 });
    expect(db.sqlite.prepare("SELECT * FROM pl_vocabulary_states").all()).toEqual(selfBefore);
    moveDays(1); await testWord();
    expect((await summary()).retention!.recheck).toBe(0);
    expect(count("pl_attempts")).toBe(0); expect(count("pl_review_states")).toBe(0);
    const legacy = (await call("/status")).body;
    expect(legacy.curriculum).toMatchObject({ publishedItemCount: 492, a1ItemCount: 132, a2ItemCount: 360 });
    expect(legacy.progress).toMatchObject({ learnedItems: 0, masteredItems: 0, dueReviews: 0 });
  });

  it("delays tests after a newer card rating and invalidates a previously due challenge's evidence", async () => {
    await rate(); moveDays(1);
    const question = (await start("due", "r-one")).body.questions[0];
    expect(question.eligibleForRetention).toBe(true);
    await rate();
    expect((await summary()).retention!.words[0].nextTestAt).toBe(new Date(Date.now() + DAY).toISOString());
    const result = (await answer(question.id)).body;
    expect(result.attempt).toMatchObject({ isCorrect: true, countsForRetention: false, stageAfter: 0, gapDays: 0 });
    moveDays(1); await testWord();
    moveDays(1); await rate();
    expect((await summary()).retention!.words[0]).toMatchObject({ stage: 1, requiredDays: 3, nextTestAt: new Date(Date.now() + 3 * DAY).toISOString() });
    moveDays(2); expect((await start("due", "r-one")).body.questions).toEqual([]);
    moveDays(1); expect((await testWord()).attempt.stageAfter).toBe(2);
  });

  it("normalizes case, NFKC, and extra whitespace while preserving diacritics, punctuation, and explicit aliases", async () => {
    for (const id of ["r-three", "r-four", "r-five", "r-six"]) await rate(id);
    expect((await testWord("practice", "r-three", "  POCIĄG  ")).attempt.isCorrect).toBe(true);
    expect((await testWord("practice", "r-three", "pociag")).attempt.isCorrect).toBe(false);
    expect((await testWord("practice", "r-three", "pociąg.")).attempt.isCorrect).toBe(false);
    expect((await testWord("practice", "r-four", "ＤＺＩＳＩＡＪ")).attempt.isCorrect).toBe(true);
    expect((await testWord("practice", "r-four", "dzis")).attempt.isCorrect).toBe(false);
    expect((await testWord("practice", "r-five", " ")).attempt.isCorrect).toBe(false);
    expect((await testWord("practice", "r-five", "stol")).attempt.isCorrect).toBe(false);
    expect((await testWord("practice", "r-six", "  DZIEŃ   DOBRY  ")).attempt.isCorrect).toBe(true);
    const result = await testWord("practice", "r-four", "dziś");
    expect(result).toMatchObject({ correctPolish: "dziś", meaningJa: "今日", acceptedAnswers: ["dziś", "dzisiaj"] });
  });

  it("creates one stable challenge set for concurrent start retries and rejects conflicting request reuse", async () => {
    await rate(); await rate("r-two"); moveDays(1);
    const results = await Promise.all([start("due", undefined, "same-start"), start("due", undefined, "same-start")]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results[0].body).toEqual(results[1].body);
    expect(count("pl_vocabulary_test_starts")).toBe(1); expect(count("pl_vocabulary_test_challenges")).toBe(2);
    expect((await start("practice", undefined, "same-start")).status).toBe(409);
    expect(count("pl_vocabulary_test_challenges")).toBe(2);
  });

  it("saves a challenge exactly once during concurrent answer retries and refuses changed or repeated submissions", async () => {
    await rate(); moveDays(1);
    const question = (await start("due", "r-one")).body.questions[0];
    const results = await Promise.all([answer(question.id, "chleb", "same-answer"), answer(question.id, "CHLEB", "same-answer")]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results[0].body.attempt.id).toBe(results[1].body.attempt.id);
    expect(count("pl_vocabulary_test_attempts")).toBe(1);
    expect((await summary()).retention!.words[0]).toMatchObject({ stage: 1, totalAttempts: 1 });
    expect((await answer(question.id, "wrong", "same-answer")).status).toBe(409);
    expect((await answer(question.id, "chleb", "another-answer")).status).toBe(409);
    moveDays(10);
    expect((await answer(question.id, "chleb", "same-answer")).body.attempt.id).toBe(results[0].body.attempt.id);
  });

  it("prevents two different concurrent due challenges from promoting the same word twice", async () => {
    await rate(); moveDays(1);
    const [left, right] = await Promise.all([start("due", "r-one"), start("due", "r-one")]);
    expect(left.body.questions[0].eligibleForRetention).toBe(true); expect(right.body.questions[0].eligibleForRetention).toBe(true);
    const results = await Promise.all([answer(left.body.questions[0].id), answer(right.body.questions[0].id)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results.map((result) => result.body.attempt.countsForRetention).sort()).toEqual([false, true]);
    expect(results.map((result) => result.body.attempt.stageAfter)).toEqual([1, 1]);
    expect((await summary()).retention!.words[0]).toMatchObject({ stage: 1, totalAttempts: 2 });
    expect(count("pl_vocabulary_test_attempts")).toBe(2);
  });

  it("accepts only one of two differently keyed concurrent answers for the same challenge", async () => {
    await rate(); moveDays(1);
    const question = (await start("due", "r-one")).body.questions[0];
    const results = await Promise.all([answer(question.id, "chleb", "one-key"), answer(question.id, "wrong", "another-key")]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(count("pl_vocabulary_test_attempts")).toBe(1);
    expect((await summary()).retention!.words[0].totalAttempts).toBe(1);
  });

  it("allows feedback just before expiry and records its elapsed interval from the last learning event", async () => {
    await rate(); moveDays(1);
    const question = (await start("due", "r-one")).body.questions[0];
    vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000 - 1));
    const result = await answer(question.id);
    expect(result.status).toBe(200);
    expect(result.body.attempt).toMatchObject({ isCorrect: true, countsForRetention: true, stageAfter: 1 });
    expect(result.body.attempt.gapDays).toBeCloseTo(1 + 1 / 24, 6);
    expect(result.body.attempt.nextTestAt).toBe(new Date(Date.now() + 3 * DAY).toISOString());
  });

  it("isolates challenges and personal words by profile and rejects unknown, hidden, and expired challenges", async () => {
    const personal = (await call("/vocabulary/words", { polish: "ser", meaningJa: "チーズ", topic: "supermarket", idempotencyKey: "personal" })).body;
    await rate(personal.id); moveDays(1);
    const question = (await start("due", personal.id)).body.questions[0];
    expect((await start("practice", personal.id, "foreign-start", "other")).status).toBe(404);
    expect((await answer(question.id, "ser", "foreign-answer", "other")).status).toBe(404);
    expect((await call("/vocabulary/tests/history?wordId=" + personal.id, undefined, "other")).status).toBe(404);
    expect((await answer("unknown-challenge")).status).toBe(404);
    const beforeExpiry = Date.now(); vi.setSystemTime(new Date(beforeExpiry + 60 * 60 * 1000));
    expect((await answer(question.id, "ser")).status).toBe(410);
    expect(count("pl_vocabulary_test_attempts")).toBe(0);
    vi.setSystemTime(new Date(beforeExpiry));
    const hidden = (await start("due", personal.id)).body.questions[0];
    db.sqlite.prepare("UPDATE pl_learning_items SET status = 'draft' WHERE id = ?").run(personal.id);
    expect((await answer(hidden.id, "ser")).status).toBe(404);
  });

  it("rolls back challenge creation and answer/state persistence atomically", async () => {
    await rate(); moveDays(1);
    db.failBatchAt = 1;
    expect((await start("due", "r-one", "rollback-start")).status).toBe(400);
    expect(count("pl_vocabulary_test_starts")).toBe(0); expect(count("pl_vocabulary_test_challenges")).toBe(0);
    db.failBatchAt = -1;
    const question = (await start("due", "r-one", "rollback-start")).body.questions[0];
    db.failBatchAt = 1;
    expect((await answer(question.id, "chleb", "rollback-answer")).status).toBe(400);
    expect(count("pl_vocabulary_test_attempts")).toBe(0); expect(count("pl_vocabulary_retention_states")).toBe(0);
    db.failBatchAt = -1;
    expect((await answer(question.id, "chleb", "rollback-answer")).body.attempt.stageAfter).toBe(1);
  });

  it("adds test activity to daily goals/streaks without repeating a word per day or changing the learned total", async () => {
    await rate(); await rate("r-two"); moveDays(1);
    await testWord(); await testWord("due", "r-two", "wrong"); await testWord("practice");
    let result = await summary();
    expect(result).toMatchObject({ started: 2, learnedToday: 2 });
    expect(result.progress).toMatchObject({ totalPoints: 4, totalStudyDays: 2, currentStreak: 2 });
    expect(result.progress.activity.at(-1)).toEqual({ date: "2026-01-06", words: 2, newWords: 0, reviews: 3 });
    await rate(); result = await summary();
    expect(result.learnedToday).toBe(2); expect(result.progress.totalPoints).toBe(4);
    expect(result.progress.activity.at(-1)!.reviews).toBe(4);
    expect(count("pl_attempts")).toBe(0);
  });

  it("returns full per-word history beyond recent twenty and exports only the current profile's test records", async () => {
    await rate(); await rate("r-two", "other");
    for (let index = 0; index < 105; index++) await testWord("practice");
    const otherQuestion = (await start("practice", "r-two", "their-start", "other")).body.questions[0];
    await answer(otherQuestion.id, "woda", "their-answer", "other");
    const history = await call("/vocabulary/tests/history?wordId=r-one");
    expect(history.body).toHaveLength(105);
    expect((await summary()).retention!.recentTests).toHaveLength(20);
    expect((await summary()).retention!.words[0].totalAttempts).toBe(105);
    const exported = (await call("/export")).body.data;
    expect(exported.pl_vocabulary_test_attempts).toHaveLength(105);
    expect(exported.pl_vocabulary_test_challenges).toHaveLength(105);
    expect(exported.pl_vocabulary_test_starts).toHaveLength(105);
    expect(exported.pl_vocabulary_retention_states).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain("their-start");
    const response = await worker.fetch(new Request("https://polski.test/api/v1/export?format=csv"), { DB: db as unknown as D1Database, APP_ENV: "local", PROFILE_ID: "master", ASSETS: {} as Fetcher }, {} as ExecutionContext);
    const csv = await response.text();
    expect(csv).toContain('"vocabulary_test_attempt"'); expect(csv).toContain('"vocabulary_retention_state"');
    expect(csv).toContain("counts_for_retention"); expect(csv).toContain("gap_days"); expect(csv).not.toContain("their-answer");
    expect(count("pl_attempts")).toBe(0); expect(count("pl_vocabulary_reviews")).toBe(2);
  });

  it("validates request sizes and limits without treating an empty string as an invalid answer", async () => {
    for (const body of [
      { mode: "bad", idempotencyKey: "bad" }, { mode: "due", limit: 0, idempotencyKey: "bad" },
      { mode: "due", limit: 6, idempotencyKey: "bad" }, { mode: "due", idempotencyKey: "" },
    ]) expect((await call("/vocabulary/tests/start", body)).status).toBe(400);
    await rate();
    const question: VocabularyTestQuestion = (await start("practice", "r-one")).body.questions[0];
    expect((await call("/vocabulary/tests/answer", { questionId: question.id, answer: "a".repeat(301), idempotencyKey: "long" })).status).toBe(400);
    expect((await call("/vocabulary/tests/answer", { questionId: question.id, answer: "chleb", idempotencyKey: "duration", elapsedMs: -1 })).status).toBe(400);
    const result = await answer(question.id, "");
    expect(result.status).toBe(200); expect(result.body.attempt.isCorrect).toBe(false);
  });
});
