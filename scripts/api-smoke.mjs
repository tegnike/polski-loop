const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8787/api/v1";
const sessionKey = "api-smoke-session-v1";
const attemptKey = "api-smoke-attempt-v1";

async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}: ${text}`);
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const status = await request("/status");
assert(status.units?.length === 10, "status must expose ten units");
assert(status.progress?.totalLessons === 60, "status must expose sixty lessons");
const statusA2 = await request("/status?track=A2");
assert(statusA2.track?.code === "A2", "status track query must select A2");
assert(statusA2.units?.length === 10 && statusA2.progress?.totalLessons === 60, "A2 status must expose ten units and sixty lessons");
assert(statusA2.curriculum?.unitCount === 20 && statusA2.curriculum?.lessonCount === 120, "status must expose the combined curriculum totals");
assert(statusA2.curriculum?.uniquePublishedItemCount >= 450, "status must expose at least 450 unique published items");

const lesson = await request("/lessons/a1-u1-l1");
assert(lesson.steps?.length === 5, "lesson must expose five staged steps");
assert(lesson.steps.map((step) => step.questionType).join(",") === "multiple_choice,multiple_choice,cloze,unscramble,free_input", "lesson step order is invalid");
assert(lesson.steps[0].options.length === 4, "multiple choice must have four options");
const a2Lesson = await request("/lessons/a2-u1-l1");
assert(a2Lesson.steps?.length === 14, "A2 lesson must expose fourteen staged steps");
assert(a2Lesson.steps.map((step) => step.questionType).join(",") === "multiple_choice,multiple_choice,cloze,unscramble,free_input,multiple_choice,multiple_choice,cloze,unscramble,free_input,free_input,free_input,free_input,free_input", "A2 lesson step order is invalid");
assert(new Set(a2Lesson.steps.map((step) => step.item.id)).size === 6, "A2 lesson must reference six authored items");
assert(a2Lesson.steps[0].item.cefrLevel === "A2" && a2Lesson.steps[0].item.situation === "introduction" && a2Lesson.steps[0].item.register, "A2 item metadata must be exposed by the lesson API");
assert(a2Lesson.mission?.id === "a2-u1-l1-mission" && a2Lesson.mission?.requiredExpressions?.length >= 3, "A2 lesson must include a complete Voice mission");
const mission = await request("/missions?lessonId=a2-u1-l1");
assert(mission.id === a2Lesson.mission.id && mission.promptText.includes("ChatGPT Voice"), "mission endpoint must return a copyable prompt");

const items = await request("/items?search=Cze%C5%9B%C4%87");
assert(items.some((item) => item.id === "a1-u1-i01"), "item search must find Cześć");
const historyBefore = await request("/history?limit=100");
const session = await request("/sessions", { method: "POST", body: JSON.stringify({ mode: "lesson", lessonId: lesson.id, idempotencyKey: sessionKey }) });
const sessionAgain = await request("/sessions", { method: "POST", body: JSON.stringify({ mode: "lesson", lessonId: lesson.id, idempotencyKey: sessionKey }) });
assert(session.id === sessionAgain.id, "session idempotency must return the same id");

const step = lesson.steps[0];
const payload = {
  itemId: step.item.id,
  answer: step.item.polish,
  idempotencyKey: attemptKey,
  sessionId: session.id,
  lessonId: lesson.id,
  stepId: step.id,
  questionType: step.questionType,
  direction: step.direction,
  elapsedMs: 800,
  autoRate: true,
};
const attempt = await request("/attempts", { method: "POST", body: JSON.stringify(payload) });
const attemptAgain = await request("/attempts", { method: "POST", body: JSON.stringify(payload) });
assert(attempt.isCorrect === true, "known answer must be correct");
assert(attempt.attemptId === attemptAgain.attemptId, "attempt idempotency must return the same id");

const rated = await request("/reviews/rate", { method: "POST", body: JSON.stringify({ itemId: step.item.id, rating: "hard", attemptId: attempt.attemptId, questionType: step.questionType, direction: step.direction }) });
assert(rated.reviewState?.lastRating === "hard", "review rating must be persisted");
assert(typeof rated.reviewState?.dueAt === "string", "review due date must be returned");
await request(`/sessions/${encodeURIComponent(session.id)}`, { method: "PATCH", body: JSON.stringify({ completed: true, durationMs: 1200 }) });

const voicePayload = { missionId: mission.id, sessionId: session.id, idempotencyKey: "api-smoke-voice-result-v1", heard: true, replied: true, askedBack: false, needsRestatement: true, confidence: 4, notes: "一度言い換えてもらった。" };
const voiceResult = await request("/voice-results", { method: "POST", body: JSON.stringify(voicePayload) });
const voiceResultAgain = await request("/voice-results", { method: "POST", body: JSON.stringify(voicePayload) });
assert(voiceResult.id === voiceResultAgain.id && voiceResult.needsRestatement === true && voiceResult.confidence === 4, "Voice result idempotency and fields must work");
await request("/prompts", { method: "POST", body: JSON.stringify({ topic: mission.title, prompt: mission.promptText, missionId: mission.id }) });
const cando = await request(`/cando?unitId=${encodeURIComponent(statusA2.units[0].id)}`);
assert(cando.items?.length === 3 && typeof cando.completionPercent === "number", "Can-do endpoint must return three checklist items");
const candoUpdated = await request("/cando", { method: "POST", body: JSON.stringify({ candoId: cando.items[0].id, status: "practicing", selfRating: 3, evidenceNotes: "API smoke" }) });
assert(candoUpdated.id === cando.items[0].id && candoUpdated.status === "practicing", "Can-do progress must be saved");

const historyAfter = await request("/history?limit=100");
assert(historyAfter.length >= historyBefore.length, "history must remain readable after an attempt");
const exported = await request("/export?format=json");
assert(exported.data?.pl_attempts, "JSON export must include attempts");
assert(exported.data?.pl_voice_attempts && exported.data?.pl_cando_progress, "JSON export must include Voice results and Can-do progress");
const exportedCsv = await request("/export?format=csv");
assert(typeof exportedCsv === "string" && exportedCsv.includes("voice_result") && exportedCsv.includes("confidence"), "CSV export must include Voice result fields");
console.log(`API smoke: PASS (A2=${statusA2.curriculum.uniquePublishedItemCount} unique items, mission=${mission.id}, session=${session.id}, attempt=${attempt.attemptId})`);
