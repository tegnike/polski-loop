import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const vocabularyTopicIds = ["supermarket", "cafe", "transport", "home", "health", "errands", "people", "time"];

export function normalizeHeadword(value) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("pl");
}

function headwordSlug(value) {
  return normalizeHeadword(value).replaceAll("ł", "l").normalize("NFD").replace(/\p{M}/gu, "");
}

export function validateVocabulary(source) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const nonempty = (value) => typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
  check(typeof source?.version === "string" && /^vocabulary-\d{4}\.\d+$/u.test(source.version), "Vocabulary version must use vocabulary-YYYY.N.");
  check(Array.isArray(source?.topics), "Vocabulary topics must be an array.");
  const topics = Array.isArray(source?.topics) ? source.topics : [];
  check(JSON.stringify(topics.map((topic) => topic?.id)) === JSON.stringify(vocabularyTopicIds), "Vocabulary must contain the eight ordered everyday topics.");
  const ids = new Set();
  const headwords = new Set();
  for (const topic of topics) {
    check(nonempty(topic?.titleJa) && nonempty(topic?.titlePl), `${topic?.id}: topic labels must be nonempty.`);
    check(Array.isArray(topic?.words) && topic.words.length > 0, `${topic?.id}: each topic must contain words.`);
    for (const word of Array.isArray(topic?.words) ? topic.words : []) {
      for (const field of ["id", "polish", "meaningJa", "meaningEn", "examplePl", "exampleJa"]) {
        check(nonempty(word?.[field]), `${word?.id ?? topic?.id}: ${field} must be nonempty.`);
      }
      check(typeof word?.grammarNote === "string" && !word.grammarNote.includes("\0"), `${word?.id}: grammarNote must be a string.`);
      check(word?.type === "word", `${word?.id}: type must be word.`);
      const headword = nonempty(word?.polish) ? normalizeHeadword(word.polish) : "";
      check(/^[\p{L}]+$/u.test(headword), `${word?.id}: use a single lemma, not a sentence.`);
      check(word?.polish === headword, `${word?.id}: headword must use a lowercase, trimmed spelling.`);
      check(word?.id === `voc-${topic?.id}-${headwordSlug(headword)}`, `${word?.id}: ID must match its topic and lemma.`);
      check(!ids.has(word?.id), `${word?.id}: duplicate ID.`);
      check(!headwords.has(headword), `${word?.id}: duplicate normalized headword.`);
      ids.add(word?.id);
      headwords.add(headword);
      const tags = Array.isArray(word?.tags) ? word.tags : [];
      check(tags.length >= 2 && tags.every(nonempty) && new Set(tags).size === tags.length, `${word?.id}: tags must be unique nonempty strings.`);
      check(tags.includes("vocabulary") && tags.includes(`scene:${topic?.id}`), `${word?.id}: vocabulary and topic tags are required.`);
      const answers = Array.isArray(word?.acceptedAnswers) ? word.acceptedAnswers : [];
      check(answers.length >= 1 && answers.every(nonempty), `${word?.id}: acceptedAnswers must be nonempty strings.`);
      const normalizedAnswers = answers.filter(nonempty).map(normalizeHeadword);
      check(normalizedAnswers.includes(headword), `${word?.id}: acceptedAnswers must include the headword.`);
      check(new Set(normalizedAnswers).size === answers.length, `${word?.id}: acceptedAnswers must be unique.`);
      check(normalizedAnswers.every((answer) => /^[\p{L}]+$/u.test(answer)), `${word?.id}: acceptedAnswers must be single lemmas.`);
      check(typeof word?.examplePl === "string" && word.examplePl.trim().split(/\s+/u).length >= 2, `${word?.id}: examplePl must be a short usage sentence.`);
    }
  }
  return failures;
}

export function validateVocabularyCollection(sources) {
  const failures = sources.flatMap(validateVocabulary);
  const ids = new Set();
  const headwords = new Set();
  for (const source of sources) {
    for (const topic of Array.isArray(source?.topics) ? source.topics : []) {
      for (const word of Array.isArray(topic?.words) ? topic.words : []) {
        const headword = typeof word?.polish === "string" ? normalizeHeadword(word.polish) : "";
        if (ids.has(word?.id)) failures.push(`${word?.id}: duplicate ID across vocabulary versions.`);
        if (headwords.has(headword)) failures.push(`${word?.id}: duplicate normalized headword across vocabulary versions.`);
        ids.add(word?.id);
        headwords.add(headword);
      }
    }
  }
  return failures;
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderVocabularyMigration(source, { startOrder = 0, sourceName = "content/vocabulary.json" } = {}) {
  const failures = validateVocabulary(source);
  if (!Number.isInteger(startOrder) || startOrder < 0) failures.push("startOrder must be a nonnegative integer.");
  if (failures.length) throw new Error(failures.join("\n"));
  const count = source.topics.reduce((total, topic) => total + topic.words.length, 0);
  const sizes = new Set(source.topics.map((topic) => topic.words.length));
  const notes = `生活で使う単語${count}語。${source.topics.length}場面${sizes.size === 1 ? `・各${[...sizes][0]}語` : ""}、独自例文つき。既存カリキュラムとは独立して学習する。`;
  const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const lines = [
    `-- Generated from ${sourceName.replace(/[\r\n]/gu, " ")} by node scripts/generate-vocabulary.mjs.`,
    "-- Check without rewriting: node scripts/generate-vocabulary.mjs --check",
    "-- Adds vocabulary only; existing lessons, answers, and learning history are preserved.",
    `INSERT OR IGNORE INTO pl_content_versions (version, track_id, status, notes, created_at) VALUES (${sqlQuote(source.version)}, 'track-a1', 'published', ${sqlQuote(notes)}, ${now});`,
    "",
  ];
  let order = startOrder;
  for (const topic of source.topics) {
    lines.push(`-- ${topic.id}: ${topic.titleJa.replace(/[\r\n]/gu, " ")}`);
    for (const word of topic.words) {
      order += 1;
      const values = [word.id, word.type, word.polish, word.meaningJa, word.meaningEn, word.grammarNote, topic.id, JSON.stringify(word.tags), JSON.stringify(word.acceptedAnswers), source.version, "published"].map(sqlQuote);
      values.push(now, ...["A1", JSON.stringify(["listening", "spoken_production"]), topic.id, "neutral", "any", "learner", "independent"].map(sqlQuote));
      lines.push(`INSERT OR IGNORE INTO pl_learning_items (id, type, polish, meaning_ja, meaning_en, grammar_note, topic, tags_json, accepted_answers_json, content_version, status, created_at, cefr_level, skills_json, scene, register, speaker_gender, dialogue_role, source_kind) VALUES (${values.join(", ")});`);
      lines.push(`INSERT OR IGNORE INTO pl_vocabulary_details (item_id, example_pl, example_ja, owner_profile_id, sort_order) VALUES (${[word.id, word.examplePl, word.exampleJa].map(sqlQuote).join(", ")}, NULL, ${order});`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function loadVocabularyBatches() {
  return [
    { sourcePath: "content/vocabulary.json", outputPath: "migrations/0009_vocabulary_content.sql", startOrder: 0 },
    { sourcePath: "content/vocabulary-expansion.json", outputPath: "migrations/0011_vocabulary_expansion.sql", startOrder: 80 },
  ].map((batch) => ({
    ...batch,
    source: JSON.parse(readFileSync(resolve(root, batch.sourcePath), "utf8")),
    options: { sourceName: batch.sourcePath, startOrder: batch.startOrder },
  }));
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node scripts/generate-vocabulary.mjs [--check] [--source <json> --output <sql> --start-order <n>]");
    return;
  }
  const optionPath = (name, fallback) => {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a path.`);
    return resolve(args[index + 1]);
  };
  const custom = args.includes("--source") || args.includes("--output");
  if (custom && !(args.includes("--source") && args.includes("--output"))) throw new Error("Custom generation requires both --source and --output.");
  const sourcePath = custom ? optionPath("--source") : null;
  const orderIndex = args.indexOf("--start-order");
  const startOrder = orderIndex < 0 ? 0 : Number(args[orderIndex + 1]);
  const batches = custom ? [{
    source: JSON.parse(readFileSync(sourcePath, "utf8")),
    outputPath: optionPath("--output"),
    options: { sourceName: relative(root, sourcePath), startOrder },
  }] : loadVocabularyBatches();
  const failures = validateVocabularyCollection(batches.map((batch) => batch.source));
  if (failures.length) throw new Error(failures.join("\n"));
  // Render all batches before writing any file, so invalid content cannot partially regenerate migrations.
  const rendered = batches.map((batch) => ({ ...batch, migration: renderVocabularyMigration(batch.source, batch.options) }));
  for (const batch of rendered) {
    const outputPath = resolve(root, batch.outputPath);
    if (args.includes("--check")) {
      if (readFileSync(outputPath, "utf8") !== batch.migration) throw new Error(`${batch.outputPath} is out of date. Run node scripts/generate-vocabulary.mjs.`);
    } else {
      writeFileSync(outputPath, batch.migration);
      console.log(`Generated ${batch.outputPath}.`);
    }
  }
  const count = batches.reduce((total, batch) => total + batch.source.topics.reduce((sum, topic) => sum + topic.words.length, 0), 0);
  console.log(`Vocabulary content: ${args.includes("--check") ? "PASS" : "generated"} (${count} words, ${vocabularyTopicIds.length} topics).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
