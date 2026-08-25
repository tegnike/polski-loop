import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { downloadTextFile } from "../lib/download";
import { formatDueDate, seededShuffleIndexes, suggestedReviewRating } from "../lib/learning";
import AIChat from "./AIChat";
import PronunciationButton from "./PronunciationButton";
import type {
  AiPageContext, AttemptResult, DueItem, ExerciseShape, Lesson, LessonStep, PromptDirection, QuestionType, ReviewRating, VoiceMission, VoiceResultImport,
} from "../lib/types";

interface StudyFlowProps {
  mode: "lesson" | "review";
  lessonId?: string;
  onFinished: () => void;
  onBack: () => void;
}

const chips = ["ą", "ć", "ę", "ł", "ń", "ó", "ś", "ź", "ż"];
const ratingLabels: Record<ReviewRating, string> = { again: "もう一度", hard: "難しい", good: "正解", easy: "簡単" };
const questionLabels: Record<QuestionType, string> = {
  multiple_choice: "認識・4択",
  cloze: "足場付き想起・穴埋め",
  unscramble: "足場付き想起・語順",
  free_input: "自由想起・自由入力",
};

function directionLabel(direction: PromptDirection): string {
  return direction === "polish_to_meaning" ? "ポーランド語 → 意味" : "意味 → ポーランド語";
}

function isLessonStep(value: LessonStep | DueItem): value is LessonStep {
  return "stepNumber" in value;
}

export default function StudyFlow({ mode, lessonId, onFinished, onBack }: StudyFlowProps) {
  const sessionIdempotencyKey = useRef(crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(Date.now());
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [reviewRating, setReviewRating] = useState<ReviewRating | null>(null);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = await api.startSession(mode, lessonId, sessionIdempotencyKey.current);
        const content = mode === "lesson" && lessonId ? await api.lesson(lessonId) : await api.due(15);
        if (cancelled) return;
        setSessionId(session.id);
        setSessionStartedAt(Date.now());
        setStartedAt(Date.now());
        if (mode === "lesson") setLesson(content as Lesson);
        else setDueItems(content as DueItem[]);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "教材を読み込めませんでした。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [lessonId, mode]);

  const currentStep: LessonStep | DueItem | null = mode === "lesson" ? lesson?.steps[index] ?? null : dueItems[index] ?? null;
  const total = mode === "lesson" ? lesson?.steps.length ?? 0 : dueItems.length;
  const currentItem = currentStep && isLessonStep(currentStep) ? currentStep.item : currentStep;
  const exercise: ExerciseShape | null = currentStep
    ? isLessonStep(currentStep)
      ? currentStep
      : currentStep.exercise
    : null;
  const prompt = currentStep && isLessonStep(currentStep)
    ? exercise?.questionType === "multiple_choice" && exercise.direction === "polish_to_meaning"
      ? currentItem?.polish ?? currentStep.promptJa
      : currentStep.promptJa
    : exercise?.questionType === "multiple_choice"
      ? exercise.direction === "polish_to_meaning" ? currentItem?.polish ?? "" : currentItem?.meaningJa ?? ""
      : currentItem?.meaningJa ?? "";
  const explanation = currentStep && isLessonStep(currentStep) ? currentStep.explanation : currentItem?.grammarNote ?? "";
  const progress = total > 0 ? ((index + (result ? 1 : 0)) / total) * 100 : 0;
  const isLast = index >= total - 1;
  const itemKey = currentItem && exercise ? currentItem.id + ":" + exercise.questionType + ":" + index : "empty";
  const aiContextLines = [
    `学習種別: ${mode === "review" ? "復習" : "レッスン"}`,
    `レッスン: ${lesson?.titleJa ?? (mode === "review" ? "復習キュー" : "")}`,
    `進捗: ${index + 1} / ${total}`,
  ];
  if (currentItem && exercise) {
    aiContextLines.push(
      `問題形式: ${questionLabels[exercise.questionType]}`,
      `出題方向: ${directionLabel(exercise.direction)}`,
      `問題: ${prompt}`,
      `学習表現: ${currentItem.polish}`,
      `日本語の意味: ${currentItem.meaningJa}`,
      `英語の意味: ${currentItem.meaningEn}`,
      `文法メモ: ${explanation || currentItem.grammarNote}`,
      `場面: ${currentItem.situation ?? "未指定"}`,
      `文体: ${currentItem.register ?? "neutral"}`,
    );
    if (exercise.hintText) aiContextLines.push(`ヒント: ${exercise.hintText}`);
    if (exercise.options.length) aiContextLines.push(`選択肢: ${exercise.options.map((option) => option.label).join(" / ")}`);
    if (exercise.tokens.length) aiContextLines.push(`並べ替え語: ${exercise.tokens.join(" / ")}`);
    if (exercise.questionType === "cloze") aiContextLines.push(`穴埋め文: ${exercise.clozePrefix} _____ ${exercise.clozeSuffix}`);
    if (answer) aiContextLines.push(`利用者の入力中または送信済み回答: ${answer}`);
    if (result) aiContextLines.push(`判定: ${result.verdict}`, `正解: ${result.expectedAnswer}`, `フィードバック: ${result.feedback}`);
  }
  if (lesson?.mission) {
    aiContextLines.push(
      `Voice mission: ${lesson.mission.title}`,
      `ロールプレイ場面: ${lesson.mission.scenario}`,
      `学習者の役割: ${lesson.mission.learnerRole}`,
      `相手の役割: ${lesson.mission.partnerRole}`,
      `必須表現: ${lesson.mission.requiredExpressions.join(" / ")}`,
      `相手側の表現: ${lesson.mission.partnerExpressions.join(" / ")}`,
    );
  }
  const aiContext: AiPageContext = {
    key: `study:${mode}:${sessionId ?? sessionIdempotencyKey.current}:${itemKey}`,
    label: mode === "review" ? `復習 ${index + 1}/${total}` : `${lesson?.titleJa ?? "レッスン"} ${index + 1}/${total}`,
    content: aiContextLines.join("\n"),
  };

  useEffect(() => {
    setAnswer("");
    setResult(null);
    setReviewRating(null);
    setSelectedTokens([]);
    if (exercise?.questionType === "free_input" || exercise?.questionType === "cloze") {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [itemKey, exercise?.questionType]);

  const shuffledTokenIndexes = useMemo(
    () => exercise?.questionType === "unscramble" ? seededShuffleIndexes(exercise.tokens.length, sessionIdempotencyKey.current + ":tokens:" + itemKey) : [],
    [exercise, itemKey],
  );
  const shuffledOptionIndexes = useMemo(
    () => exercise?.questionType === "multiple_choice" ? seededShuffleIndexes(exercise.options.length, sessionIdempotencyKey.current + ":options:" + itemKey) : [],
    [exercise, itemKey],
  );

  function insertChip(chip: string) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? answer.length;
    const end = input.selectionEnd ?? answer.length;
    const next = answer.slice(0, start) + chip + answer.slice(end);
    setAnswer(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + chip.length, start + chip.length);
    });
  }

  function chooseToken(tokenIndex: number) {
    if (!exercise || selectedTokens.includes(tokenIndex)) return;
    const nextTokens = [...selectedTokens, tokenIndex];
    setSelectedTokens(nextTokens);
    setAnswer(nextTokens.map((indexValue) => exercise.tokens[indexValue]).join(" "));
  }

  function undoToken() {
    const nextTokens = selectedTokens.slice(0, -1);
    setSelectedTokens(nextTokens);
    setAnswer(exercise?.tokens ? nextTokens.map((indexValue) => exercise.tokens[indexValue]).join(" ") : "");
  }

  async function submitAnswer() {
    if (!currentItem || !exercise || !sessionId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await api.attempt({
        itemId: currentItem.id,
        answer: answer.trim(),
        idempotencyKey: sessionId + ":" + currentItem.id + ":" + index,
        sessionId,
        lessonId,
        stepId: currentStep && isLessonStep(currentStep) ? currentStep.id : undefined,
        questionType: exercise.questionType,
        direction: exercise.direction,
        elapsedMs: Date.now() - startedAt,
        autoRate: mode === "lesson",
      });
      setResult(next);
      if (mode === "review") setReviewRating(suggestedReviewRating(next.isCorrect));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "回答を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    if (sessionId) await api.completeSession(sessionId, Date.now() - sessionStartedAt);
    setCompleted(true);
  }

  async function nextStep() {
    if (!result || !exercise) return;
    setSaving(true);
    try {
      if (mode === "review" && currentItem && reviewRating) {
        const rated = await api.rateReview({
          itemId: currentItem.id,
          rating: reviewRating,
          attemptId: result.attemptId,
          questionType: exercise.questionType,
          direction: exercise.direction,
        });
        setResult(rated);
      }
      if (isLast) {
        await finish();
        return;
      }
      setIndex((value) => value + 1);
      setStartedAt(Date.now());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "復習結果を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="screen-state"><span className="loader" />教材を準備しています…</div>;
  if (error) return <div className="screen-state"><p className="error-text">{error}</p><button className="button secondary" type="button" onClick={onBack}>戻る</button></div>;
  if (completed) return <VoiceCompletion mission={lesson?.mission ?? null} onFinished={onFinished} sessionId={sessionId} />;
  if (!currentItem || !exercise || total === 0) {
    return (
      <div className="screen-state empty-state">
        <span className="empty-icon">✓</span>
        <h2>{mode === "review" ? "復習はありません" : "レッスンが空です"}</h2>
        <p>{mode === "review" ? "今は期限到来の項目がありません。今日のレッスンを進めましょう。" : "教材データを確認してください。"}</p>
        <button className="button primary" type="button" onClick={onBack}>今日へ戻る</button>
      </div>
    );
  }

  const targetIsPolish = exercise.direction === "meaning_to_polish" || exercise.questionType !== "multiple_choice";
  const showInput = exercise.questionType === "free_input" || exercise.questionType === "cloze";
  const showMeaning = exercise.questionType !== "multiple_choice";
  const visiblePrompt = exercise.questionType === "cloze"
    ? <span className="cloze-sentence"><span>{exercise.clozePrefix} </span><mark>______</mark><span> {exercise.clozeSuffix}</span></span>
    : exercise.questionType === "unscramble"
      ? "単語を正しい順番に並べましょう。"
      : prompt;

  return (
    <div className="study-shell">
      <header className="study-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="学習を終了">←</button>
        <div className="study-heading">
          <span>{mode === "review" ? "復習キュー" : lesson?.titleJa}</span>
          <strong>{index + 1} / {total}</strong>
        </div>
        <span className="study-time">{mode === "review" ? formatDueDate(currentStep && !isLessonStep(currentStep) ? currentStep.reviewState.dueAt : new Date().toISOString()) : lesson?.mission?.difficultyLevel ?? "A1"}</span>
      </header>
      <div className="progress-track study-progress" aria-label={"学習進捗 " + Math.round(progress) + "%"}><span style={{ width: Math.min(100, progress) + "%" }} /></div>

      <main className="study-card-area">
        {lesson?.mission && <VoiceMissionCard mission={lesson.mission} />}
        <div className="study-stage-row">
          <p className="eyebrow">{questionLabels[exercise.questionType]}</p>
          <span className="direction-pill">{directionLabel(exercise.direction)}</span>
        </div>
        <p className="study-hint">{mode === "review" ? (currentStep && !isLessonStep(currentStep) ? currentStep.exercise.hintText : "") : "認識 → 足場付き想起 → 自由想起"}</p>
        <div className="study-prompt-row">
          <h1 className="study-prompt">{visiblePrompt}</h1>
          {exercise.questionType === "multiple_choice" && exercise.direction === "polish_to_meaning" && (
            <PronunciationButton text={currentItem.polish} speakerGender={currentItem.speakerGender} className="pronunciation-large" />
          )}
        </div>
        {showMeaning && <div className="meaning-box"><span className="meaning-label">日本語</span><span>{currentItem.meaningJa}</span></div>}

        {exercise.questionType === "multiple_choice" && (
          <div className="choice-list" role="group" aria-label={directionLabel(exercise.direction)}>
            {shuffledOptionIndexes.map((optionIndex) => exercise.options[optionIndex]).map((option) => (
              <div className="choice-row" key={option.value}>
                <button type="button" className={"choice-option" + (answer === option.value ? " selected" : "")} aria-pressed={answer === option.value} onClick={() => setAnswer(option.value)} disabled={Boolean(result)}>
                  <span className="choice-marker" aria-hidden="true">{answer === option.value ? "✓" : ""}</span><span>{option.label}</span>
                </button>
                {exercise.direction === "meaning_to_polish" && <PronunciationButton text={option.label} />}
              </div>
            ))}
          </div>
        )}

        {exercise.questionType === "unscramble" && (
          <div className="token-area" role="group" aria-label="語順を並べ替える">
            <div className="selected-token-row" aria-live="polite">
              {selectedTokens.length === 0 ? <span className="token-placeholder">下の単語を順番に選びます</span> : selectedTokens.map((tokenIndex) => <span className="selected-token" key={tokenIndex}>{exercise.tokens[tokenIndex]}</span>)}
            </div>
            <div className="token-bank">
              {shuffledTokenIndexes.map((tokenIndex) => <button className="token-button" type="button" key={tokenIndex} onClick={() => chooseToken(tokenIndex)} disabled={selectedTokens.includes(tokenIndex) || Boolean(result)}>{exercise.tokens[tokenIndex]}</button>)}
            </div>
            <button className="plain-button token-undo" type="button" onClick={undoToken} disabled={selectedTokens.length === 0 || Boolean(result)}>最後の単語を戻す</button>
          </div>
        )}

        {showInput && (
          <>
            <label className="answer-label" htmlFor="answer-input">{exercise.questionType === "cloze" ? "空欄に入る語" : "ポーランド語で入力"}</label>
            <input ref={inputRef} id="answer-input" className="answer-input" type="text" value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitAnswer(); }} placeholder={exercise.questionType === "cloze" ? "空欄の語を入力…" : "ここに入力…"} autoComplete="off" autoCapitalize="sentences" disabled={Boolean(result)} />
            {targetIsPolish && <div className="diacritic-row" aria-label="ポーランド語の文字">{chips.map((chip) => <button key={chip} type="button" onClick={() => insertChip(chip)} disabled={Boolean(result)}>{chip}</button>)}</div>}
          </>
        )}

        {!result ? (
          <button className="button primary full-width" type="button" onClick={() => void submitAnswer()} disabled={saving}>{saving ? "保存中…" : "回答を確認"}</button>
        ) : (
          <div className={"feedback-panel " + (result.isCorrect ? "correct" : result.verdict === "diacritic_missing" ? "close" : "incorrect")} role="status" aria-live="polite">
            <div className="feedback-title"><span>{result.isCorrect ? "✓" : result.verdict === "diacritic_missing" ? "~" : "!"}</span>{result.isCorrect ? "正解" : result.verdict === "diacritic_missing" ? "惜しい" : "もう一歩"}</div>
            <p>{result.feedback}</p>
            <div className="answer-reveal"><span>正解</span><div><strong>{result.expectedAnswer}</strong>{targetIsPolish && <PronunciationButton text={currentItem.polish} speakerGender={currentItem.speakerGender} />}</div></div>
            <p className="difficulty-result">次回の出題: <strong>{result.difficultyLabel}</strong></p>
            <details><summary>文法メモを見る</summary><p>{explanation}</p></details>
            {mode === "review" && (
              <div className="rating-grid" aria-label="復習評価">
                {(Object.keys(ratingLabels) as ReviewRating[]).map((rating) => <button key={rating} type="button" className={reviewRating === rating ? "selected" : ""} onClick={() => setReviewRating(rating)}><span>{ratingLabels[rating]}</span><small>{rating === "again" ? "15分後・1段階戻す" : rating === "hard" ? "1段階戻す" : rating === "good" ? "1段階上げる" : "2段階上げる"}</small></button>)}
              </div>
            )}
            <button className="button primary full-width" type="button" onClick={() => void nextStep()} disabled={(mode === "review" && !reviewRating) || saving}>{isLast ? "学習を完了" : "次へ"} <span aria-hidden="true">→</span></button>
          </div>
        )}
      </main>
      <p className="study-footer-note">回答と所要時間は、あなたの学習履歴として保存されます。</p>
      <AIChat context={aiContext} withBottomNav={false} />
    </div>
  );
}

function VoiceMissionCard({ mission, completion = false }: { mission: VoiceMission; completion?: boolean }) {
  const [downloadState, setDownloadState] = useState<string | null>(null);
  async function downloadMission() {
    try {
      downloadTextFile(`polski-loop-${mission.difficultyLevel}-${mission.title}`, mission.promptText);
      await api.savePromptCopy(mission.title, mission.promptText, mission.id).catch(() => undefined);
      setDownloadState("ファイルを保存しました");
    } catch {
      setDownloadState("保存できませんでした。ブラウザのダウンロード設定を確認してください。");
    }
  }
  return <section className={completion ? "mission-card mission-card-complete" : "mission-card"} aria-label="ChatGPT Voice mission">
    <div className="section-heading"><div><span className="eyebrow">ChatGPT Voice mission</span><h2>{mission.title}</h2></div><span className="mission-level">{mission.difficultyLevel}</span></div>
    <p className="mission-objective">{mission.objective}</p>
    <div className="mission-grid"><div><span>場面</span><strong>{mission.scenario}</strong></div><div><span>あなた</span><strong>{mission.learnerRole}</strong></div><div><span>相手</span><strong>{mission.partnerRole}</strong></div><div><span>終了条件</span><strong>{mission.endingCondition}</strong></div></div>
    <div className="mission-expression-columns"><div><span className="mission-label">必須表現</span><ul className="mission-expression-list">{mission.requiredExpressions.map((expression, index) => <li key={expression}><span>{expression}</span><PronunciationButton text={expression} speakerGender={mission.requiredExpressionGenders[index]} /></li>)}</ul></div><div><span className="mission-label">相手側の表現</span><ul className="mission-expression-list secondary-list">{mission.partnerExpressions.map((expression, index) => <li key={expression}><span>{expression}</span><PronunciationButton text={expression} speakerGender={mission.partnerExpressionGenders[index]} /></li>)}</ul></div></div>
    <details className="mission-prompt-details"><summary>保存される内容を表示</summary><pre className="mission-prompt">{mission.promptText}</pre></details>
    <button className="button ghost full-width" type="button" onClick={() => void downloadMission()}>⇩ ChatGPT Voice用ファイルを保存</button>
    {downloadState && <p className="copy-state" role="status">{downloadState}</p>}
  </section>;
}

function VoiceCompletion({ mission, onFinished, sessionId }: { mission: VoiceMission | null; onFinished: () => void; sessionId: string | null }) {
  const [importing, setImporting] = useState(false);
  const [importedScore, setImportedScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importResult(file: File) {
    if (file.size > 65536) { setError("採点ファイルは64KB以下にしてください。"); return; }
    setImporting(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const result = await api.importVoiceResult(parsed as VoiceResultImport);
      setImportedScore(result.overallScore);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "採点ファイルを読み込めませんでした。");
    } finally {
      setImporting(false);
    }
  }

  if (!mission) {
    const reviewCompletionContext: AiPageContext = { key: `completion:${sessionId ?? "review"}`, label: "復習完了", content: "画面: 復習完了\n回答履歴を保存済み\n次の行動: 今日の画面へ戻る" };
    return <div className="screen-state completion-state"><span className="empty-icon">✓</span><h2>学習を完了しました</h2><p>回答履歴を保存しました。次は復習キューで思い出してみましょう。</p><button className="button primary" type="button" onClick={onFinished}>今日へ戻る</button><AIChat context={reviewCompletionContext} withBottomNav={false} /></div>;
  }
  const completionContext: AiPageContext = {
    key: `completion:${sessionId ?? mission.id}`,
    label: `${mission.title} 完了`,
    content: [`画面: レッスン完了`, `難易度: ${mission.difficultyLevel}`, `mission: ${mission.title}`, `場面: ${mission.scenario}`, `学習者の役割: ${mission.learnerRole}`, `相手の役割: ${mission.partnerRole}`, `必須表現: ${mission.requiredExpressions.join(" / ")}`, `相手側の表現: ${mission.partnerExpressions.join(" / ")}`, `終了条件: ${mission.endingCondition}`].join("\n"),
  };
  return <div className="study-shell completion-shell"><header className="study-header"><button className="icon-button" type="button" onClick={onFinished} aria-label="今日へ戻る">←</button><div className="study-heading"><span>レッスン完了</span><strong>ChatGPT Voice</strong></div><span className="study-time">{mission.difficultyLevel}</span></header><main className="study-card-area completion-area"><div className="completion-heading"><span className="empty-icon">✓</span><div><span className="eyebrow">Lesson complete</span><h1>会話につなげる</h1></div></div><p className="completion-intro">Voice会話後にChatGPTへ採点ファイルの作成を指示し、ここから同期できます。あとでホームから同期しても構いません。</p><VoiceMissionCard mission={mission} completion /><section className="voice-sync-card" aria-label="ChatGPT採点ファイルの同期"><div className="section-heading"><div><span className="eyebrow">ChatGPT score</span><h2>採点結果を同期</h2></div>{importedScore !== null && <span className="saved-pill">同期済み</span>}</div><p>ChatGPTが作成したJSONファイルを選択してください。採点と改善点が進捗へ保存されます。</p>{error && <p className="error-text" role="alert">{error}</p>}{importedScore !== null && <p className="voice-import-success" role="status">総合 {importedScore.toFixed(1)}/5 を同期しました。</p>}<div className="voice-result-actions">{importedScore === null && <label className={"button primary full-width upload-button" + (importing ? " disabled" : "")} aria-disabled={importing}>{importing ? "同期中…" : "⇧ ChatGPT採点ファイルを同期"}<input type="file" accept=".json,application/json" disabled={importing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importResult(file); }} /></label>}<button className="button secondary full-width" type="button" onClick={onFinished}>{importedScore === null ? "あとで同期して今日へ戻る" : "今日へ戻る"}</button></div></section></main><AIChat context={completionContext} withBottomNav={false} /></div>;
}
