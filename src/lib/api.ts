import type {
  AttemptResult,
  DueItem,
  HistoryEntry,
  LearningItem,
  Lesson,
  MistakeSummary,
  ReviewRating,
  StatusResponse,
  TimelineFilter,
  TimelinePage,
  CanDoItem,
  CanDoUnit,
  TrackCode,
  VoiceMission,
  VoiceResult,
  VoiceResultImport,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
      ? body.message
      : `リクエストに失敗しました（${response.status}）`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  status: (track: TrackCode = "A1") => request<StatusResponse>(`/status?track=${track}`),
  lesson: (lessonId: string) => request<Lesson>(`/lessons/${encodeURIComponent(lessonId)}`),
  mission: (lessonId: string) => request<VoiceMission>(`/missions?lessonId=${encodeURIComponent(lessonId)}`),
  cando: (unitId: string) => request<CanDoUnit>(`/cando?unitId=${encodeURIComponent(unitId)}`),
  updateCando: (payload: { candoId: string; status: import("./types").CanDoStatus; selfRating?: number | null; evidenceNotes?: string }) => request<CanDoItem>("/cando", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  voiceResults: (limit = 30) => request<VoiceResult[]>(`/voice-results?limit=${limit}`),
  importVoiceResult: (payload: VoiceResultImport) => request<VoiceResult>("/voice-results/import", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  due: (limit = 15) => request<DueItem[]>(`/reviews/due?limit=${limit}`),
  items: (params: { search?: string; type?: string; state?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.type) query.set("type", params.type);
    if (params.state) query.set("state", params.state);
    return request<Array<LearningItem & { reviewState: import("./types").ReviewState | null }>>(`/items?${query.toString()}`);
  },
  mistakes: () => request<MistakeSummary[]>("/mistakes"),
  history: (limit = 30) => request<HistoryEntry[]>(`/history?limit=${limit}`),
  timeline: (params: { type?: TimelineFilter; cursor?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.type && params.type !== "all") query.set("type", params.type);
    if (params.cursor) query.set("cursor", params.cursor);
    query.set("limit", String(params.limit ?? 25));
    return request<TimelinePage>(`/timeline?${query.toString()}`);
  },
  startSession: (mode: "lesson" | "review", lessonId: string | undefined, idempotencyKey: string) => request<{ id: string; startedAt: string }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ mode, lessonId, idempotencyKey }),
  }),
  completeSession: (sessionId: string, durationMs: number) => request<{ ok: boolean }>(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed: true, durationMs }),
  }),
  attempt: (payload: {
    itemId: string;
    answer: string;
    idempotencyKey: string;
    sessionId: string;
    lessonId?: string;
    stepId?: string;
    questionType: import("./types").QuestionType;
    direction: import("./types").PromptDirection;
    elapsedMs: number;
    autoRate?: boolean;
  }) => request<AttemptResult>("/attempts", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  rateReview: (payload: { itemId: string; rating: ReviewRating; attemptId: string; questionType: import("./types").QuestionType; direction: import("./types").PromptDirection }) => request<AttemptResult>("/reviews/rate", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  savePromptCopy: (topic: string, prompt: string, missionId?: string) => request<{ ok: boolean }>("/prompts", {
    method: "POST",
    body: JSON.stringify({ topic, prompt, missionId }),
  }),
};

export async function downloadExport(format: "json" | "csv"): Promise<void> {
  const response = await fetch(`/api/v1/export?format=${format}`);
  if (!response.ok) throw new Error("エクスポートに失敗しました。");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `polski-loop-export.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
