import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const a1Path = join(root, "content", "a1-curriculum.json");
const combinedPath = join(root, "content", "a1-a2-curriculum.json");
const migrationA1Path = join(root, "migrations", "0003_staged_retrieval_a1_full.sql");
const correctionMigrationPath = join(root, "migrations", "0004_fix_u1_staged_step_metadata.sql");
const migrationA2Path = join(root, "migrations", "0005_a2_missions_content.sql");
const migrationA2FixPath = join(root, "migrations", "0006_fix_a2_item_situation.sql");
const a1 = JSON.parse(readFileSync(a1Path, "utf8"));
const curriculum = JSON.parse(readFileSync(combinedPath, "utf8"));
const migrationA1 = readFileSync(migrationA1Path, "utf8");
const correctionMigration = readFileSync(correctionMigrationPath, "utf8");
const migrationA2 = readFileSync(migrationA2Path, "utf8");
const migrationA2Fix = readFileSync(migrationA2FixPath, "utf8");
const failures = [];
const expectedA1Types = ["multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input"];
const expectedA2Types = [
  "multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input",
  "multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input",
  "free_input", "free_input", "free_input", "free_input",
];

function check(condition, message) {
  if (!condition) failures.push(message);
}
function unique(values) { return new Set(values); }

check(a1.version === "a1-2026.2", `A1教材版が不正です: ${a1.version}`);
check(a1.track === "A1", `A1 trackが不正です: ${a1.track}`);
check(a1.units?.length === 10, `A1 Unit数が10ではありません: ${a1.units?.length}`);
const a1Lessons = a1.units?.flatMap((unit) => unit.lessons ?? []) ?? [];
check(a1Lessons.length === 60, `A1 lesson総数が60ではありません: ${a1Lessons.length}`);
for (const unit of a1.units ?? []) {
  check(unit.lessons?.length === 6, `A1 Unit ${unit.n} のlesson数が6ではありません。`);
  for (const lesson of unit.lessons ?? []) {
    check(lesson.id === `a1-u${unit.n}-l${lesson.lessonNumber}`, `A1 lesson IDが不正です: ${lesson.id}`);
    check(JSON.stringify(lesson.questionTypes) === JSON.stringify(expectedA1Types), `${lesson.id}の問題形式が不正です。`);
    check(lesson.itemIds?.length === (unit.n === 1 ? 5 : 2), `${lesson.id}のitem参照数が不正です。`);
  }
}
check(migrationA1.match(/a1-u\d+-l\d+-s\d+/gu)?.length === 300, "A1 migrationのstep記述数が300ではありません。");
check(unique([...migrationA1.matchAll(/a1-u\d+-l\d+-s\d+/gu)].map((match) => match[0])).size === 300, "A1 migrationのstep IDが重複しています。");
check(correctionMigration.includes("a1-u1-l2-s4") && correctionMigration.includes("[\"A\",\"ty?\"]"), "A1補正migrationがありません。");

const a2Units = curriculum.units?.filter((unit) => unit.level === "A2") ?? [];
const a2Lessons = a2Units.flatMap((unit) => unit.lessons ?? []);
const a2ItemIds = a2Lessons.flatMap((lesson) => lesson.itemIds ?? []);
check(curriculum.version === "a1-a2-2026.1", `統合教材版が不正です: ${curriculum.version}`);
check(a2Units.length === 10, `A2 Unit数が10ではありません: ${a2Units.length}`);
check(a2Lessons.length === 60, `A2 lesson総数が60ではありません: ${a2Lessons.length}`);
check(a2ItemIds.length === 360, `A2 item参照数が360ではありません: ${a2ItemIds.length}`);
check(unique(a2ItemIds).size === 360, "A2 item IDが重複しています。");
for (const [unitIndex, unit] of a2Units.entries()) {
  check(unit.unitNumber === unitIndex + 1, `A2 Unit番号が不正です: ${unit.unitNumber}`);
  check(unit.lessons?.length === 6, `A2 Unit ${unit.unitNumber} のlesson数が6ではありません。`);
  for (const lesson of unit.lessons ?? []) {
    check(lesson.id === `a2-u${unitIndex + 1}-l${lesson.lessonNumber}`, `A2 lesson IDが不正です: ${lesson.id}`);
    check(lesson.itemIds?.length === 6, `${lesson.id}の新規表現が6件ではありません。`);
    check(JSON.stringify(lesson.questionTypes) === JSON.stringify(expectedA2Types), `${lesson.id}の問題形式が段階順ではありません。`);
    check(lesson.missionId === `${lesson.id}-mission`, `${lesson.id}のmission参照が不正です。`);
    check(lesson.candoIds?.length === 3, `${lesson.id}のCan-do参照が3件ではありません。`);
    for (const itemId of lesson.itemIds ?? []) check(itemId.startsWith(`a2-u${unitIndex + 1}-`), `${lesson.id}に別Unitのitemがあります: ${itemId}`);
  }
}
check(unique(a2Lessons.map((lesson) => lesson.id)).size === 60, "A2 lesson IDが重複しています。");
const a2StepIds = unique([...migrationA2.matchAll(/a2-u\d+-l\d+-s\d+/gu)].map((match) => match[0]));
check(a2StepIds.size === 840, `A2 migrationのstep数が840ではありません: ${a2StepIds.size}`);
const a2MigrationItemIds = unique([...migrationA2.matchAll(/a2-u\d+-l\d+-i\d{2}/gu)].map((match) => match[0]));
check(a2MigrationItemIds.size === 360, `A2 migrationのitem数が360ではありません: ${a2MigrationItemIds.size}`);
for (const required of ["track-a2", "pl_voice_missions", "pl_voice_attempts", "pl_cando_items", "pl_cando_progress", "cefr_level", "skills_json", "speaker_gender", "register"]) {
  check(migrationA2.includes(required), `A2 migrationに${required}がありません。`);
}
check(!migrationA2.includes("porque") && !readFileSync(join(root, "scripts", "generate-a2-content.mjs"), "utf8").includes("porque"), "教材に不正なporque混入があります。");
check(!migrationA2.includes("'undefined'") && !migrationA2.includes('"undefined"'), "A2 migrationにundefined metadataが残っています。");
check(migrationA2Fix.includes("scene = topic") && migrationA2Fix.includes("a1-a2-2026.1"), "A2 situation補正migrationがありません。");
check(!/TODO|placeholder|仮データ/iu.test(readFileSync(combinedPath, "utf8")), "教材JSONにTODO/placeholder/仮データが残っています。");

function localDbPath() {
  if (process.env.POLSKI_D1_PATH && existsSync(process.env.POLSKI_D1_PATH)) return process.env.POLSKI_D1_PATH;
  const directory = join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!existsSync(directory)) return null;
  return readdirSync(directory).map((name) => join(directory, name)).find((path) => path.endsWith(".sqlite") && !path.endsWith("metadata.sqlite")) ?? null;
}
function queryDatabase(dbPath, sql) {
  try {
    const output = execFileSync("sqlite3", ["-json", dbPath, sql], { encoding: "utf8" }).trim();
    return output ? JSON.parse(output) : [];
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failures.push(`sqlite3でD1を検査できません: ${detail}`);
    return [];
  }
}
function checkD1(dbPath) {
  const counts = queryDatabase(dbPath, "SELECT (SELECT COUNT(*) FROM pl_tracks WHERE status='published') AS tracks, (SELECT COUNT(*) FROM pl_units WHERE status='published') AS units, (SELECT COUNT(*) FROM pl_lessons WHERE status='published') AS lessons, (SELECT COUNT(*) FROM pl_learning_items WHERE status='published') AS items, (SELECT COUNT(DISTINCT lower(trim(polish))) FROM pl_learning_items WHERE status='published') AS unique_items, (SELECT COUNT(*) FROM pl_lesson_steps) AS steps, (SELECT COUNT(*) FROM pl_voice_missions WHERE status='published') AS missions, (SELECT COUNT(*) FROM pl_cando_items) AS cando;")[0] ?? {};
  check(counts.tracks === 2, `D1 published track数が2ではありません: ${counts.tracks}`);
  check(counts.units === 20, `D1 published Unit数が20ではありません: ${counts.units}`);
  check(counts.lessons === 120, `D1 published lesson数が120ではありません: ${counts.lessons}`);
  check(counts.items >= 450 && counts.items <= 600, `D1 published item数が目標範囲外です: ${counts.items}`);
  check(counts.unique_items >= 400, `D1 unique published item数が不足しています: ${counts.unique_items}`);
  check(counts.steps === 1140, `D1 step数が1140ではありません: ${counts.steps}`);
  check(counts.missions === 120, `D1 mission数が120ではありません: ${counts.missions}`);
  check(counts.cando === 60, `D1 Can-do数が60ではありません: ${counts.cando}`);
  const a1Steps = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_lesson_steps WHERE lesson_id LIKE 'a1-%';")[0]?.count ?? 0;
  const a2Steps = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_lesson_steps WHERE lesson_id LIKE 'a2-%';")[0]?.count ?? 0;
  check(a1Steps === 300 && a2Steps === 840, `A1/A2 step内訳が不正です: A1=${a1Steps}, A2=${a2Steps}`);
  const levelCounts = queryDatabase(dbPath, "SELECT cefr_level, COUNT(*) AS count FROM pl_learning_items WHERE status='published' GROUP BY cefr_level ORDER BY cefr_level;");
  check(levelCounts.some((row) => row.cefr_level === "A1" && row.count === 132), "D1 A1 published item数が132ではありません。");
  check(levelCounts.some((row) => row.cefr_level === "A2" && row.count === 360), "D1 A2 published item数が360ではありません。");
  const malformed = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_learning_items WHERE status='published' AND (polish='' OR meaning_ja='' OR meaning_en='' OR grammar_note='' OR topic='' OR tags_json='' OR accepted_answers_json='' OR cefr_level='' OR skills_json='' OR scene='' OR register='' OR speaker_gender='' OR dialogue_role='');")[0]?.count ?? 0;
  check(malformed === 0, `published itemに空欄があります: ${malformed}`);
  const metadata = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_learning_items WHERE status='published' AND cefr_level='A2' AND (register NOT IN ('formal','informal','neutral') OR speaker_gender <> 'male' OR scene IS NULL OR trim(scene) = '' OR lower(scene) = 'undefined' OR dialogue_role NOT IN ('learner','partner') OR source_kind='' OR json_array_length(skills_json) < 1 OR tags_json NOT LIKE '%cefr:a2%' OR tags_json NOT LIKE '%speaker:male%');")[0]?.count ?? 0;
  check(metadata === 0, `A2 item metadataが不整合です: ${metadata}`);
  const lessonRows = queryDatabase(dbPath, "SELECT l.id, COUNT(*) AS steps, COUNT(DISTINCT ls.item_id) AS items, GROUP_CONCAT(ls.question_type, '|') AS types FROM pl_lessons l JOIN pl_lesson_steps ls ON ls.lesson_id=l.id WHERE l.id LIKE 'a2-%' GROUP BY l.id ORDER BY l.id;");
  check(lessonRows.length === 60, `D1 A2 lessonの検査数が60ではありません: ${lessonRows.length}`);
  for (const row of lessonRows) {
    check(row.steps === 14, `${row.id}のstep数が14ではありません: ${row.steps}`);
    check(row.items === 6, `${row.id}のitem参照数が6ではありません: ${row.items}`);
    check(row.types === expectedA2Types.join("|"), `${row.id}の問題形式が不正です: ${row.types}`);
  }
  const unreferenced = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_learning_items i WHERE i.status='published' AND i.cefr_level='A2' AND NOT EXISTS (SELECT 1 FROM pl_lesson_steps ls WHERE ls.item_id=i.id);")[0]?.count ?? 0;
  check(unreferenced === 0, `A2 itemにstep参照がないものがあります: ${unreferenced}`);
  const a2Duplicates = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM (SELECT lower(trim(polish)) FROM pl_learning_items WHERE status='published' AND cefr_level='A2' GROUP BY lower(trim(polish)) HAVING COUNT(*)>1);")[0]?.count ?? 0;
  check(a2Duplicates === 0, `A2教材内に重複表現があります: ${a2Duplicates}`);
  const choices = queryDatabase(dbPath, "SELECT id, answer_text, options_json FROM pl_lesson_steps WHERE question_type='multiple_choice';");
  for (const choice of choices) {
    let options = [];
    try { options = JSON.parse(choice.options_json ?? "[]"); } catch { options = []; }
    check(options.length === 4, `${choice.id}が4選択肢ではありません: ${options.length}`);
    check(options.some((option) => option.value === choice.answer_text), `${choice.id}の正答が選択肢にありません。`);
  }
  const stagedRows = queryDatabase(dbPath, "SELECT ls.id, ls.question_type, ls.cloze_prefix, ls.cloze_suffix, ls.cloze_answer, ls.tokens_json, i.polish FROM pl_lesson_steps ls JOIN pl_learning_items i ON i.id=ls.item_id WHERE ls.question_type IN ('cloze','unscramble') ORDER BY ls.id;");
  for (const row of stagedRows) {
    const tokens = row.polish.trim().split(/\s+/u);
    if (row.question_type === "cloze") {
      const blankIndex = Math.min(tokens.length - 1, Math.max(0, Math.floor(tokens.length / 2)));
      check(row.cloze_answer === tokens[blankIndex], `${row.id}のcloze正答がitemと一致しません。`);
      check(row.cloze_prefix === tokens.slice(0, blankIndex).join(" "), `${row.id}のcloze前半がitemと一致しません。`);
      check(row.cloze_suffix === tokens.slice(blankIndex + 1).join(" "), `${row.id}のcloze後半がitemと一致しません。`);
    } else check(JSON.stringify(JSON.parse(row.tokens_json)) === JSON.stringify(tokens), `${row.id}の語順tokenがitemと一致しません。`);
  }
  const missionRows = queryDatabase(dbPath, "SELECT m.id, m.unit_id, m.lesson_id, l.unit_id AS lesson_unit_id, m.title, m.scenario, m.learner_role, m.partner_role, m.objective, m.ending_condition, m.feedback_format, m.required_item_ids_json, m.learner_item_ids_json, m.partner_item_ids_json FROM pl_voice_missions m LEFT JOIN pl_lessons l ON l.id = m.lesson_id WHERE m.status='published';");
  check(missionRows.length === 120, `D1 mission検査数が120ではありません: ${missionRows.length}`);
  for (const mission of missionRows) {
    for (const field of ["title", "scenario", "learner_role", "partner_role", "objective", "ending_condition", "feedback_format"]) check(Boolean(mission[field]), `${mission.id}の${field}が空欄です。`);
    check(Boolean(mission.lesson_unit_id) && mission.unit_id === mission.lesson_unit_id, `${mission.id}のlesson/unit参照が不正です。`);
    let required = []; let partner = []; let learner = [];
    try { required = JSON.parse(mission.required_item_ids_json); partner = JSON.parse(mission.partner_item_ids_json); learner = JSON.parse(mission.learner_item_ids_json); } catch { /* reported below */ }
    check(required.length >= 2, `${mission.id}の必須表現参照が不足しています。`);
    check(partner.length >= 1, `${mission.id}の相手表現参照がありません。`);
    check(learner.length >= 1, `${mission.id}の学習者表現参照がありません。`);
  }
  const brokenMissionRefs = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_voice_missions m JOIN pl_lessons l ON l.id = m.lesson_id JOIN json_each(m.required_item_ids_json) ids LEFT JOIN pl_lesson_steps ls ON ls.lesson_id = l.id AND ls.item_id = ids.value WHERE m.status='published' AND ls.id IS NULL;")[0]?.count ?? 0;
  const brokenPartnerRefs = queryDatabase(dbPath, "SELECT COUNT(*) AS count FROM pl_voice_missions m JOIN pl_lessons l ON l.id = m.lesson_id JOIN json_each(m.partner_item_ids_json) ids LEFT JOIN pl_lesson_steps ls ON ls.lesson_id = l.id AND ls.item_id = ids.value WHERE m.status='published' AND ls.id IS NULL;")[0]?.count ?? 0;
  check(brokenMissionRefs === 0 && brokenPartnerRefs === 0, `missionのitem参照が壊れています: required=${brokenMissionRefs}, partner=${brokenPartnerRefs}`);
  const candoRows = queryDatabase(dbPath, "SELECT unit_id, COUNT(*) AS count FROM pl_cando_items GROUP BY unit_id;");
  check(candoRows.length === 20 && candoRows.every((row) => row.count === 3), "各UnitのCan-doが3件ではありません。");
}

if (process.argv.includes("--db")) {
  const dbPath = localDbPath();
  check(Boolean(dbPath), "ローカルD1 SQLiteが見つかりません。先にnpm run db:migrateを実行してください。");
  if (dbPath) checkD1(dbPath);
}

if (failures.length > 0) {
  console.error("教材整合性検査: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
const suffix = process.argv.includes("--db") ? ", local D1 checked" : "";
console.log(`教材整合性検査: PASS (A1 60 lessons/132 items, A2 60 lessons/360 items, 1,140 steps${suffix})`);
