import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { VocabularyTestAnswerResponse, VocabularyTestAttempt, VocabularyTestMode, VocabularyTestQuestion } from "../lib/types";
import PronunciationButton from "./PronunciationButton";
import { vocabularyGapDays, vocabularyTestDate } from "./VocabularyRetention";
import "./vocabulary.css";

interface VocabularyTestFlowProps {
  mode: VocabularyTestMode;
  wordId?: string;
  onFinished: () => void;
  onBack: () => void;
}

interface PendingAnswer {
  questionId: string;
  answer: string;
  idempotencyKey: string;
  elapsedMs: number;
}

const stageDays = [0, 1, 3, 7];

export default function VocabularyTestFlow({ mode, wordId, onFinished, onBack }: VocabularyTestFlowProps) {
  const [questions, setQuestions] = useState<VocabularyTestQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<VocabularyTestAnswerResponse | null>(null);
  const [attempts, setAttempts] = useState<VocabularyTestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reload, setReload] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const saveLock = useRef(false);
  const pending = useRef<PendingAnswer | null>(null);
  const answeredQuestion = useRef<string | null>(null);
  const startKey = useRef<{ signature: string; key: string } | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const run = ++generation.current;
    let cancelled = false;
    const signature = JSON.stringify({ mode, wordId });
    if (startKey.current?.signature !== signature) startKey.current = { signature, key: crypto.randomUUID() };
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setQuestions([]);
    setIndex(0);
    setAnswer("");
    setResult(null);
    setAttempts([]);
    setCompleted(false);
    setSaving(false);
    pending.current = null;
    answeredQuestion.current = null;
    saveLock.current = false;
    void api.startVocabularyTest({ mode, wordId, limit: 5, idempotencyKey: startKey.current.key })
      .then((response) => { if (!cancelled && run === generation.current) { setQuestions(response.questions); startedAt.current = Date.now(); } })
      .catch((failure: unknown) => { if (!cancelled && run === generation.current) setLoadError(failure instanceof Error ? failure.message : "テストを準備できませんでした。"); })
      .finally(() => { if (!cancelled && run === generation.current) setLoading(false); });
    return () => { cancelled = true; generation.current += 1; };
  }, [mode, wordId, reload]);

  const question = questions[index];
  useEffect(() => {
    if (!loading && !completed && question) (result ? nextRef.current : inputRef.current)?.focus({ preventScroll: true });
  }, [loading, completed, question?.id, result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question || result || saveLock.current || answeredQuestion.current === question.id) return;
    const run = generation.current;
    if (!pending.current) pending.current = { questionId: question.id, answer: answer.trim(), idempotencyKey: crypto.randomUUID(), elapsedMs: Math.max(0, Date.now() - startedAt.current) };
    const payload = pending.current;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await api.answerVocabularyTest(payload);
      if (run !== generation.current) return;
      answeredQuestion.current = question.id;
      pending.current = null;
      setResult(response);
      setAttempts((previous) => previous.some((attempt) => attempt.id === response.attempt.id) ? previous : [...previous, response.attempt]);
    } catch (failure) {
      if (run === generation.current) setSaveError(failure instanceof Error ? failure.message : "回答を保存できませんでした。同じ回答で送信し直してください。");
    } finally {
      if (run === generation.current) { saveLock.current = false; setSaving(false); }
    }
  }

  function next() {
    if (!result || saveLock.current || pending.current) return;
    if (index + 1 >= questions.length) { setCompleted(true); return; }
    setIndex((value) => value + 1);
    answeredQuestion.current = null;
    setAnswer("");
    setResult(null);
    setSaveError(null);
    startedAt.current = Date.now();
  }

  const back = <button className="vocab-back-button" type="button" onClick={onBack} disabled={saving} aria-label="テストを終了して戻る">‹</button>;
  if (loading || loadError || questions.length === 0) return <div className="vocab-study vocab-test-shell">
    <header className="vocab-study-header">{back}<strong>ヒントなしで確認</strong></header>
    <main className="vocab-study-state">{loading ? <p role="status">テストを準備しています…</p> : loadError ? <><p className="vocab-error" role="alert">{loadError}</p><button className="vocab-button vocab-secondary" type="button" onClick={() => setReload((value) => value + 1)}>もう一度準備する</button></> : <><h1>今は確認する単語がありません</h1><p>{mode === "due" ? "次の確認予定まで待つか、ホームで今すぐ練習できます。" : "まず単語カードで学習してから、思い出してみましょう。"}</p><button className="vocab-button vocab-primary" type="button" onClick={onBack}>今日へ戻る</button></>}</main>
  </div>;

  if (completed) return <div className="vocab-study vocab-test-shell">
    <header className="vocab-study-header">{back}<strong>テストの結果</strong></header>
    <main className="vocab-completion"><span className="vocab-complete-icon" aria-hidden="true">✓</span><h1>{attempts.filter((attempt) => attempt.isCorrect).length} / {attempts.length}問、正解</h1><p className="vocab-muted">回答と正誤を保存しました。</p><p className="vocab-help">各単語の確認状況と次の予定は、記録で見られます。</p><button className="vocab-button vocab-primary" type="button" onClick={onFinished}>今日へ戻る →</button></main>
  </div>;

  return <div className="vocab-study vocab-test-shell">
    <header className="vocab-study-header">{back}<strong>{mode === "due" ? "日を空けてテスト" : "今すぐの練習"}</strong><span>{index + 1} / {questions.length}</span></header>
    <div className="vocab-study-progress" role="progressbar" aria-label="回答を保存した問題数" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={attempts.length}><span style={{ width: `${attempts.length / questions.length * 100}%` }} /></div>
    <main className="vocab-test-area">
      <p className="vocab-test-instruction">単語帳や外部の語彙を見ず、日本語の意味から思い出してください。単語帳で学習した表現を入力してください。</p>
      {mode === "practice" && <p className="vocab-test-practice-note">今すぐの練習結果は記録しますが、日を空けた確認には含めません。</p>}
      <section className="vocab-test-prompt" aria-labelledby="vocab-test-meaning"><p>ポーランド語で書いてください</p><h1 id="vocab-test-meaning">{question.promptJa}</h1></section>
      {!result ? <form className="vocab-test-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="vocab-test-answer">あなたの回答<input ref={inputRef} id="vocab-test-answer" lang="pl" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={300} disabled={saving || saveError !== null} /></label>
        <p className="vocab-help">ą・łなどを含め、綴りまで正確に入力してください。</p>
        <p className="vocab-help">思い出せないときは、空欄のまま回答できます。</p>
        {saveError && <div className="vocab-save-error"><p className="vocab-error" role="alert">{saveError}</p><p className="vocab-help">保存を確認できるまで、同じ回答で送信し直します。</p><p className="vocab-help">再送できない場合は、左上の戻るで終了し、新しいテストを始めてください。</p></div>}
        <button className="vocab-button vocab-primary" type="submit" disabled={saving}>{saving ? "回答を保存しています…" : saveError ? "同じ回答で保存し直す" : "回答を確認する"}</button>
      </form> : <section className={`vocab-test-feedback${result.attempt.isCorrect ? " is-correct" : " is-incorrect"}`} aria-labelledby="vocab-test-result">
        <h2 id="vocab-test-result">{result.attempt.isCorrect ? "正解です" : "不正解：もう一度確かめましょう"}</h2>
        <p>単語帳の正答</p>
        <div className="vocab-test-correct-answer"><strong lang="pl">{result.correctPolish}</strong><PronunciationButton text={result.correctPolish} /></div>
        <p>正答として扱う表記：<span lang="pl">{result.acceptedAnswers.join(" / ")}</span></p>
        <p>あなたの回答：<span lang="pl">{result.attempt.answer || "（空欄）"}</span></p>
        <p>空けた日数：{vocabularyGapDays(result.attempt.gapDays)}日（今回の基準：{result.attempt.requiredDays}日）</p>
        <p className="vocab-test-evidence">{!result.attempt.isCorrect ? "再確認：1日後にもう一度" : result.attempt.countsForRetention ? result.attempt.requiredDays === 30 ? "30日空けても正解。次の確認を続けます。" : `${stageDays[result.attempt.stageAfter]}日後確認済み` : mode === "practice" ? "今すぐの練習。日を空けた確認には含みません。" : "必要な間隔を空けた確認には含みません。次の予定で再確認します。"}</p>
        <p>次の確認：<time dateTime={result.attempt.nextTestAt}>{vocabularyTestDate(result.attempt.nextTestAt)}</time></p>
        <button ref={nextRef} className="vocab-button vocab-primary" type="button" onClick={next}>{index + 1 >= questions.length ? "結果を見る" : "次の単語へ →"}</button>
      </section>}
    </main>
  </div>;
}
