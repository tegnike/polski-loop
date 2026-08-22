import { useCallback, useEffect, useState } from "react";
import { BottomNav, type AppView } from "./components/BottomNav";
import StudyFlow from "./components/StudyFlow";
import { api, downloadExport } from "./lib/api";
import { downloadTextFile } from "./lib/download";
import { difficultyLabel, formatDueDate, formatDuration } from "./lib/learning";
import type {
  CanDoUnit,
  DueItem,
  HistoryEntry,
  LearningItem,
  MistakeSummary,
  QuestionType,
  ReviewState,
  StatusResponse,
  TrackCode,
  VoiceResult,
  VoiceResultImport,
} from "./lib/types";

type StudyRequest = { mode: "lesson" | "review"; lessonId?: string };
const questionLabels: Record<QuestionType, string> = {
  multiple_choice: "4択",
  cloze: "穴埋め",
  unscramble: "語順",
  free_input: "自由入力",
};

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [activeTrack, setActiveTrack] = useState<TrackCode>("A1");
  const [view, setView] = useState<AppView>("today");
  const [study, setStudy] = useState<StudyRequest | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceImporting, setVoiceImporting] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      setError(null);
      setStatus(await api.status(activeTrack));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "アプリを読み込めませんでした。",
      );
    } finally {
      setLoading(false);
    }
  }, [activeTrack]);
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleExport(format: "json" | "csv") {
    try {
      await downloadExport(format);
      setNotice(format.toUpperCase() + "を書き出しました。");
      setMenuOpen(false);
    } catch (exportError) {
      setNotice(
        exportError instanceof Error
          ? exportError.message
          : "書き出しに失敗しました。",
      );
    }
  }
  async function downloadPrompt() {
    if (!status) return;
    try {
      downloadTextFile(
        `polski-loop-${status.nextMission.difficultyLevel}-${status.nextMission.title}`,
        status.nextMission.promptText,
      );
      await api.savePromptCopy(
        status.nextMission.title,
        status.nextMission.promptText,
        status.nextMission.id,
      );
      setNotice("ChatGPT Voice用ファイルを保存しました。");
    } catch {
      setNotice(
        "ファイルを保存できませんでした。ブラウザのダウンロード設定を確認してください。",
      );
    }
  }
  async function importVoiceResult(file: File) {
    if (file.size > 65536) {
      setNotice("採点ファイルは64KB以下にしてください。");
      return;
    }
    setVoiceImporting(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = await api.importVoiceResult(parsed as VoiceResultImport);
      setNotice(
        `ChatGPT採点を同期しました（総合 ${result.overallScore?.toFixed(1) ?? "-"}/5）。`,
      );
      await refreshStatus();
    } catch (importError) {
      setNotice(
        importError instanceof Error
          ? importError.message
          : "採点ファイルを読み込めませんでした。",
      );
    } finally {
      setVoiceImporting(false);
    }
  }
  function finishStudy() {
    setStudy(null);
    setView("today");
    void refreshStatus();
    setNotice("学習履歴を保存しました。おつかれさまでした！");
  }

  if (study)
    return (
      <StudyFlow
        mode={study.mode}
        lessonId={study.lessonId}
        onFinished={finishStudy}
        onBack={() => setStudy(null)}
      />
    );
  if (loading)
    return (
      <div className="app-loading">
        <div className="brand-mark small">PL</div>
        <span className="loader" />
        読み込み中…
      </div>
    );
  if (error || !status)
    return (
      <div className="app-loading error-screen">
        <div className="brand-mark">PL</div>
        <h1>Polski Loop</h1>
        <p className="error-text">
          {error ?? "データを取得できませんでした。"}
        </p>
        <p className="muted">
          WorkerとローカルD1が起動しているか確認してください。
        </p>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setLoading(true);
            void refreshStatus();
          }}
        >
          もう一度読み込む
        </button>
      </div>
    );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">PL</div>
          <div>
            <strong>Polski Loop</strong>
            <span>A1 / A2 · 段階的な想起ループ</span>
          </div>
        </div>
        <button
          className="icon-button menu-button"
          type="button"
          aria-label="メニュー"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>
        {menuOpen && (
          <SettingsMenu
            onExport={handleExport}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </header>
      {notice && (
        <button className="toast" type="button" onClick={() => setNotice(null)}>
          {notice}
          <span>×</span>
        </button>
      )}
      <main className="main-content">
        {view === "today" && (
          <TodayView
            status={status}
            activeTrack={activeTrack}
            onTrackChange={setActiveTrack}
            onStartLesson={() =>
              setStudy({ mode: "lesson", lessonId: status.nextLesson.id })
            }
            onStartReview={() => setStudy({ mode: "review" })}
            onDownloadPrompt={() => void downloadPrompt()}
            onImportVoiceResult={(file) => void importVoiceResult(file)}
            voiceImporting={voiceImporting}
          />
        )}
        {view === "review" && (
          <ReviewView
            dueCount={status.progress.dueReviews}
            onStart={() => setStudy({ mode: "review" })}
          />
        )}
        {view === "library" && <LibraryView />}
        {view === "curriculum" && (
          <CurriculumView
            status={status}
            activeTrack={activeTrack}
            onTrackChange={setActiveTrack}
            onStartLesson={(lessonId) => setStudy({ mode: "lesson", lessonId })}
            onStatusChanged={() => void refreshStatus()}
          />
        )}
        {view === "progress" && <ProgressView status={status} />}
      </main>
      <BottomNav current={view} onChange={setView} />
    </div>
  );
}

function SettingsMenu({
  onExport,
  onClose,
}: {
  onExport: (format: "json" | "csv") => void;
  onClose: () => void;
}) {
  return (
    <div className="settings-menu" role="dialog" aria-label="設定メニュー">
      <div className="menu-heading">
        <strong>データと設定</strong>
        <button className="plain-button" type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <p>教材、回答、復習履歴はいつでも自分のデータとして持ち出せます。</p>
      <div className="menu-actions">
        <button type="button" onClick={() => onExport("json")}>
          JSONを書き出す
        </button>
        <button type="button" onClick={() => onExport("csv")}>
          CSVを書き出す
        </button>
      </div>
      <div className="menu-note">
        <strong>学習の段階</strong>
        <span>
          4択 → 穴埋め・語順 → 自由入力。復習の成績で次の段階が変わります。
        </span>
      </div>
      <div className="menu-note">
        <strong>会話の分業</strong>
        <span>
          会話と音声はChatGPT Voiceへ。Polski Loopは教材と記録を担当します。
        </span>
      </div>
    </div>
  );
}

function TodayView({
  status,
  activeTrack,
  onTrackChange,
  onStartLesson,
  onStartReview,
  onDownloadPrompt,
  onImportVoiceResult,
  voiceImporting,
}: {
  status: StatusResponse;
  activeTrack: TrackCode;
  onTrackChange: (track: TrackCode) => void;
  onStartLesson: () => void;
  onStartReview: () => void;
  onDownloadPrompt: () => void;
  onImportVoiceResult: (file: File) => void;
  voiceImporting: boolean;
}) {
  const percent = Math.round(
    (status.progress.completedLessons /
      Math.max(status.progress.totalLessons, 1)) *
      100,
  );
  const hasReview = status.progress.dueReviews > 0;
  return (
    <div className="page-stack">
      <TrackTabs
        activeTrack={activeTrack}
        tracks={status.tracks}
        onChange={onTrackChange}
      />
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Dzień dobry, {status.profile.displayName}</p>
          <h1>今日も、ひとつ。</h1>
          <p className="muted">
            {hasReview
              ? "まずは期限到来の復習から始めましょう。"
              : "新しい表現を、思い出せる形に変えましょう。"}
          </p>
        </div>
        <div className="streak-badge">
          <span>連続</span>
          <strong>{status.progress.streakDays}</strong>
          <small>日</small>
        </div>
      </section>
      <section className="course-progress card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {status.track.code} · {status.track.contentVersion}
            </span>
            <h2>
              {status.unit.unitNumber}. {status.unit.titleJa}
            </h2>
          </div>
          <strong>{percent}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: percent + "%" }} />
        </div>
        <div className="progress-caption">
          <span>
            {status.progress.completedLessons} / {status.progress.totalLessons}{" "}
            lessons
          </span>
          <span>{status.progress.masteredItems}項目が定着</span>
        </div>
      </section>
      <section className="priority-card card">
        <div className="card-topline">
          <span className="priority-label">最初にやる</span>
          <span className="time-label">
            約{hasReview ? 4 : status.nextLesson.estimatedMinutes}分
          </span>
        </div>
        <div className="priority-title">
          <div className="action-icon">{hasReview ? "↻" : "→"}</div>
          <div>
            <h2>{hasReview ? "期限到来の復習" : "今日のレッスン"}</h2>
            <p>
              {hasReview
                ? status.progress.dueReviews + "件を思い出す"
                : status.nextLesson.titleJa}
            </p>
          </div>
        </div>
        <button
          className="button primary full-width"
          type="button"
          onClick={hasReview ? onStartReview : onStartLesson}
        >
          {hasReview ? "復習を始める" : "レッスンを始める"}
          <span aria-hidden="true">→</span>
        </button>
        {hasReview && (
          <button className="text-button" type="button" onClick={onStartLesson}>
            復習のあとにレッスンを見る
          </button>
        )}
      </section>
      <section className="lesson-card card">
        <div className="card-topline">
          <span className="eyebrow">次のレッスン</span>
          <span className="lesson-index">
            Unit {status.unit.unitNumber} · Lesson{" "}
            {status.nextLesson.lessonNumber}
          </span>
        </div>
        <h2>{status.nextLesson.titleJa}</h2>
        <p className="polish-subtitle">{status.nextLesson.titlePl}</p>
        <p>{status.nextLesson.description}</p>
        <div className="lesson-meta">
          <span>段階問題 {status.nextLesson.stepCount}問</span>
          <span>約{status.nextLesson.estimatedMinutes}分</span>
        </div>
        <button
          className="button secondary full-width"
          type="button"
          onClick={onStartLesson}
        >
          レッスンを始める <span aria-hidden="true">→</span>
        </button>
      </section>
      <section className="prompt-card card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">次のVoice mission</span>
            <h2>ChatGPT Voiceで使う</h2>
          </div>
          <span className="chatgpt-mark">◎</span>
        </div>
        <p className="prompt-preview">
          {status.nextMission.promptText.split("\n").slice(0, 5).join("\n")}
        </p>
        <div className="prompt-file-actions">
          <button
            className="button ghost full-width"
            type="button"
            onClick={onDownloadPrompt}
          >
            ⇩ ChatGPT Voice用ファイルを保存
          </button>
          <label
            className={
              "button ghost full-width upload-button" +
              (voiceImporting ? " disabled" : "")
            }
            aria-disabled={voiceImporting}
          >
            {voiceImporting ? "同期中…" : "⇧ ChatGPT採点ファイルを同期"}
            <input
              type="file"
              accept=".json,application/json"
              disabled={voiceImporting}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onImportVoiceResult(file);
              }}
            />
          </label>
        </div>
      </section>
      <UnitProgressList units={status.units} level={activeTrack} compact />
      {status.recentSessions.length > 0 && (
        <RecentSessions sessions={status.recentSessions} />
      )}
    </div>
  );
}

function TrackTabs({
  activeTrack,
  tracks,
  onChange,
}: {
  activeTrack: TrackCode;
  tracks: StatusResponse["tracks"];
  onChange: (track: TrackCode) => void;
}) {
  return (
    <div className="track-tabs" role="tablist" aria-label="CEFRコース">
      <span className="track-tabs-label">コース</span>
      {tracks.map((track) => (
        <button
          key={track.code}
          type="button"
          role="tab"
          aria-selected={activeTrack === track.code}
          className={
            activeTrack === track.code ? "track-tab active" : "track-tab"
          }
          onClick={() => onChange(track.code)}
        >
          {track.code}
          <small>{track.lessonCount} lessons</small>
        </button>
      ))}
    </div>
  );
}

function UnitProgressList({
  units,
  level,
  compact = false,
}: {
  units: StatusResponse["units"];
  level?: TrackCode;
  compact?: boolean;
}) {
  const trackLevel = level ?? units[0]?.trackCode ?? "A1";
  return (
    <section
      className={
        compact ? "unit-list-section compact-unit-list" : "unit-list-section"
      }
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{trackLevel} curriculum</span>
          <h2>{trackLevel} 全10 Unit・60 lessons</h2>
        </div>
        <span className="muted">
          {
            units.filter((unit) => unit.completedLessons === unit.totalLessons)
              .length
          }{" "}
          Unit完了
        </span>
      </div>
      <div className="unit-progress-list">
        {units.map((unit) => {
          const percent = Math.round(
            (unit.completedLessons / Math.max(unit.totalLessons, 1)) * 100,
          );
          return (
            <div className="unit-progress-row" key={unit.id}>
              <div className="unit-row-heading">
                <strong>
                  Unit {unit.unitNumber} · {unit.titleJa}
                </strong>
                <span>
                  {unit.completedLessons}/{unit.totalLessons}
                </span>
              </div>
              <div className="mini-progress">
                <span style={{ width: percent + "%" }} />
              </div>
              <small>
                {unit.titlePl} · Can-do {unit.canDoCompleted ?? 0}/
                {unit.canDoTotal ?? 0}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CurriculumView({
  status,
  activeTrack,
  onTrackChange,
  onStartLesson,
  onStatusChanged,
}: {
  status: StatusResponse;
  activeTrack: TrackCode;
  onTrackChange: (track: TrackCode) => void;
  onStartLesson: (lessonId: string) => void;
  onStatusChanged: () => void;
}) {
  const [openUnitId, setOpenUnitId] = useState<string | null>(
    status.units[0]?.id ?? null,
  );
  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">A1 / A2 curriculum</span>
        <h1>UnitsとCan-do</h1>
        <p>
          {status.curriculum.unitCount} Units・{status.curriculum.lessonCount}{" "}
          lessons・{status.curriculum.uniquePublishedItemCount}
          種類のpublished表現。教材完了、想起成績、ChatGPT Voice採点を分けて記録します。
        </p>
      </section>
      <TrackTabs
        activeTrack={activeTrack}
        tracks={status.tracks}
        onChange={(track) => {
          onTrackChange(track);
          setOpenUnitId(null);
        }}
      />
      <div className="unit-detail-list">
        {status.units.map((unit) => {
          const open = openUnitId === unit.id;
          const percent = Math.round(
            (unit.completedLessons / Math.max(unit.totalLessons, 1)) * 100,
          );
          return (
            <article className="unit-detail card" key={unit.id}>
              <button
                className="unit-toggle"
                type="button"
                aria-expanded={open}
                onClick={() => setOpenUnitId(open ? null : unit.id)}
              >
                <span>
                  <strong>
                    Unit {unit.unitNumber} · {unit.titleJa}
                  </strong>
                  <small>{unit.titlePl}</small>
                </span>
                <span>
                  {percent}% {open ? "−" : "+"}
                </span>
              </button>
              {open && (
                <div className="unit-detail-body">
                  <p className="unit-description">{unit.description}</p>
                  <div className="unit-detail-metrics">
                    <span>
                      教材 {unit.completedLessons}/{unit.totalLessons} lessons
                    </span>
                    <span>
                      Can-do {unit.canDoCompleted ?? 0}/{unit.canDoTotal ?? 0}
                    </span>
                  </div>
                  <div className="lesson-link-list">
                    {unit.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        className="lesson-link"
                        onClick={() => onStartLesson(lesson.id)}
                      >
                        <span>
                          <strong>
                            Lesson {lesson.lessonNumber} · {lesson.titleJa}
                          </strong>
                          <small>
                            {lesson.titlePl} · {lesson.stepCount} steps · Voice
                            mission
                          </small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                  <CanDoPanel unitId={unit.id} onChanged={onStatusChanged} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CanDoPanel({
  unitId,
  onChanged,
}: {
  unitId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<CanDoUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .cando(unitId)
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);
  async function update(
    id: string,
    status: CanDoUnit["items"][number]["status"],
  ) {
    setSavingId(id);
    try {
      const updated = await api.updateCando({ candoId: id, status });
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === id ? updated : item,
              ),
              completionPercent: Math.round(
                (current.items.filter(
                  (item) =>
                    (item.id === id ? status : item.status) ===
                      "self_assessed" ||
                    (item.id === id ? status : item.status) === "evidenced",
                ).length /
                  Math.max(current.items.length, 1)) *
                  100,
              ),
            }
          : current,
      );
      onChanged();
    } finally {
      setSavingId(null);
    }
  }
  if (loading)
    return (
      <div className="cando-panel inline-loading">
        <span className="loader" />
        Can-doを読み込み中…
      </div>
    );
  if (!data)
    return (
      <div className="cando-panel empty-card compact">
        <strong>Can-doを読み込めませんでした</strong>
      </div>
    );
  return (
    <section className="cando-panel" aria-label="Unit Can-do checklist">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Can-do checklist</span>
          <h3>このUnitでできること</h3>
        </div>
        <strong>{data.completionPercent}%</strong>
      </div>
      <div className="can-do-metrics">
        <span>
          教材完了 {data.unit.completedLessons}/{data.unit.totalLessons}
        </span>
        <span>
          想起{" "}
          {data.recallAccuracy === null ? "未計測" : data.recallAccuracy + "%"}
        </span>
        <span>
          Voice{" "}
          {data.voiceAverageConfidence === null
            ? "未記録"
            : data.voiceAverageConfidence + "/5"}
        </span>
      </div>
      <div className="cando-list">
        {data.items.map((item) => (
          <label className="cando-row" key={item.id}>
            <span>
              <strong>{item.statementJa}</strong>
              <small>
                {item.statementPl} · {item.skill}
              </small>
            </span>
            <select
              aria-label={item.statementJa}
              value={item.status}
              disabled={savingId === item.id}
              onChange={(event) =>
                void update(
                  item.id,
                  event.target.value as CanDoUnit["items"][number]["status"],
                )
              }
            >
              <option value="not_started">未着手</option>
              <option value="practicing">練習中</option>
              <option value="self_assessed">できる</option>
              <option value="evidenced">証拠あり</option>
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

function RecentSessions({
  sessions,
}: {
  sessions: StatusResponse["recentSessions"];
}) {
  return (
    <section className="recent-section">
      <div className="section-heading">
        <h2>最近の学習</h2>
        <span className="muted">記録済み</span>
      </div>
      <div className="recent-list">
        {sessions.map((session) => (
          <div className="recent-row" key={session.id}>
            <span className="recent-dot">✓</span>
            <div>
              <strong>{session.lessonTitle}</strong>
              <small>{session.mode === "review" ? "復習" : "レッスン"}</small>
            </div>
            <span>{formatDuration(session.durationMs)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewView({
  dueCount,
  onStart,
}: {
  dueCount: number;
  onStart: () => void;
}) {
  const [items, setItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void api
      .due(15)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">Review queue</span>
        <h1>復習</h1>
        <p>成績に応じて、4択から穴埋め・語順、自由入力へ段階的に進みます。</p>
      </section>
      <section className="review-hero card">
        <div className="big-number">{dueCount}</div>
        <div>
          <strong>期限到来</strong>
          <span>最大15件。難しい項目は足場を戻して、確実に思い出します。</span>
        </div>
        <button
          className="button primary full-width"
          type="button"
          onClick={onStart}
          disabled={dueCount === 0}
        >
          復習を始める <span aria-hidden="true">→</span>
        </button>
      </section>
      {loading ? (
        <div className="inline-loading">
          <span className="loader" />
          読み込み中…
        </div>
      ) : items.length > 0 ? (
        <section>
          <div className="section-heading">
            <h2>今回のキュー</h2>
            <span className="muted">{items.length}件</span>
          </div>
          <div className="due-list">
            {items.slice(0, 6).map((item) => (
              <div className="due-row" key={item.id}>
                <div>
                  <strong>{item.meaningJa}</strong>
                  <small>
                    {questionLabels[item.exercise.questionType]} ·{" "}
                    {difficultyLabel(item.reviewState.difficultyLevel)}
                  </small>
                </div>
                <span>{formatDueDate(item.reviewState.dueAt)}</span>
              </div>
            ))}
          </div>
          {items.length > 6 && (
            <p className="list-caption">
              ほか{items.length - 6}件は学習画面で続けて出題します。
            </p>
          )}
        </section>
      ) : (
        <div className="empty-card">
          <span className="empty-icon">✓</span>
          <strong>今は復習なし</strong>
          <p>新しいレッスンを進めると、復習キューが育ちます。</p>
        </div>
      )}
    </div>
  );
}

function LibraryView() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [items, setItems] = useState<
    Array<LearningItem & { reviewState: ReviewState | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api
        .items({ search, type })
        .then((data) => {
          if (!cancelled) setItems(data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, type]);
  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">Your library</span>
        <h1>ライブラリ</h1>
        <p>学んだ内容、誤答、文法タグを自分の辞書として見返せます。</p>
      </section>
      <div className="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          aria-label="教材を検索"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ポーランド語・日本語で検索"
        />
      </div>
      <div className="filter-row">
        <button
          type="button"
          className={!type ? "filter active" : "filter"}
          onClick={() => setType("")}
        >
          すべて
        </button>
        {[
          ["phrase", "表現"],
          ["sentence", "例文"],
          ["word", "単語"],
          ["grammar", "文法"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={type === value ? "filter active" : "filter"}
            onClick={() => setType(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="inline-loading">
          <span className="loader" />
          検索中…
        </div>
      ) : (
        <section className="library-list">
          {items.map((item) => (
            <LibraryItem item={item} key={item.id} />
          ))}
          {items.length === 0 && (
            <div className="empty-card">
              <strong>見つかりませんでした</strong>
              <p>検索語や種別を変えてみてください。</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function LibraryItem({
  item,
}: {
  item: LearningItem & { reviewState: ReviewState | null };
}) {
  const state = item.reviewState?.status ?? "new";
  const stateLabel: Record<string, string> = {
    new: "未学習",
    learning: "学習中",
    mastered: "定着",
    difficult: "苦手",
  };
  const typeLabel: Record<string, string> = {
    phrase: "表現",
    sentence: "例文",
    word: "単語",
    grammar: "文法",
  };
  return (
    <article className="library-item">
      <div className="library-item-top">
        <span className="type-pill">{typeLabel[item.type]}</span>
        <span className={"state-pill " + state}>{stateLabel[state]}</span>
      </div>
      <h2>{item.polish}</h2>
      <p>{item.meaningJa}</p>
      <span className="english-line">{item.meaningEn}</span>
      <div className="tag-row">
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag}>
            {tag.replace(/^(cefr|topic|grammar|skill):/u, "")}
          </span>
        ))}
      </div>
      {item.reviewState && (
        <small className="review-meta">
          次回: {formatDueDate(item.reviewState.dueAt)} ·{" "}
          {difficultyLabel(item.reviewState.difficultyLevel)}
        </small>
      )}
    </article>
  );
}

function ProgressView({ status }: { status: StatusResponse }) {
  const [mistakes, setMistakes] = useState<MistakeSummary[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [voiceResults, setVoiceResults] = useState<VoiceResult[]>([]);
  useEffect(() => {
    void Promise.all([api.mistakes(), api.history(12), api.voiceResults(12)])
      .then(([nextMistakes, nextHistory, nextVoiceResults]) => {
        setMistakes(nextMistakes);
        setHistory(nextHistory);
        setVoiceResults(nextVoiceResults);
      })
      .catch(() => undefined);
  }, []);
  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">Your progress</span>
        <h1>進捗</h1>
        <p>教材完了率、想起成績、ChatGPT Voiceの採点結果を別々に確認できます。</p>
      </section>
      <section className="metric-grid">
        <Metric
          label="今週の学習日"
          value={status.progress.studyDaysThisWeek + "日"}
          note={"連続 " + status.progress.streakDays + "日"}
        />
        <Metric
          label="今週の時間"
          value={status.progress.minutesThisWeek + "分"}
          note="学習セッション"
        />
        <Metric
          label="定着した項目"
          value={String(status.progress.masteredItems)}
          note={"学習済み " + status.progress.learnedItems}
        />
        <Metric
          label="期限切れ"
          value={String(status.progress.dueReviews)}
          note="復習キュー"
        />
      </section>
      <section className="curriculum-summary card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A1 + A2</span>
            <h2>全体の教材</h2>
          </div>
          <strong>{status.curriculum.uniquePublishedItemCount}</strong>
        </div>
        <div className="summary-stat-grid">
          <span>
            <b>{status.curriculum.unitCount}</b> Units
          </span>
          <span>
            <b>{status.curriculum.lessonCount}</b> lessons
          </span>
          <span>
            <b>{status.curriculum.a1ItemCount}</b> A1 items
          </span>
          <span>
            <b>{status.curriculum.a2ItemCount}</b> A2 items
          </span>
        </div>
      </section>
      <UnitProgressList
        units={status.units}
        level={status.track.code as TrackCode}
      />
      <section className="recommendation-card card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Next actions</span>
            <h2>次にやること</h2>
          </div>
          <span className="muted">おすすめ</span>
        </div>
        <div className="recommendation-list">
          {status.recommendations.slice(0, 4).map((recommendation) => (
            <div className="recommendation-row" key={recommendation.kind}>
              <span className="recommendation-kind">
                {recommendation.kind === "review"
                  ? "復習"
                  : recommendation.kind === "voice"
                    ? "Voice"
                    : recommendation.kind === "cando"
                      ? "Can-do"
                      : "Lesson"}
              </span>
              <div>
                <strong>{recommendation.title}</strong>
                <small>{recommendation.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="weakness-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Weak points</span>
            <h2>苦手な文法タグ・技能</h2>
          </div>
          <span className="muted">誤答から集計</span>
        </div>
        {mistakes.length === 0 ? (
          <div className="empty-card compact">
            <strong>まだ誤答データはありません</strong>
            <p>学習すると、間違えたパターンがここに現れます。</p>
          </div>
        ) : (
          <div className="weakness-list">
            {mistakes.slice(0, 6).map((mistake) => (
              <WeaknessRow mistake={mistake} key={mistake.tag} />
            ))}
          </div>
        )}
      </section>
      <section className="history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Recent attempts</span>
            <h2>回答履歴</h2>
          </div>
          <span className="muted">{history.length}件</span>
        </div>
        {history.length === 0 ? (
          <div className="empty-card compact">
            <strong>まだ回答履歴はありません</strong>
          </div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div className="history-row" key={entry.id}>
                <span
                  className={
                    "history-verdict " + (entry.isCorrect ? "good" : "bad")
                  }
                >
                  {entry.isCorrect ? "✓" : "!"}
                </span>
                <div>
                  <strong>{entry.polish}</strong>
                  <small>
                    {questionLabels[entry.questionType]} ·{" "}
                    {entry.rating ?? "未評価"} ·{" "}
                    {entry.difficultyAfter === null
                      ? ""
                      : difficultyLabel(entry.difficultyAfter ?? 0)}
                  </small>
                </div>
                <time dateTime={entry.createdAt}>
                  {formatDuration(entry.elapsedMs)}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="voice-history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ChatGPT Voice</span>
            <h2>Voice結果履歴</h2>
          </div>
          <span className="muted">{voiceResults.length}件</span>
        </div>
        {voiceResults.length === 0 ? (
          <div className="empty-card compact">
            <strong>まだVoice結果はありません</strong>
            <p>ChatGPTが作成した採点ファイルを同期すると、ここに結果が表示されます。</p>
          </div>
        ) : (
          <div className="voice-history-list">
            {voiceResults.map((result) => (
              <div className="voice-history-row" key={result.id}>
                <div>
                  <strong>
                    {result.sourceKind === "chatgpt_file"
                      ? `ChatGPT採点 ${result.overallScore?.toFixed(1) ?? "-"}/5`
                      : `自信度 ${result.confidence}/5`}
                  </strong>
                  <small>
                    {result.sourceKind === "chatgpt_file"
                      ? "採点ファイルから同期"
                      : `${result.heard ? "聞けた" : "聞き取り要練習"} · ${result.replied ? "返答できた" : "返答要練習"} · ${result.needsRestatement ? "言い直しあり" : "言い直しなし"}`}
                  </small>
                  {result.notes && <p>{result.notes}</p>}
                  {result.feedback?.nextStep && (
                    <p className="voice-next-step">
                      次: {result.feedback.nextStep}
                    </p>
                  )}
                </div>
                <time dateTime={result.evaluatedAt ?? result.createdAt}>
                  {new Date(
                    result.evaluatedAt ?? result.createdAt,
                  ).toLocaleDateString("ja-JP")}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function WeaknessRow({ mistake }: { mistake: MistakeSummary }) {
  return (
    <div className="weakness-row">
      <div>
        <strong>{mistake.tag.replace(/^(grammar|skill):/u, "")}</strong>
        <small>{mistake.examples.join(" · ")}</small>
      </div>
      <span>{mistake.count}回</span>
    </div>
  );
}

export default App;
