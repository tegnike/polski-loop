import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import worker from "../worker/index";
import { vocabularyDateKey } from "../src/lib/vocabulary";
import type { VocabularySummary, VocabularyWord } from "../src/lib/types";

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  failBatchAt = -1;
  prepare(sql: string) { return new SqliteStatement(this, sql); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const [index, statement] of statements.entries()) {
        if (index === this.failBatchAt) throw new Error("injected batch failure");
        results.push(statement.runSync());
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}
class SqliteStatement {
  constructor(readonly db: SqliteD1, readonly sql: string, readonly values: Array<string | number | null> = []) {}
  bind(...values: Array<string | number | null>) { return new SqliteStatement(this.db, this.sql, values); }
  async first<T>() { return (this.db.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null; }
  async all<T>() { return { results: this.db.sqlite.prepare(this.sql).all(...this.values) as T[], success: true, meta: {} }; }
  runSync() { const result = this.db.sqlite.prepare(this.sql).run(...this.values); return { results: [], success: true, meta: { changes: Number(result.changes) } }; }
  async run() { return this.runSync(); }
}

let db: SqliteD1;
const samples = [
  ["v-test-1", "chleb", "パン", "supermarket", 1],
  ["v-test-2", "woda", "水", "supermarket", 2],
  ["v-test-3", "mleko", "牛乳", "supermarket", 3],
  ["v-test-4", "kawa", "コーヒー", "cafe", 4],
  ["v-test-5", "sklep", "店", "supermarket", 5],
  ["v-test-6", "dom", "家", "home", 6],
] as const;

async function fetchApi(path: string, options: { profile?: string; method?: string; body?: unknown } = {}) {
  const request = new Request("https://polski.test/api/v1" + path, {
    method: options.method ?? "GET",
    ...(options.body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(options.body) } : {}),
  });
  return worker.fetch(request, { DB: db as unknown as D1Database, APP_ENV: "local", PROFILE_ID: options.profile ?? "master", ASSETS: {} as Fetcher }, {} as ExecutionContext);
}
async function jsonApi(path: string, options: Parameters<typeof fetchApi>[1] = {}) {
  const response = await fetchApi(path, options);
  return { status: response.status, body: await response.json() };
}
const rate = (wordId: string, rating: "again" | "known", key: string, profile = "master") => jsonApi("/vocabulary/reviews", {
  method: "POST", profile, body: { wordId, rating, idempotencyKey: key, elapsedMs: 1234 },
});
const add = (key: string, profile = "master", fields: Record<string, unknown> = {}) => jsonApi("/vocabulary/words", {
  method: "POST", profile, body: { polish: "ser", meaningJa: "チーズ", topic: "supermarket", idempotencyKey: key, ...fields },
});
function count(table: string) { return Number(db.sqlite.prepare("SELECT COUNT(*) AS count FROM " + table).get()!.count); }

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T22:30:00.000Z"));
  db = new SqliteD1();
  const directory = resolve(process.cwd(), "migrations");
  for (const filename of readdirSync(directory).filter((name) => /^000[1-8]_.*\.sql$/u.test(name)).sort()) {
    db.sqlite.exec(readFileSync(resolve(directory, filename), "utf8"));
  }
  db.sqlite.exec("INSERT INTO pl_profiles (id, display_name, created_at, updated_at) VALUES ('other', 'Other', '2026-01-01', '2026-01-01')");
  for (const [id, polish, meaning, topic, order] of samples) {
    db.sqlite.prepare("INSERT INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at) VALUES (?, 'word', ?, ?, '', '', ?, '[]', ?, 'vocab-test', 'published', '2026-01-01')").run(id, polish, meaning, topic, JSON.stringify([polish]));
    db.sqlite.prepare("INSERT INTO pl_vocabulary_details (item_id, example_pl, example_ja, sort_order) VALUES (?, ?, ?, ?)").run(id, "Poproszę " + polish + ".", meaning + "をください。", order);
  }
});
afterEach(() => { db.sqlite.close(); vi.useRealTimers(); });

describe("vocabulary API", () => {
  it("starts with five globally ordered new words and filters the word library", async () => {
    const summary = (await jsonApi("/vocabulary")).body as VocabularySummary;
    expect(summary).toMatchObject({ total: 6, started: 0, remembered: 0, due: 0, learnedToday: 0 });
    expect(summary.progress).toMatchObject({ today: "2026-10-03", dailyGoal: 5, totalPoints: 0, level: 1, currentStreak: 0, longestStreak: 0, totalStudyDays: 0 });
    expect(summary.progress.activity).toHaveLength(28);
    expect(summary.today.map((word) => word.polish)).toEqual(["chleb", "woda", "mleko", "kawa", "sklep"]);
    expect(summary.topics.find((topic) => topic.id === "supermarket")).toMatchObject({ total: 4, started: 0 });
    expect((await jsonApi("/vocabulary/words?search=水")).body.map((word: VocabularyWord) => word.polish)).toEqual(["woda"]);
    expect((await jsonApi("/vocabulary/queue?mode=learn&topic=cafe")).body.map((word: VocabularyWord) => word.polish)).toEqual(["kawa"]);
  });

  it("persists ratings separately from legacy correctness and schedules again for fifteen minutes", async () => {
    const result = await rate("v-test-1", "again", "review-one");
    expect(result.status).toBe(200);
    expect(result.body.word.state).toMatchObject({ lastRating: "again", dueAt: "2026-10-02T22:45:00.000Z", repetitions: 0, lapses: 1 });
    expect(count("pl_vocabulary_reviews")).toBe(1);
    expect(count("pl_vocabulary_states")).toBe(1);
    expect(count("pl_attempts")).toBe(0);
    expect(count("pl_review_states")).toBe(0);
    expect((await jsonApi("/vocabulary/words?state=learning")).body).toHaveLength(1);
    expect((await jsonApi("/vocabulary/queue?mode=learn")).body.map((word: VocabularyWord) => word.polish)).toEqual(["woda", "mleko", "kawa", "sklep", "dom"]);
  });

  it("handles concurrent retry requests exactly once and rejects a conflicting key", async () => {
    const [first, second] = await Promise.all([rate("v-test-1", "known", "same-key"), rate("v-test-1", "known", "same-key")]);
    expect(first.body.eventId).toBe(second.body.eventId);
    expect(count("pl_vocabulary_reviews")).toBe(1);
    expect(second.body.word.state.repetitions).toBe(1);
    expect((await rate("v-test-1", "again", "same-key")).status).toBe(409);
    expect((await rate("v-test-2", "known", "same-key")).status).toBe(409);
    expect(count("pl_vocabulary_reviews")).toBe(1);
  });

  it("uses the latest stored interval during simultaneous distinct reviews", async () => {
    await Promise.all([rate("v-test-1", "known", "first"), rate("v-test-1", "known", "second")]);
    const words = (await jsonApi("/vocabulary/words?state=remembered")).body as VocabularyWord[];
    expect(words[0].state).toMatchObject({ intervalDays: 2.5, repetitions: 2, dueAt: "2026-10-05T10:30:00.000Z" });
    expect(count("pl_vocabulary_reviews")).toBe(2);
  });

  it("returns only due reviews while explicit practice leaves a future due date intact", async () => {
    await rate("v-test-1", "known", "known");
    await rate("v-test-2", "again", "again");
    expect((await jsonApi("/vocabulary/queue?mode=review")).body).toEqual([]);
    const explicit = (await jsonApi("/vocabulary/queue?mode=review&wordId=v-test-1")).body as VocabularyWord[];
    expect(explicit.map((word) => word.polish)).toEqual(["chleb"]);
    expect(explicit[0].state?.dueAt).toBe("2026-10-03T22:30:00.000Z");
    vi.setSystemTime(new Date("2026-10-02T22:46:00.000Z"));
    expect((await jsonApi("/vocabulary/queue?mode=review")).body.map((word: VocabularyWord) => word.polish)).toEqual(["woda"]);
    expect((await jsonApi("/vocabulary")).body.due).toBe(1);
  });

  it("keeps a successful retry at least one day away and caps long intervals at one year", async () => {
    await rate("v-test-1", "again", "forgot");
    const retry = await rate("v-test-1", "known", "remembered");
    expect(retry.body.word.state).toMatchObject({ intervalDays: 1, dueAt: "2026-10-03T22:30:00.000Z", lapses: 1 });
    db.sqlite.prepare("UPDATE pl_vocabulary_states SET interval_days = 300 WHERE profile_id = 'master' AND item_id = 'v-test-1'").run();
    const longReview = await rate("v-test-1", "known", "long-interval");
    expect(longReview.body.word.state.intervalDays).toBe(365);
  });

  it("keeps the original curriculum counts and legacy due queues separate", async () => {
    await rate("v-test-1", "known", "vocab-only");
    await add("personal-word");
    const summary = (await jsonApi("/status")).body;
    expect(summary.curriculum).toMatchObject({ publishedItemCount: 492, a1ItemCount: 132, a2ItemCount: 360 });
    expect(summary.tracks.map((track: { itemCount: number }) => track.itemCount)).toEqual([132, 360]);
    expect(summary.progress).toMatchObject({ learnedItems: 0, masteredItems: 0, dueReviews: 0 });
    expect((await jsonApi("/reviews/due")).body).toEqual([]);
    const legacyWords = (await jsonApi("/items")).body as VocabularyWord[];
    expect(legacyWords).toHaveLength(492);
    expect(legacyWords.some((word) => word.id.startsWith("v-test-") || word.id.startsWith("personal-word-"))).toBe(false);
    expect((await jsonApi("/items?type=word")).body).toEqual([]);
    const attempt = await jsonApi("/attempts", { method: "POST", body: { itemId: "v-test-1", answer: "chleb", idempotencyKey: "legacy-vocab", questionType: "multiple_choice", direction: "polish_to_meaning" } });
    expect(attempt.status).toBe(404);
    expect(count("pl_attempts")).toBe(0);
  });

  it("deduplicates personal words, persists their examples, and makes them immediately usable", async () => {
    const first = await add("add-one", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ polish: "ser", meaningJa: "チーズ", personal: true, state: null, examplePl: "Poproszę ser." });
    expect((await add("add-one", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" })).body.id).toBe(first.body.id);
    expect((await add("add-two", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" })).body.id).toBe(first.body.id);
    expect(count("pl_vocabulary_details")).toBe(7);
    expect((await jsonApi("/vocabulary/words?personal=true")).body).toHaveLength(1);
    const queue = (await jsonApi("/vocabulary/queue?wordId=" + first.body.id)).body;
    expect(queue[0].id).toBe(first.body.id);
    expect((await rate(first.body.id, "known", "personal-review")).status).toBe(200);
  });

  it("rejects conflicting duplicate details without discarding input or reserving the retry key", async () => {
    const first = await add("original", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" });
    for (const fields of [
      { topic: "cafe", examplePl: "Poproszę ser.", exampleJa: "チーズをください。" },
      { examplePl: "Lubię ser.", exampleJa: "チーズが好きです。" },
      { examplePl: "Poproszę ser.", exampleJa: "チーズをお願いします。" },
    ]) {
      const rejected = await add("different-details", "master", fields);
      expect(rejected.status).toBe(409);
      expect(rejected.body.message).toContain("場面や例文が異なる");
    }
    expect(count("pl_vocabulary_word_requests")).toBe(1);
    const words = (await jsonApi("/vocabulary/words?personal=true")).body;
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ topic: "supermarket", examplePl: "Poproszę ser.", exampleJa: "チーズをください。" });
    const corrected = await add("different-details", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" });
    expect(corrected.status).toBe(201);
    expect(corrected.body.id).toBe(first.body.id);
    expect((await add("original", "master", { examplePl: "Poproszę ser.", exampleJa: "チーズをください。" })).body.id).toBe(first.body.id);
  });

  it("makes concurrent conflicting additions return one success and one explicit conflict", async () => {
    const results = await Promise.all([
      add("concurrent-one", "master", { examplePl: "Poproszę ser." }),
      add("concurrent-two", "master", { examplePl: "Lubię ser." }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(count("pl_vocabulary_word_requests")).toBe(1);
    expect((await jsonApi("/vocabulary/words?personal=true")).body).toHaveLength(1);
  });

  it("isolates personal words and states from every other profile and rejects owner override", async () => {
    const personal = (await add("add-owner")).body as VocabularyWord;
    await rate(personal.id, "known", "owner-rating");
    const summary = (await jsonApi("/vocabulary", { profile: "other" })).body as VocabularySummary;
    expect(summary).toMatchObject({ total: 6, started: 0, remembered: 0, learnedToday: 0 });
    expect((await jsonApi("/vocabulary/words?personal=true", { profile: "other" })).body).toEqual([]);
    expect((await jsonApi("/vocabulary/queue?wordId=" + personal.id, { profile: "other" })).status).toBe(404);
    expect((await rate(personal.id, "known", "foreign-rating", "other")).status).toBe(404);
    const legacyItems = (await jsonApi("/items", { profile: "other" })).body;
    expect(legacyItems.some((word: VocabularyWord) => word.id === personal.id)).toBe(false);
    const legacyAttempt = await jsonApi("/attempts", { profile: "other", method: "POST", body: { itemId: personal.id, answer: "ser", idempotencyKey: "foreign-typed", questionType: "multiple_choice", direction: "polish_to_meaning" } });
    expect(legacyAttempt.status).toBe(404);
    const sameKeyOtherProfile = await rate("v-test-1", "known", "owner-rating", "other");
    expect(sameKeyOtherProfile.status).toBe(200);
    expect((await jsonApi("/vocabulary", { profile: "other" })).body.started).toBe(1);
  });

  it("exports only owned personal words and vocabulary states without claiming correctness", async () => {
    const own = (await add("my-add")).body as VocabularyWord;
    const foreign = (await add("their-add", "other", { polish: "paragon", meaningJa: "レシート" })).body as VocabularyWord;
    await rate(own.id, "known", "my-review"); await rate(foreign.id, "again", "their-review", "other");
    const exported = (await jsonApi("/export")).body;
    expect(exported.data.pl_vocabulary_reviews).toHaveLength(1);
    expect(exported.data.pl_vocabulary_states).toHaveLength(1);
    expect(exported.data.pl_vocabulary_learning_items).toHaveLength(7);
    expect(exported.data.pl_personal_learning_items.map((row: { id: string }) => row.id)).toEqual([own.id]);
    expect(JSON.stringify(exported)).not.toContain(foreign.id);
    const csv = await (await fetchApi("/export?format=csv")).text();
    expect(csv).toContain('"vocabulary_review"');expect(csv).toContain('"vocabulary_state"');expect(csv).toContain('"vocabulary_details"');expect(csv).toContain('"vocabulary_word"');
    expect(csv).not.toContain(foreign.id);
    expect(exported.data.pl_attempts).toEqual([]);
  });

  it("counts distinct daily words at Warsaw midnight and limits recent reviews", async () => {
    vi.setSystemTime(new Date("2026-10-02T21:59:00.000Z"));await rate("v-test-1", "known", "yesterday");
    vi.setSystemTime(new Date("2026-10-02T22:01:00.000Z"));await rate("v-test-2", "again", "today-first");await rate("v-test-2", "known", "today-second");
    expect((await jsonApi("/vocabulary")).body.learnedToday).toBe(1);
    for (let index = 0; index < 22; index++) await rate("v-test-2", "again", "today-extra-" + index);
    expect((await jsonApi("/vocabulary")).body.recentReviews).toHaveLength(20);
    expect(vocabularyDateKey("2026-10-02T22:01:00.000Z")).toBe("2026-10-03");
    expect(vocabularyDateKey("2026-01-02T22:30:00.000Z")).toBe("2026-01-02");
  });

  it("restores progress from all saved history while keeping retries and repeated same-day ratings to one point", async () => {
    for (let index = 0; index < 35; index++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 7, 1 + index, 12)));
      await rate("v-test-1", "known", "history-" + index);
    }
    vi.setSystemTime(new Date("2026-10-02T21:59:00.000Z"));
    await rate("v-test-1", "again", "yesterday-again");
    vi.setSystemTime(new Date("2026-10-02T22:01:00.000Z"));
    await rate("v-test-1", "again", "today-again");
    await rate("v-test-1", "again", "today-again");
    await rate("v-test-1", "known", "today-known");
    await rate("v-test-2", "known", "today-new");
    const summary = (await jsonApi("/vocabulary")).body as VocabularySummary;
    expect(summary.learnedToday).toBe(2);
    expect(summary.recentReviews).toHaveLength(20);
    expect(summary.progress).toMatchObject({
      today: "2026-10-03", totalPoints: 38, level: 4, pointsIntoLevel: 8, pointsToNextLevel: 2,
      currentStreak: 2, longestStreak: 35, totalStudyDays: 37,
    });
    expect(summary.progress.activity.slice(-2)).toEqual([
      { date: "2026-10-02", words: 1, newWords: 0, reviews: 1 },
      { date: "2026-10-03", words: 2, newWords: 1, reviews: 3 },
    ]);
    expect(count("pl_attempts")).toBe(0);
    expect(count("pl_review_states")).toBe(0);
    vi.setSystemTime(new Date("2026-10-03T22:01:00.000Z"));
    await rate("v-test-1", "known", "tomorrow-review");
    const nextDay = (await jsonApi("/vocabulary")).body as VocabularySummary;
    expect(nextDay.progress).toMatchObject({ totalPoints: 39, currentStreak: 3 });
    expect(nextDay.progress.activity.at(-1)).toEqual({ date: "2026-10-04", words: 1, newWords: 0, reviews: 1 });
  });

  it("keeps progress profile-owned and excludes foreign, unpublished, non-word, and future events", async () => {
    await rate("v-test-1", "known", "master-visible");
    const own = (await add("own-progress")).body as VocabularyWord;
    const foreign = (await add("foreign-progress", "other", { polish: "paragon", meaningJa: "レシート" })).body as VocabularyWord;
    await rate(own.id, "again", "own-progress-review");
    await rate("v-test-2", "known", "other-global", "other");
    await rate(foreign.id, "known", "other-private", "other");
    // Even malformed imported history must not make another profile's private word visible.
    db.sqlite.prepare("INSERT INTO pl_vocabulary_reviews (id, profile_id, item_id, idempotency_key, rating, elapsed_ms, created_at, due_at) VALUES ('foreign-history', 'master', ?, 'foreign-history', 'known', 0, ?, ?)")
      .run(foreign.id, new Date().toISOString(), new Date().toISOString());
    await rate("v-test-3", "known", "unpublished-review");
    await rate("v-test-4", "known", "non-word-review");
    db.sqlite.prepare("UPDATE pl_learning_items SET status = 'draft' WHERE id = 'v-test-3'").run();
    db.sqlite.prepare("UPDATE pl_learning_items SET type = 'phrase' WHERE id = 'v-test-4'").run();
    vi.setSystemTime(new Date("2026-10-02T22:31:00.000Z"));
    await rate("v-test-5", "known", "future-review");
    vi.setSystemTime(new Date("2026-10-02T22:30:00.000Z"));
    const summary = (await jsonApi("/vocabulary")).body as VocabularySummary;
    expect(summary.progress).toMatchObject({ totalPoints: 2, totalStudyDays: 1, currentStreak: 1 });
    expect(summary.progress.activity.at(-1)).toEqual({ date: "2026-10-03", words: 2, newWords: 2, reviews: 2 });
    expect(summary.recentReviews.map((review) => review.wordId).sort()).toEqual(["v-test-1", own.id].sort());
    const other = (await jsonApi("/vocabulary", { profile: "other" })).body as VocabularySummary;
    expect(other.progress.totalPoints).toBe(2);
    expect(other.recentReviews.map((review) => review.wordId).sort()).toEqual(["v-test-2", foreign.id].sort());
  });

  it("rolls back both the event and the state if one operation fails", async () => {
    db.failBatchAt = 1;
    expect((await rate("v-test-1", "known", "interrupted")).status).toBe(400);
    expect(count("pl_vocabulary_reviews")).toBe(0);expect(count("pl_vocabulary_states")).toBe(0);
    db.failBatchAt = -1;
    expect((await rate("v-test-1", "known", "interrupted")).status).toBe(200);
    expect(count("pl_vocabulary_reviews")).toBe(1);
  });

  it("validates bad fields and allows short multiword lexemes", async () => {
    expect((await jsonApi("/vocabulary/queue?limit=0")).status).toBe(400);
    expect((await jsonApi("/vocabulary/queue?limit=21")).status).toBe(400);
    expect((await jsonApi("/vocabulary/queue?mode=unknown")).status).toBe(400);
    expect((await jsonApi("/vocabulary/words?topic=unknown")).status).toBe(400);
    expect((await add("long", "master", { polish: "a".repeat(81) })).status).toBe(400);
    expect((await add("sentence", "master", { polish: "Poproszę mleko." })).status).toBe(400);
    expect((await add("empty", "master", { meaningJa: " " })).status).toBe(400);
    expect((await add("phrase", "master", { polish: "dworzec kolejowy", meaningJa: "鉄道駅", topic: "transport" })).status).toBe(201);
    expect((await add("phrase", "master", { polish: "przystanek", meaningJa: "停留所", topic: "transport" })).status).toBe(409);
  });
});
