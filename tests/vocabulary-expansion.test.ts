import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import worker from "../worker/index";
import { loadVocabularyBatches, normalizeHeadword, renderVocabularyMigration, validateVocabularyCollection } from "../scripts/generate-vocabulary.mjs";

const batches = loadVocabularyBatches();
const sources = batches.map((batch) => batch.source);
const words = sources.flatMap((source) => source.topics.flatMap((topic) => topic.words));
const expansionSql = readFileSync(resolve("migrations/0011_vocabulary_expansion.sql"), "utf8");

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]) {
    this.sqlite.exec("BEGIN");
    try { const results = statements.map((s) => s.runSync()); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
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
async function call(db: SqliteD1, path: string, body?: unknown, expectedStatus = 200) {
  const response = await worker.fetch(new Request("https://polski.test/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }), { DB: db as unknown as D1Database, APP_ENV: "local", PROFILE_ID: "master", ASSETS: {} as Fetcher }, {} as ExecutionContext);
  expect(response.status).toBe(expectedStatus);
  return response.json();
}
function baseDatabase() {
  const db = new SqliteD1();
  for (const name of readdirSync(resolve("migrations")).filter((name) => /^\d{4}_.*\.sql$/u.test(name) && !name.startsWith("0011_")).sort()) {
    db.sqlite.exec(readFileSync(resolve("migrations", name), "utf8"));
  }
  return db;
}
afterEach(() => { vi.useRealTimers(); });

describe("everyday vocabulary expansion", () => {
  it("covers 600 different lemmas in eight daily situations with complete original examples", () => {
    expect(validateVocabularyCollection(sources)).toEqual([]);
    expect(words).toHaveLength(600);
    expect(new Set(words.map((word) => normalizeHeadword(word.polish))).size).toBe(600);
    for (const topic of sources[0].topics) {
      expect(sources.flatMap((source) => source.topics.find((t) => t.id === topic.id)!.words)).toHaveLength(75);
    }
    for (const word of words) {
      expect(word.grammarNote.trim()).not.toBe("");
      expect(word.examplePl).toMatch(/[.!?]$/u);
      expect(word.exampleJa).toMatch(/[。？！]$/u);
      expect(word.meaningJa).toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|^ATM$/u);
    }
    const lemmas = new Set(words.map((word) => word.polish));
    for (const lemma of ["być", "mieć", "chcieć", "móc", "musieć", "wiedzieć", "robić", "czekać", "brać", "dawać", "prosić", "dziękować", "szukać", "wracać", "w", "na", "do", "z", "bez", "dla", "jechać", "kupować", "jeść", "dobry", "poniedziałek", "styczeń", "pięć", "gdzie", "dlaczego", "deszcz", "telefon"]) {
      expect(lemmas.has(lemma), lemma).toBe(true);
    }
  });

  it("rejects duplicate lemmas and IDs across versions before rendering any migration", () => {
    const invalid = structuredClone(sources);
    invalid[1].topics[0].words[0] = structuredClone(invalid[0].topics[0].words[0]);
    const failures = validateVocabularyCollection(invalid).join("\n");
    expect(failures).toContain("duplicate ID across vocabulary versions");
    expect(failures).toContain("duplicate normalized headword across vocabulary versions");
    expect(() => renderVocabularyMigration(sources[1], { startOrder: -1 })).toThrow("startOrder");
  });

  it("adds only 520 new seeds after the old 80 without updates or destructive SQL", () => {
    expect(renderVocabularyMigration(sources[1], batches[1].options)).toBe(expansionSql);
    const statements = expansionSql.replace(/^--.*$/gmu, "").split(";\n").map((s) => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(1041);
    expect(statements.every((s) => /^INSERT OR IGNORE INTO pl_(content_versions|learning_items|vocabulary_details)\b/u.test(s))).toBe(true);
    const db = baseDatabase();
    try {
      const before = db.sqlite.prepare("SELECT * FROM pl_learning_items ORDER BY id").all();
      db.sqlite.exec(expansionSql);
      const row = db.sqlite.prepare("SELECT COUNT(*) AS count, MIN(sort_order) AS first_order, MAX(sort_order) AS last_order FROM pl_vocabulary_details WHERE sort_order > 80").get();
      expect(row).toMatchObject({ count: 520, first_order: 81, last_order: 600 });
      expect(db.sqlite.prepare("SELECT * FROM pl_learning_items WHERE content_version <> 'vocabulary-2026.2' ORDER BY id").all()).toEqual(before);
      expect(db.sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.sqlite.close(); }
  });

  it("preserves personal words, review/test history, first mastery date, and the next learning queue on upgrade and retry", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    const db = baseDatabase();
    try {
      const wordId = "voc-supermarket-chleb";
      await call(db, "/vocabulary/words", { polish: "notes", meaningJa: "メモ帳", topic: "errands", idempotencyKey: "personal-before-upgrade" }, 201);
      await call(db, "/vocabulary/reviews", { wordId, rating: "known", idempotencyKey: "before-upgrade" });
      for (const days of [1, 3, 7]) {
        vi.setSystemTime(new Date(Date.now() + days * 86_400_000));
        const start = await call(db, "/vocabulary/tests/start", { mode: "due", wordId, limit: 1, idempotencyKey: crypto.randomUUID() });
        await call(db, "/vocabulary/tests/answer", { questionId: start.questions[0].id, answer: "chleb", idempotencyKey: crypto.randomUUID() });
      }
      const before = await call(db, "/vocabulary");
      const queueBefore = await call(db, "/vocabulary/queue?mode=learn&limit=5");
      const historyTables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'pl_%' AND name NOT IN ('pl_learning_items','pl_vocabulary_details','pl_content_versions') ORDER BY name").all().map((row) => String(row.name));
      const history = historyTables.map((table) => db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY rowid").all());
      const details = db.sqlite.prepare("SELECT * FROM pl_vocabulary_details ORDER BY item_id").all();
      db.sqlite.exec(expansionSql); db.sqlite.exec(expansionSql);
      const after = await call(db, "/vocabulary");
      expect(after).toMatchObject({ total: 601, started: 1, remembered: 1 });
      expect(after.topics.map((topic) => topic.total)).toEqual([75, 75, 75, 75, 75, 76, 75, 75]);
      expect(after.retention.mastery).toEqual(before.retention.mastery);
      expect(after.retention.mastery).toMatchObject({ total: 1, verified: 1, recheck: 0 });
      expect(after.progress).toEqual(before.progress);
      expect(after.recentReviews).toEqual(before.recentReviews);
      expect(after.today).toEqual(before.today);
      expect(await call(db, "/vocabulary/queue?mode=learn&limit=5")).toEqual(queueBefore);
      expect((await call(db, "/vocabulary/words?personal=true"))).toHaveLength(1);
      expect(historyTables.map((table) => db.sqlite.prepare("SELECT * FROM " + table + " ORDER BY rowid").all())).toEqual(history);
      expect(db.sqlite.prepare("SELECT * FROM pl_vocabulary_details WHERE item_id IN (SELECT id FROM pl_learning_items WHERE content_version <> 'vocabulary-2026.2') ORDER BY item_id").all()).toEqual(details);
      expect(db.sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.sqlite.close(); }
  });
});
