import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { VocabularyRating, VocabularyStudyRequest, VocabularyWord } from "../lib/types";
import PronunciationButton from "./PronunciationButton";
import "./vocabulary.css";

interface VocabularyFlowProps {
  request: VocabularyStudyRequest;
  onFinished: () => void;
  onBack: () => void;
}

interface QueueCard {
  word: VocabularyWord;
  repeat: boolean;
  key: string;
}

interface SavedWord {
  word: VocabularyWord;
  rating: VocabularyRating;
}

interface PendingRating {
  wordId: string;
  rating: VocabularyRating;
  idempotencyKey: string;
  elapsedMs: number;
}

function dueTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時を確認できませんでした";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function VocabularyFlow({ request, onFinished, onBack }: VocabularyFlowProps) {
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryRating, setRetryRating] = useState<VocabularyRating | null>(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [savedWords, setSavedWords] = useState<Record<string, SavedWord>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [reload, setReload] = useState(0);
  const [message, setMessage] = useState("");
  const revealRef = useRef<HTMLButtonElement>(null);
  const saveLock = useRef(false);
  const pending = useRef<PendingRating | null>(null);
  const cardStartedAt = useRef(Date.now());
  const savedEvents = useRef(new Set<string>());
  const generation = useRef(0);

  useEffect(() => {
    const run = ++generation.current;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setQueue([]);
    setIndex(0);
    setRevealed(false);
    setCompleted(false);
    setSavedWords({});
    setSavedCount(0);
    setRetryRating(null);
    setMessage("");
    setSaving(false);
    pending.current = null;
    savedEvents.current = new Set();
    saveLock.current = false;
    void api.vocabularyQueue({ mode: request.mode, topic: request.topic, wordId: request.wordId, limit: 5 })
      .then((words) => {
        if (cancelled || run !== generation.current) return;
        setQueue(words.slice(0, 5).map((word) => ({ word, repeat: false, key: crypto.randomUUID() })));
        cardStartedAt.current = Date.now();
      })
      .catch((error: unknown) => {
        if (!cancelled && run === generation.current) setLoadError(error instanceof Error ? error.message : "単語を読み込めませんでした。");
      })
      .finally(() => { if (!cancelled && run === generation.current) setLoading(false); });
    return () => { cancelled = true; generation.current += 1; };
  }, [request.mode, request.topic, request.wordId, reload]);

  const card = queue[index];

  useEffect(() => {
    if (!loading && !completed && card) revealRef.current?.focus({ preventScroll: true });
  }, [card?.key, loading, completed]);

  async function saveRating(rating: VocabularyRating) {
    if (!card || !revealed || saveLock.current) return;
    const run = generation.current;
    if (!pending.current || pending.current.idempotencyKey !== card.key) {
      pending.current = { wordId: card.word.id, rating, idempotencyKey: card.key, elapsedMs: Math.max(0, Date.now() - cardStartedAt.current) };
    }
    const payload = pending.current;
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await api.rateVocabulary(payload);
      if (run !== generation.current) return;
      if (!savedEvents.current.has(result.eventId)) {
        savedEvents.current.add(result.eventId);
        setSavedCount(savedEvents.current.size);
      }
      setSavedWords((previous) => ({ ...previous, [result.word.id]: { word: result.word, rating: payload.rating } }));
      const nextQueue = payload.rating === "again" && !card.repeat
        ? [...queue, { word: result.word, repeat: true, key: crypto.randomUUID() }]
        : queue;
      setQueue(nextQueue);
      pending.current = null;
      setRetryRating(null);
      setRevealed(false);
      if (index + 1 >= nextQueue.length) {
        setCompleted(true);
      } else {
        setIndex(index + 1);
        cardStartedAt.current = Date.now();
        setMessage(payload.rating === "again" && !card.repeat ? "保存しました。この回の最後に、もう一度出てきます。" : "自己評価を保存しました。次の単語です。");
      }
    } catch (error) {
      if (run === generation.current) {
        setSaveError(error instanceof Error ? error.message : "評価を保存できませんでした。もう一度お試しください。");
        setRetryRating(payload.rating);
      }
    } finally {
      if (run === generation.current) {
        saveLock.current = false;
        setSaving(false);
      }
    }
  }

  const backButton = <button className="vocab-back-button" type="button" onClick={onBack} disabled={saving} aria-label="学習を終了して戻る"><span aria-hidden="true">‹</span></button>;

  if (loading || loadError || queue.length === 0) {
    return (
      <div className="vocab-study">
        <header className="vocab-study-header">{backButton}<strong>単語カード</strong></header>
        <main className="vocab-study-state">
          {loading ? <p role="status">単語を準備しています…</p> : loadError ? <><p className="vocab-error" role="alert">{loadError}</p><button className="vocab-button vocab-primary" type="button" onClick={() => setReload((value) => value + 1)}>もう一度読み込む</button></> : <><span className="vocab-complete-icon" aria-hidden="true">✓</span><h1>{request.mode === "review" ? "今は復習なし" : "この場面はひと区切り"}</h1><p>{request.mode === "review" ? "次の復習時期に、また思い出してみましょう。" : "単語帳で別の場面を選ぶか、見かけた単語を追加できます。"}</p><button className="vocab-button vocab-primary" type="button" onClick={onFinished}>今日へ戻る</button></>}
        </main>
      </div>
    );
  }

  if (completed) {
    const saved = Object.values(savedWords);
    const known = saved.filter((entry) => entry.rating === "known");
    const again = saved.filter((entry) => entry.rating === "again");
    const nextDue = saved.map((entry) => entry.word.state?.dueAt).filter((value): value is string => Boolean(value)).sort((left, right) => Date.parse(left) - Date.parse(right))[0];
    return (
      <div className="vocab-study">
        <header className="vocab-study-header">{backButton}<strong>単語カード</strong><span>完了</span></header>
        <main className="vocab-completion">
          <span className="vocab-complete-icon" aria-hidden="true">✓</span><p className="vocab-eyebrow">Dobra robota!</p><h1>{saved.length}単語、ひと区切り。</h1>
          <p className="vocab-muted">自己評価を{savedCount}回保存しました。</p>
          <dl className="vocab-completion-counts"><div><dt>わかった</dt><dd>{known.length}<small>語</small></dd></div><div><dt>もう一度</dt><dd>{again.length}<small>語</small></dd></div></dl>
          <p className="vocab-help">各単語の最後の自己評価です。テストの正解率ではありません。</p>
          {again.length > 0 && <div className="vocab-completion-due"><h2>また思い出してみましょう</h2><ul>{again.map((entry) => <li key={entry.word.id}><span lang="pl">{entry.word.polish}</span><small>{entry.word.state ? dueTime(entry.word.state.dueAt) : "単語帳で復習時期を確認"}</small></li>)}</ul></div>}
          {nextDue && <p className="vocab-next-due">次の復習予定：{dueTime(nextDue)}</p>}
          <button className="vocab-button vocab-primary" type="button" onClick={onFinished}>今日へ戻る <span aria-hidden="true">→</span></button>
        </main>
      </div>
    );
  }

  return (
    <div className="vocab-study">
      <header className="vocab-study-header">{backButton}<strong>{request.mode === "review" ? "単語の復習" : "単語を覚える"}</strong><span>{index + 1} / {queue.length}{card.repeat ? " · もう一度" : ""}</span></header>
      <div className="vocab-study-progress" role="progressbar" aria-label="保存済みカードの進捗" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={index}><span style={{ width: `${index / queue.length * 100}%` }} /></div>
      <main className="vocab-card-area">
        <p className="vocab-card-instruction">日本語の意味を思い出す</p>
        <article className="vocab-flashcard" key={card.key}>
          <h1 className="vocab-headword" lang="pl">{card.word.polish}</h1>
          <div className="vocab-card-audio"><PronunciationButton text={card.word.polish} speakerGender={card.word.speakerGender} /><span>発音を聞く</span></div>
          <div className="vocab-translation" aria-live="polite">{revealed ? <p className="vocab-card-meaning">{card.word.meaningJa}</p> : <button ref={revealRef} className="vocab-reveal-button" type="button" onClick={() => setRevealed(true)}>意味を表示</button>}</div>
        </article>
        {revealed && card.word.examplePl && <details className="vocab-card-usage" key={`${card.key}:example`}><summary>使い方を見る</summary><p lang="pl">{card.word.examplePl}</p>{card.word.exampleJa && <p>{card.word.exampleJa}</p>}</details>}
        <div className="vocab-rating-buttons" aria-label="思い出せたかを自己評価"><button className="vocab-button vocab-again" type="button" onClick={() => void saveRating("again")} disabled={!revealed || saving || retryRating !== null}>もう一度</button><button className="vocab-button vocab-primary" type="button" onClick={() => void saveRating("known")} disabled={!revealed || saving || retryRating !== null}>わかった</button></div>
        {!revealed && <p className="vocab-help">意味を確認すると、自己評価を選べます。</p>}
        {revealed && !saving && !saveError && <p className="vocab-help">{card.repeat ? "自己評価を選ぶと、次の復習予定を保存します。" : "「もう一度」の単語は、この回でもう1回練習します。"}</p>}
        {saving && <p className="vocab-save-status" role="status">自己評価を保存しています…</p>}
        {saveError && <div className="vocab-save-error"><p className="vocab-error" role="alert">{saveError}</p><p className="vocab-help">保存を確認できるまで、次のカードには進みません。</p><button className="vocab-button vocab-secondary" type="button" onClick={() => { if (retryRating) void saveRating(retryRating); }} disabled={saving}>同じ評価で保存し直す</button></div>}
        <p className="vocab-card-message" role="status">{message}</p>
      </main>
    </div>
  );
}
