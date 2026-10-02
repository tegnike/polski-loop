import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHeadword, renderVocabularyMigration, validateVocabulary, vocabularyTopicIds } from "../scripts/generate-vocabulary.mjs";

interface VocabularyWord {
  id: string;
  type: string;
  polish: string;
  meaningJa: string;
  meaningEn: string;
  grammarNote: string;
  tags: string[];
  acceptedAnswers: string[];
  examplePl: string;
  exampleJa: string;
}
interface VocabularySource {
  version: string;
  topics: Array<{ id: string; titleJa: string; titlePl: string; words: VocabularyWord[] }>;
}

const root = process.cwd();
const source = JSON.parse(readFileSync(resolve(root, "content/vocabulary.json"), "utf8")) as VocabularySource;
const migration = readFileSync(resolve(root, "migrations/0009_vocabulary_content.sql"), "utf8");
const words = source.topics.flatMap((topic) => topic.words.map((word) => ({ ...word, topic: topic.id })));
const existingMigrations = readdirSync(resolve(root, "migrations"))
  .filter((name) => /^000[1-8]_.*\.sql$/u.test(name))
  .sort()
  .map((name) => readFileSync(resolve(root, "migrations", name), "utf8"))
  .join("\n");

function queryMemoryDb(sql: string, seed = migration): Array<Record<string, unknown>> {
  // Every SQL operation is confined to a new, discarded in-memory database.
  const output = execFileSync("sqlite3", ["-json", ":memory:"], {
    input: `.bail on\n${existingMigrations}\n${seed}\n${sql}`,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return output.trim() ? JSON.parse(output) as Array<Record<string, unknown>> : [];
}

describe("practical vocabulary content", () => {
  it("covers eight distinct daily situations with single lemmas, meanings, and usage examples", () => {
    expect(validateVocabulary(source)).toEqual([]);
    expect(source.version).toBe("vocabulary-2026.1");
    expect(source.topics.map((topic) => topic.id)).toEqual(vocabularyTopicIds);
    expect(words).toHaveLength(80);
    expect(new Set(words.map((word) => normalizeHeadword(word.polish))).size).toBe(80);
    expect(words.slice(0, 5).map((word) => word.polish)).toEqual(["chleb", "woda", "mleko", "kawa", "sklep"]);
    for (const topic of source.topics) {
      expect(topic.words).toHaveLength(10);
      for (const word of topic.words) {
        expect(word.type).toBe("word");
        expect(word.id).toMatch(new RegExp(`^voc-${topic.id}-[a-z]+$`, "u"));
        expect(word.polish).toMatch(/^[\p{L}]+$/u);
        expect(word.meaningJa).toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
        expect(word.meaningEn.trim().length).toBeGreaterThan(0);
        expect(word.examplePl).toMatch(/[.!?]$/u);
        expect(word.exampleJa).toMatch(/[。？！]$/u);
        expect(word.tags).toContain(`scene:${topic.id}`);
        expect(word.acceptedAnswers).toContain(word.polish);
      }
    }
    const byLemma = new Map(words.map((word) => [word.polish, word]));
    expect(byLemma.get("drzwi")?.grammarNote).toContain("複数形");
    expect(byLemma.get("mężczyzna")?.grammarNote).toContain("男性名詞");
    expect(byLemma.get("woda")?.examplePl).toBe("Proszę wodę.");
    expect(byLemma.get("dziś")?.acceptedAnswers).toContain("dzisiaj");
  });

  it("rejects blank translations or examples, duplicate lemmas, wrong IDs, and missing canonical answers", () => {
    const invalid = structuredClone(source);
    invalid.topics[0].words[0].meaningJa = " ";
    invalid.topics[0].words[0].examplePl = "";
    invalid.topics[1].words[0].polish = "  CHLEB ";
    invalid.topics[1].words[1].id = "lesson-item-to-overwrite";
    invalid.topics[1].words[2].acceptedAnswers = ["inna"];
    const failures = validateVocabulary(invalid).join("\n");
    expect(failures).toContain("meaningJa must be nonempty");
    expect(failures).toContain("examplePl must be nonempty");
    expect(failures).toContain("duplicate normalized headword");
    expect(failures).toContain("ID must match its topic and lemma");
    expect(failures).toContain("acceptedAnswers must include the headword");
    expect(() => renderVocabularyMigration(invalid)).toThrow();
  });

  it("stores every authored word and example with intact foreign keys and deterministic order", () => {
    expect(renderVocabularyMigration(source)).toBe(migration);
    expect(execFileSync(process.execPath, ["scripts/generate-vocabulary.mjs", "--check"], { cwd: root, encoding: "utf8" })).toContain("PASS");
    const rows = queryMemoryDb("SELECT i.id, i.type, i.polish, i.meaning_ja, i.meaning_en, i.grammar_note, i.topic, i.tags_json, i.accepted_answers_json, i.content_version, d.example_pl, d.example_ja, d.owner_profile_id, d.sort_order FROM pl_learning_items i JOIN pl_vocabulary_details d ON d.item_id=i.id ORDER BY d.sort_order;");
    expect(rows).toEqual(words.map((word, index) => ({
      id: word.id,
      type: "word",
      polish: word.polish,
      meaning_ja: word.meaningJa,
      meaning_en: word.meaningEn,
      grammar_note: word.grammarNote,
      topic: word.topic,
      tags_json: JSON.stringify(word.tags),
      accepted_answers_json: JSON.stringify(word.acceptedAnswers),
      content_version: source.version,
      example_pl: word.examplePl,
      example_ja: word.exampleJa,
      owner_profile_id: null,
      sort_order: index + 1,
    })));
    expect(queryMemoryDb("PRAGMA foreign_key_check;")).toEqual([]);
  });

  it("adds seeds idempotently while preserving all existing lesson rows and steps", () => {
    const copies = "CREATE TEMP TABLE original_items AS SELECT * FROM pl_learning_items;\nCREATE TEMP TABLE original_steps AS SELECT * FROM pl_lesson_steps;\n";
    const rows = queryMemoryDb("SELECT (SELECT COUNT(*) FROM original_items) AS original_items, (SELECT COUNT(*) FROM pl_learning_items WHERE type <> 'word' AND status='published') AS lesson_items, (SELECT COUNT(*) FROM pl_learning_items WHERE type='word') AS words, (SELECT COUNT(*) FROM pl_vocabulary_details) AS details, (SELECT COUNT(*) FROM (SELECT * FROM original_items EXCEPT SELECT * FROM pl_learning_items)) AS changed_items, (SELECT COUNT(*) FROM (SELECT * FROM original_steps EXCEPT SELECT * FROM pl_lesson_steps)) AS changed_steps;", `${copies}${migration}\n${migration}`);
    expect(rows).toEqual([{ original_items: 492, lesson_items: 492, words: 80, details: 80, changed_items: 0, changed_steps: 0 }]);
    const statements = migration.replace(/^--.*$/gmu, "").split(";\n").map((statement) => statement.trim()).filter(Boolean);
    expect(statements).toHaveLength(161);
    expect(statements.every((statement) => /^INSERT OR IGNORE INTO pl_(content_versions|learning_items|vocabulary_details)\b/u.test(statement))).toBe(true);
  });

  it("quotes apostrophes so authored text cannot become SQL statements", () => {
    const withQuotes = structuredClone(source);
    withQuotes.topics[0].words[0].meaningEn = "bread'; DELETE FROM pl_learning_items; --";
    withQuotes.topics[0].words[0].examplePl = "To jest 'chleb'.";
    withQuotes.topics[0].titleJa = "スーパー\nDELETE FROM pl_learning_items;";
    const rows = queryMemoryDb("SELECT meaning_en, (SELECT example_pl FROM pl_vocabulary_details WHERE item_id='voc-supermarket-chleb') AS example_pl, (SELECT COUNT(*) FROM pl_learning_items) AS item_count FROM pl_learning_items WHERE id='voc-supermarket-chleb';", renderVocabularyMigration(withQuotes));
    expect(rows).toEqual([{ meaning_en: withQuotes.topics[0].words[0].meaningEn, example_pl: withQuotes.topics[0].words[0].examplePl, item_count: 572 }]);
  });
});
