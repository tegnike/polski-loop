import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import worker from "../worker/index";
import type { VocabularyMasterySummary, VocabularySummary, VocabularyTestAnswerResponse } from "../src/lib/types";

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.runSync());
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
const DAY = 86_400_000;
const BREAD = "voc-supermarket-chleb";
const WATER = "voc-supermarket-woda";
const INITIAL = "2026-01-05T12:00:00.000Z";

async function call(path: string, body?: unknown, profile = "master") {
  const response = await worker.fetch(new Request("https://polski.test/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }), { DB: db as unknown as D1Database, APP_ENV: "local", PROFILE_ID: profile, ASSETS: {} as Fetcher }, {} as ExecutionContext);
  const result = await response.json();
  expect(response.status).toBeGreaterThanOrEqual(200); expect(response.status).toBeLessThan(300);
  return result;
}
async function rate(wordId = BREAD, profile = "master") {
  await call("/vocabulary/reviews", { wordId, rating: "known", idempotencyKey: crypto.randomUUID(), elapsedMs: 200 }, profile);
}
async function test(mode: "due" | "practice" = "due", wordId = BREAD, answer = "chleb", profile = "master"): Promise<VocabularyTestAnswerResponse> {
  const response = await call("/vocabulary/tests/start", { mode, wordId, limit: 1, idempotencyKey: crypto.randomUUID() }, profile);
  expect(response.questions).toHaveLength(1);
  return call("/vocabulary/tests/answer", { questionId: response.questions[0].id, answer, idempotencyKey: crypto.randomUUID(), elapsedMs: 500 }, profile);
}
async function summary(profile = "master"): Promise<VocabularySummary> { return call("/vocabulary", undefined, profile); }
async function mastery(profile = "master"): Promise<VocabularyMasterySummary> { return (await summary(profile)).retention!.mastery!; }
function moveDays(days: number) { vi.setSystemTime(new Date(Date.now() + days * DAY)); }
async function register(wordId = BREAD, answer = "chleb", profile = "master") {
  await rate(wordId, profile);
  for (const days of [1, 3, 7]) { moveDays(days); await test("due", wordId, answer, profile); }
  return new Date().toISOString();
}
function savedData() {
  return ["pl_vocabulary_reviews", "pl_vocabulary_states", "pl_vocabulary_test_attempts", "pl_vocabulary_retention_states"].map((table) => db.sqlite.prepare("SELECT * FROM " + table).all());
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(INITIAL)); db = new SqliteD1();
  const directory = resolve(process.cwd(), "migrations");
  for (const filename of readdirSync(directory).filter((name) => /^\d{4}_.*\.sql$/u.test(name)).sort()) {
    db.sqlite.exec(readFileSync(resolve(directory, filename), "utf8"));
  }
  db.sqlite.exec("INSERT INTO pl_profiles (id, display_name, created_at, updated_at) VALUES ('other', 'Other', '2026-01-01', '2026-01-01')");
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });

describe("cumulative vocabulary mastery", () => {
  it("registers a word only after valid seven-day confirmation, independently of self-ratings or early practice", async () => {
    expect(await mastery()).toEqual({ total: 0, verified: 0, recheck: 0, words: [] });
    await rate(); await test("practice");
    expect(await mastery()).toMatchObject({ total: 0 });
    moveDays(1); expect((await test()).attempt.stageAfter).toBe(1);
    expect(await mastery()).toMatchObject({ total: 0 });
    moveDays(3); expect((await test()).attempt.stageAfter).toBe(2);
    moveDays(7); await test("practice");
    expect(await mastery()).toMatchObject({ total: 0 });
    moveDays(7); expect((await test()).attempt.stageAfter).toBe(3);
    const result = await mastery();
    expect(result).toMatchObject({ total: 1, verified: 1, recheck: 0 });
    expect(result.words).toHaveLength(1);
    expect(result.words[0]).toMatchObject({ wordId: BREAD, polish: "chleb", meaningJa: "パン", firstMasteredAt: new Date().toISOString(), needsRecheck: false, stage: 3, requiredDays: 30 });
  });

  it("preserves the first registration after thirty-day failure and after a full reconfirmation", async () => {
    const firstMasteredAt = await register();
    moveDays(30);
    const failure = await test("due", BREAD, "wrong");
    expect(failure.attempt.stageAfter).toBe(0);
    let result = await mastery();
    expect(result).toMatchObject({ total: 1, verified: 0, recheck: 1 });
    expect(result.words[0]).toMatchObject({ firstMasteredAt, needsRecheck: true, stage: 0, lastCorrect: false });
    await rate(); await test("practice");
    result = await mastery();
    expect(result).toMatchObject({ total: 1, verified: 0, recheck: 1 });
    expect(result.words[0]).toMatchObject({ firstMasteredAt, needsRecheck: true, lastCorrect: true });
    for (const days of [1, 3, 7]) { moveDays(days); await test(); }
    result = await mastery();
    expect(result).toMatchObject({ total: 1, verified: 1, recheck: 0 });
    expect(result.words[0]).toMatchObject({ firstMasteredAt, needsRecheck: false, stage: 3 });
    expect(Number(db.sqlite.prepare("SELECT COUNT(*) AS count FROM pl_vocabulary_test_attempts WHERE counts_for_retention = 1 AND stage_after = 3").get()!.count)).toBe(2);
  });

  it("keeps the earliest evidence beyond recent twenty and never duplicates thirty-day maintenance confirmations", async () => {
    const firstMasteredAt = await register();
    moveDays(30); await test();
    for (let index = 0; index < 25; index++) {
      vi.setSystemTime(new Date(Date.now() + 1));
      await test("practice");
    }
    const result = await summary();
    expect(result.retention!.recentTests).toHaveLength(20);
    expect(result.retention!.recentTests.every((attempt) => !attempt.countsForRetention)).toBe(true);
    expect(result.retention!.mastery).toMatchObject({ total: 1, verified: 1, recheck: 0 });
    expect(result.retention!.mastery!.words[0]).toMatchObject({ firstMasteredAt, totalAttempts: 29 });
  });

  it("isolates global word evidence by profile and does not reveal another profile's personal registration", async () => {
    const firstMasteredAt = await register();
    const otherFirst = await register(BREAD, "chleb", "other");
    const foreign = await call("/vocabulary/words", { polish: "ser", meaningJa: "チーズ", topic: "supermarket", idempotencyKey: "foreign-personal" }, "other");
    await register(foreign.id, "ser", "other");
    const own = await mastery(); const other = await mastery("other");
    expect(own).toMatchObject({ total: 1, verified: 1 });
    expect(own.words[0]).toMatchObject({ wordId: BREAD, firstMasteredAt });
    expect(JSON.stringify(own)).not.toContain(foreign.id);
    expect(other).toMatchObject({ total: 2, verified: 2 });
    expect(other.words.find((word) => word.wordId === BREAD)!.firstMasteredAt).toBe(otherFirst);
    expect(other.words[0].wordId).toBe(foreign.id);
  });

  it("excludes unpublished and non-word records while retaining their evidence when they become visible again", async () => {
    const firstBread = await register(); const firstWater = await register(WATER, "woda");
    expect((await mastery()).total).toBe(2);
    db.sqlite.prepare("UPDATE pl_learning_items SET status = 'draft' WHERE id = ?").run(BREAD);
    db.sqlite.prepare("UPDATE pl_learning_items SET type = 'phrase' WHERE id = ?").run(WATER);
    expect(await mastery()).toEqual({ total: 0, verified: 0, recheck: 0, words: [] });
    db.sqlite.prepare("UPDATE pl_learning_items SET status = 'published' WHERE id = ?").run(BREAD);
    db.sqlite.prepare("UPDATE pl_learning_items SET type = 'word' WHERE id = ?").run(WATER);
    const result = await mastery();
    expect(result.total).toBe(2);
    expect(result.words.map((word) => [word.wordId, word.firstMasteredAt])).toEqual([[WATER, firstWater], [BREAD, firstBread]]);
  });

  it("excludes future registration and future failure without replacing the current past verification", async () => {
    const firstMasteredAt = await register();
    moveDays(30); await test("due", BREAD, "wrong");
    await register(WATER, "woda");
    const futureNow = new Date();
    vi.setSystemTime(new Date(firstMasteredAt));
    const result = await mastery();
    expect(result).toMatchObject({ total: 1, verified: 1, recheck: 0 });
    expect(result.words[0]).toMatchObject({ wordId: BREAD, firstMasteredAt, needsRecheck: false, stage: 3, lastCorrect: true, lastTestAt: firstMasteredAt, totalAttempts: 3 });
    expect(result.words.some((word) => word.wordId === WATER)).toBe(false);
    vi.setSystemTime(futureNow);
    expect(await mastery()).toMatchObject({ total: 2, verified: 1, recheck: 1 });
  });

  it("derives registration without writing state/history or affecting legacy lesson correctness", async () => {
    await register(); const before = savedData();
    for (let index = 0; index < 3; index++) expect((await mastery()).total).toBe(1);
    expect(savedData()).toEqual(before);
    const legacy = await call("/status");
    expect(legacy.curriculum).toMatchObject({ publishedItemCount: 492, a1ItemCount: 132, a2ItemCount: 360 });
    expect(legacy.progress).toMatchObject({ learnedItems: 0, masteredItems: 0, dueReviews: 0 });
    expect(Number(db.sqlite.prepare("SELECT COUNT(*) AS count FROM pl_attempts").get()!.count)).toBe(0);
  });
});
