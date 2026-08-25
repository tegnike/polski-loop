import { useCallback, useEffect, useState } from "react";
import { BottomNav, type AppView } from "./components/BottomNav";
import AIChat from "./components/AIChat";
import PronunciationButton from "./components/PronunciationButton";
import StudyFlow from "./components/StudyFlow";
import { api, downloadExport } from "./lib/api";
import { buildAppAiContext } from "./lib/ai-context";
import { downloadTextFile } from "./lib/download";
import { difficultyLabel, formatDueDate, formatDuration } from "./lib/learning";
import { isActiveProgressDay, longestActivityStreak } from "./lib/progress";
import type {
  CanDoUnit,
  DailyProgressActivity,
  DueItem,
  LearningItem,
  MistakeSummary,
  QuestionType,
  ReviewState,
  StatusResponse,
  TimelineEvent,
  TimelineFilter,
  TrackCode,
  VoiceResultImport,
} from "./lib/types";

type StudyRequest = { mode: "lesson" | "review"; lessonId?: string };
type ProgressTab = "overview" | "analysis" | "history";
const noticeFadeDelayMs = 2_500;
const noticeDismissDelayMs = 3_000;

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
  const [progressTab, setProgressTab] = useState<ProgressTab>("overview");
  const [study, setStudy] = useState<StudyRequest | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceImporting, setVoiceImporting] = useState(false);
  const dismissNotice = useCallback(() => setNotice(null), []);

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
        <img className="brand-mark small" src="/icon.svg" alt="" />
        <span className="loader" />
        読み込み中…
      </div>
    );
  if (error || !status)
    return (
      <div className="app-loading error-screen">
        <img className="brand-mark" src="/icon.svg" alt="" />
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
          <img className="brand-mark" src="/icon.svg" alt="" />
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
        <AutoDismissNotice
          key={notice}
          message={notice}
          onDismiss={dismissNotice}
        />
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
        {view === "progress" && (
          <ProgressView
            status={status}
            activeTab={progressTab}
            onTabChange={setProgressTab}
          />
        )}
      </main>
      <AIChat
        context={buildAppAiContext(
          status,
          view === "progress" && progressTab === "history" ? "history" : view,
          activeTrack,
        )}
      />
      <BottomNav current={view} onChange={setView} />
    </div>
  );
}

function AutoDismissNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(
      () => setFading(true),
      noticeFadeDelayMs,
    );
    const dismissTimer = window.setTimeout(onDismiss, noticeDismissDelayMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <button
      className={`toast${fading ? " fading" : ""}`}
      type="button"
      aria-label={`${message} 通知を閉じる`}
      onClick={onDismiss}
    >
      {message}
      <span aria-hidden="true">×</span>
    </button>
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
        <strong>AIとの会話</strong>
        <span>
          「AIに聞く」から質問やテキストのロールプレイができます。音声会話はChatGPT Voiceを使います。
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
      <div className="pronounceable-heading">
        <h2>{item.polish}</h2>
        <PronunciationButton text={item.polish} speakerGender={item.speakerGender} />
      </div>
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

const progressTabs: Array<{ id: ProgressTab; label: string }> = [
  { id: "overview", label: "概要" },
  { id: "analysis", label: "分析" },
  { id: "history", label: "履歴" },
];

const progressDescriptions: Record<ProgressTab, string> = {
  overview: "今日の一歩と、直近の学習リズムを確認できます。",
  analysis: "28日間の積み上げと、誤答から見える苦手を振り返れます。",
  history: "回答、学習セッション、ChatGPT Voice採点を時系列で遡れます。",
};

function ProgressView({
  status,
  activeTab,
  onTabChange,
}: {
  status: StatusResponse;
  activeTab: ProgressTab;
  onTabChange: (tab: ProgressTab) => void;
}) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <span className="eyebrow">Your progress</span>
        <h1>進捗</h1>
        <p>{progressDescriptions[activeTab]}</p>
      </section>
      <div className="progress-tabs" role="tablist" aria-label="進捗の表示内容">
        {progressTabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "progress-tab active" : "progress-tab"}
            id={`progress-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-controls="progress-panel"
            aria-selected={activeTab === tab.id}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section
        className="progress-tab-panel"
        id="progress-panel"
        role="tabpanel"
        aria-labelledby={`progress-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "overview" && <ProgressOverview status={status} />}
        {activeTab === "analysis" && <ProgressAnalysis status={status} />}
        {activeTab === "history" && <HistoryView />}
      </section>
    </div>
  );
}

function ProgressOverview({ status }: { status: StatusResponse }) {
  return (
    <>
      <TodayProgressCard status={status} />
      <section className="metric-grid">
        <Metric
          label="現在の連続"
          value={status.progress.streakDays + "日"}
          note="学習記録"
        />
        <Metric
          label="28日中"
          value={
            status.progress.dailyActivity.filter(isActiveProgressDay).length +
            "日"
          }
          note={
            "最長 " + longestActivityStreak(status.progress.dailyActivity) + "日"
          }
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
      <WeeklyActivityChart status={status} />
    </>
  );
}

function ProgressAnalysis({ status }: { status: StatusResponse }) {
  const [mistakes, setMistakes] = useState<MistakeSummary[]>([]);

  useEffect(() => {
    void api.mistakes().then(setMistakes).catch(() => undefined);
  }, []);

  return (
    <>
      <ActivityCalendar status={status} />
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
    </>
  );
}

function progressDateLabel(date: string, weekday = false): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    ...(weekday ? { weekday: "short" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function progressWeekdayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    weekday: "narrow",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function progressActivityText(day: DailyProgressActivity): string {
  const accuracy = day.attempts
    ? `、正答 ${day.correctAttempts}/${day.attempts}`
    : "";
  return `${progressDateLabel(day.date, true)}：${day.minutes}分、回答 ${day.attempts}問${accuracy}、Voice ${day.voiceResults}件`;
}

const emptyProgressDay: DailyProgressActivity = {
  date: "",
  completedSessions: 0,
  lessonSessions: 0,
  reviewSessions: 0,
  minutes: 0,
  attempts: 0,
  correctAttempts: 0,
  voiceResults: 0,
};

function TodayProgressCard({ status }: { status: StatusResponse }) {
  const activity = status.progress.dailyActivity;
  const today = activity.at(-1) ?? emptyProgressDay;
  const todayAccuracy = today.attempts
    ? Math.round((today.correctAttempts / today.attempts) * 100)
    : null;
  const todayActive = isActiveProgressDay(today);

  return (
    <section className={`today-progress card${todayActive ? " active" : ""}`}>
      <div className="today-progress-heading">
        <div>
          <span className="eyebrow">Today</span>
          <h2>{todayActive ? "今日も積み上がっています" : "今日はここから"}</h2>
          <p>
            {todayActive
              ? today.completedSessions > 0
                ? `${today.completedSessions}セッションの学習を記録しました。`
                : "回答またはVoiceの学習記録が残っています。"
              : "1問でも始めれば、今日のマスに色がつきます。"}
          </p>
        </div>
        <span className="today-check" aria-hidden="true">
          {todayActive ? "✓" : "○"}
        </span>
      </div>
      <div className="today-stat-grid">
        <span>
          <strong>{today.minutes}</strong>
          <small>分</small>
          <b>学習時間</b>
        </span>
        <span>
          <strong>{today.attempts}</strong>
          <small>問</small>
          <b>回答</b>
        </span>
        <span>
          <strong>{todayAccuracy ?? "—"}</strong>
          <small>{todayAccuracy === null ? "" : "%"}</small>
          <b>正答率</b>
        </span>
      </div>
    </section>
  );
}

function WeeklyActivityChart({ status }: { status: StatusResponse }) {
  const recentWeek = status.progress.dailyActivity.slice(-7);
  const maxMinutes = Math.max(1, ...recentWeek.map((day) => day.minutes));

  return (
    <section className="activity-chart card" aria-labelledby="week-chart-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Last 7 days</span>
          <h2 id="week-chart-title">毎日の学習時間</h2>
        </div>
        <strong>{recentWeek.reduce((sum, day) => sum + day.minutes, 0)}分</strong>
      </div>
      <div className="week-bars" role="group" aria-label="直近7日間の学習時間グラフ">
        {recentWeek.map((day) => {
          const activeWithoutMinutes = isActiveProgressDay(day) && day.minutes === 0;
          const height = day.minutes
            ? Math.max(10, Math.round((day.minutes / maxMinutes) * 100))
            : activeWithoutMinutes
              ? 6
              : 2;
          return (
            <div className="week-bar-column" key={day.date}>
              <span className="week-bar-value">
                {day.minutes ? day.minutes : activeWithoutMinutes ? "•" : ""}
              </span>
              <button
                className={`week-bar${isActiveProgressDay(day) ? " active" : ""}`}
                type="button"
                aria-label={progressActivityText(day)}
              >
                <span style={{ height: height + "%" }} />
                <span className="chart-tooltip" role="tooltip">
                  {progressActivityText(day)}
                </span>
              </button>
              <small>{progressWeekdayLabel(day.date)}</small>
            </div>
          );
        })}
      </div>
      <p className="chart-note">棒に触れると、その日の回答数や正答数も確認できます。</p>
    </section>
  );
}

function ActivityCalendar({ status }: { status: StatusResponse }) {
  const activity = status.progress.dailyActivity;
  const activeDays = activity.filter(isActiveProgressDay).length;
  const totalMinutes = activity.reduce((sum, day) => sum + day.minutes, 0);
  const totalAttempts = activity.reduce((sum, day) => sum + day.attempts, 0);
  const totalCorrect = activity.reduce(
    (sum, day) => sum + day.correctAttempts,
    0,
  );
  const maxActivityScore = Math.max(
    1,
    ...activity.map(
      (day) =>
        day.minutes +
        day.attempts +
        day.completedSessions * 3 +
        day.voiceResults * 5,
    ),
  );

  return (
    <section className="activity-calendar card" aria-labelledby="activity-calendar-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Last 28 days</span>
          <h2 id="activity-calendar-title">学習リズム</h2>
        </div>
        <strong>{activeDays}日</strong>
      </div>
      <div className="calendar-summary">
        <span><b>{totalMinutes}</b>分</span>
        <span><b>{totalAttempts}</b>問</span>
        <span>
          <b>{totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : "—"}</b>
          {totalAttempts ? "% 正答" : " 正答率"}
        </span>
      </div>
      <div className="activity-weekdays" aria-hidden="true">
        {activity.slice(0, 7).map((day) => (
          <span key={day.date}>{progressWeekdayLabel(day.date)}</span>
        ))}
      </div>
      <div className="activity-grid" aria-label="直近28日間の学習記録">
        {activity.map((day) => {
          const score =
            day.minutes +
            day.attempts +
            day.completedSessions * 3 +
            day.voiceResults * 5;
          const level = score === 0
            ? 0
            : Math.max(1, Math.ceil((score / maxActivityScore) * 4));
          return (
            <button
              className={`activity-cell level-${level}`}
              type="button"
              key={day.date}
              aria-label={progressActivityText(day)}
            >
              <span className="chart-tooltip" role="tooltip">
                {progressActivityText(day)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="calendar-caption">
        <span>{progressDateLabel(activity[0]?.date ?? "")}</span>
        <span>濃いほど、その日の学習量が多い</span>
        <span>今日</span>
      </div>
    </section>
  );
}

const timelineFilters: Array<{ id: TimelineFilter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "attempt", label: "回答" },
  { id: "session", label: "セッション" },
  { id: "voice", label: "Voice" },
];

function dateKey(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
function displayDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(value));
}
function displayTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function lessonContext(event: Pick<TimelineEvent, "trackCode" | "unitNumber" | "lessonTitle">): string {
  const parts = [event.trackCode, event.unitNumber ? `Unit ${event.unitNumber}` : null, event.lessonTitle].filter(Boolean);
  return parts.join(" · ") || "学習記録";
}

function HistoryView() {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [items, setItems] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (nextFilter: TimelineFilter) => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await api.timeline({ type: nextFilter, limit: 25 });
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch (nextError) {
      setItems([]);
      setCursor(null);
      setLoadError(nextError instanceof Error ? nextError.message : "履歴を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadFirstPage(filter); }, [filter, loadFirstPage]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await api.timeline({ type: filter, cursor, limit: 25 });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (nextError) {
      setLoadError(nextError instanceof Error ? nextError.message : "続きの履歴を読み込めませんでした。");
    } finally {
      setLoadingMore(false);
    }
  }

  let previousDate = "";
  return (
    <div className="history-page progress-history">
      <h2 className="visually-hidden">学習履歴</h2>
      <div className="filter-row history-filters" role="tablist" aria-label="履歴の種類">
        {timelineFilters.map((entry) => (
          <button className={filter === entry.id ? "filter active" : "filter"} type="button" role="tab"
            aria-selected={filter === entry.id} key={entry.id} onClick={() => setFilter(entry.id)}>{entry.label}</button>
        ))}
      </div>
      {loading ? (
        <div className="inline-loading"><span className="loader" />履歴を読み込み中…</div>
      ) : items.length === 0 && !loadError ? (
        <div className="empty-card"><strong>この種類の履歴はまだありません</strong><p>学習すると、ここから過去の記録を遡れます。</p></div>
      ) : (
        <div className="timeline-list">
          {items.map((event) => {
            const currentDate = dateKey(event.occurredAt);
            const showDate = currentDate !== previousDate;
            previousDate = currentDate;
            return <div key={`${event.type}-${event.id}`}>
              {showDate && <h2 className="timeline-date">{displayDate(event.occurredAt)}</h2>}
              <TimelineCard event={event} />
            </div>;
          })}
        </div>
      )}
      {loadError && <div className="history-load-error" role="alert">{loadError}</div>}
      {cursor && !loading && (
        <button className="button secondary history-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "読み込み中…" : "さらに過去を読み込む"}
        </button>
      )}
      {!cursor && items.length > 0 && <p className="history-end">すべての履歴を表示しました</p>}
    </div>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  if (event.type === "attempt") return (
    <details className="timeline-card card">
      <summary>
        <span className={"timeline-icon " + (event.isCorrect ? "attempt-good" : "attempt-bad")}>{event.isCorrect ? "✓" : "!"}</span>
        <span className="timeline-summary"><small>回答 · {lessonContext(event)}</small><strong>{event.polish}</strong><span>{questionLabels[event.questionType]} · {formatDuration(event.elapsedMs)}</span></span>
        <time dateTime={event.occurredAt}>{displayTime(event.occurredAt)}</time>
      </summary>
      <div className="timeline-detail">
        <dl><div><dt>回答</dt><dd>{event.answer || "（空欄）"}</dd></div><div><dt>正答</dt><dd>{event.expectedAnswer}</dd></div><div><dt>意味</dt><dd>{event.meaningJa}</dd></div><div><dt>評価</dt><dd>{event.rating ?? "未評価"}</dd></div></dl>
      </div>
    </details>
  );
  if (event.type === "session") return (
    <details className="timeline-card card">
      <summary>
        <span className="timeline-icon session-icon">◷</span>
        <span className="timeline-summary"><small>セッション · {lessonContext(event)}</small><strong>{event.mode === "review" ? "復習" : event.lessonTitle ?? "レッスン"}</strong><span>{event.completedAt ? formatDuration(event.durationMs) : "未完了"}</span></span>
        <time dateTime={event.occurredAt}>{displayTime(event.occurredAt)}</time>
      </summary>
      <div className="timeline-detail"><dl><div><dt>種類</dt><dd>{event.mode === "review" ? "復習" : "レッスン"}</dd></div><div><dt>開始</dt><dd>{new Date(event.startedAt).toLocaleString("ja-JP")}</dd></div><div><dt>状態</dt><dd>{event.completedAt ? "完了" : "未完了"}</dd></div></dl></div>
    </details>
  );
  return (
    <details className="timeline-card card">
      <summary>
        <span className="timeline-icon voice-icon">V</span>
        <span className="timeline-summary"><small>Voice · {lessonContext(event)}</small><strong>{event.missionTitle}</strong><span>{event.sourceKind === "chatgpt_file" ? `ChatGPT採点 ${event.overallScore?.toFixed(1) ?? "-"}/5` : `旧自己評価 ${event.confidence}/5`}</span></span>
        <time dateTime={event.occurredAt}>{displayTime(event.occurredAt)}</time>
      </summary>
      <div className="timeline-detail voice-timeline-detail">
        {event.scores && <dl><div><dt>課題達成</dt><dd>{event.scores.taskCompletion}/5</dd></div><div><dt>理解</dt><dd>{event.scores.comprehension}/5</dd></div><div><dt>返答正確性</dt><dd>{event.scores.responseAccuracy}/5</dd></div><div><dt>目標表現</dt><dd>{event.scores.targetExpressionUse}/5</dd></div><div><dt>流暢性</dt><dd>{event.scores.interactionFluency}/5</dd></div></dl>}
        {event.feedback?.summary && <p><strong>総評</strong>{event.feedback.summary}</p>}
        {event.feedback?.nextStep && <p><strong>次の練習</strong>{event.feedback.nextStep}</p>}
        {event.notes && <p><strong>メモ</strong>{event.notes}</p>}
      </div>
    </details>
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
