import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { VocabularyRetentionWord, VocabularyStudyRequest, VocabularySummary, VocabularyWord } from "../lib/types";
import PronunciationButton from "./PronunciationButton";
import { VocabularyRetentionBadge } from "./VocabularyRetention";
import "./vocabulary.css";

interface VocabularyLibraryProps {
  summary: VocabularySummary;
  initialTopic?: string;
  initiallyAdding?: boolean;
  onStart: (request: VocabularyStudyRequest) => void;
  onChanged: () => void;
}

const stateFilters = [
  { value: "", label: "すべて" },
  { value: "new", label: "未学習" },
  { value: "learning", label: "練習中" },
  { value: "remembered", label: "わかった" },
];

export default function VocabularyLibrary({ summary, initialTopic, initiallyAdding = false, onStart, onChanged }: VocabularyLibraryProps) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(initialTopic ?? "");
  const [stateFilter, setStateFilter] = useState("");
  const [personal, setPersonal] = useState(false);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(initiallyAdding);
  const [polish, setPolish] = useState("");
  const [meaningJa, setMeaningJa] = useState("");
  const [newTopic, setNewTopic] = useState(initialTopic ?? summary.topics[0]?.id ?? "");
  const [examplePl, setExamplePl] = useState("");
  const [exampleJa, setExampleJa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const polishRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const submitLock = useRef(false);
  const pendingSave = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { setTopic(initialTopic ?? ""); }, [initialTopic]);
  useEffect(() => { if (initiallyAdding) setAdding(true); }, [initiallyAdding]);
  useEffect(() => { if (adding) polishRef.current?.focus(); }, [adding]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void api.vocabularyWords({ search: search.trim(), topic: topic || undefined, state: stateFilter || undefined, personal: personal || undefined })
        .then((data) => { if (!cancelled) setWords(data); })
        .catch((loadError: unknown) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "単語帳を読み込めませんでした。");
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, topic, stateFilter, personal, reload]);

  async function saveWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const payload = { polish: polish.trim(), meaningJa: meaningJa.trim(), topic: newTopic, examplePl: examplePl.trim(), exampleJa: exampleJa.trim() };
    if (!payload.polish || !payload.meaningJa || !payload.topic) {
      setSaveError("ポーランド語、日本語の意味、場面を入力してください。");
      return;
    }
    const signature = JSON.stringify(payload);
    if (pendingSave.current?.signature !== signature) pendingSave.current = { signature, key: crypto.randomUUID() };
    submitLock.current = true;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const word = await api.addVocabularyWord({ ...payload, idempotencyKey: pendingSave.current.key });
      onChanged();
      if (!mounted.current) return;
      setNotice(`${word.polish}を自分の単語帳へ保存しました。`);
      setPolish("");
      setMeaningJa("");
      setExamplePl("");
      setExampleJa("");
      pendingSave.current = null;
      setAdding(false);
      setSearch("");
      setTopic(word.topic);
      setStateFilter("");
      setPersonal(true);
      setReload((value) => value + 1);
    } catch (saveFailure) {
      if (mounted.current) setSaveError(saveFailure instanceof Error ? saveFailure.message : "単語を保存できませんでした。もう一度保存してください。");
    } finally {
      submitLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="vocab-page">
      <section className="vocab-page-intro"><p className="vocab-eyebrow">Twój słowniczek</p><h1>単語帳</h1><p className="vocab-muted">暮らしの場面から、覚えたい言葉を。</p></section>
      <button className="vocab-add-button" type="button" onClick={() => setAdding((value) => !value)} aria-expanded={adding} aria-controls="vocab-add-form" disabled={saving}>＋ 見かけた単語を追加</button>
      {notice && <p className="vocab-notice" role="status">{notice}</p>}

      {adding && (
        <form className="vocab-add-form" id="vocab-add-form" onSubmit={(event) => void saveWord(event)} aria-labelledby="vocab-add-heading">
          <h2 id="vocab-add-heading">自分の単語を追加</h2>
          <p className="vocab-muted">お店や街で出会った言葉を、カードに残せます。</p>
          <label htmlFor="vocab-new-polish">ポーランド語<input ref={polishRef} id="vocab-new-polish" lang="pl" required value={polish} onChange={(event) => setPolish(event.target.value)} placeholder="例：paragon" autoCapitalize="none" autoComplete="off" disabled={saving} /></label>
          <label htmlFor="vocab-new-meaning">日本語の意味<input id="vocab-new-meaning" required value={meaningJa} onChange={(event) => setMeaningJa(event.target.value)} placeholder="例：レシート" disabled={saving} /></label>
          <label htmlFor="vocab-new-topic">場面<select id="vocab-new-topic" required value={newTopic} onChange={(event) => setNewTopic(event.target.value)} disabled={saving}><option value="">場面を選ぶ</option>{summary.topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <details className="vocab-add-examples"><summary>使い方も追加する（任意）</summary><label htmlFor="vocab-new-example">短い例文<input id="vocab-new-example" lang="pl" value={examplePl} onChange={(event) => setExamplePl(event.target.value)} placeholder="例：Poproszę paragon." disabled={saving} /></label><label htmlFor="vocab-new-example-meaning">例文の意味<input id="vocab-new-example-meaning" value={exampleJa} onChange={(event) => setExampleJa(event.target.value)} placeholder="例：レシートをください。" disabled={saving} /></label></details>
          {saveError && <p className="vocab-error" role="alert">{saveError}</p>}
          <div className="vocab-form-actions"><button className="vocab-button vocab-primary" type="submit" disabled={saving}>{saving ? "保存中…" : "単語帳に保存"}</button><button className="vocab-quiet" type="button" onClick={() => setAdding(false)} disabled={saving}>閉じる</button></div>
        </form>
      )}

      <div className="vocab-search"><span aria-hidden="true">⌕</span><label className="visually-hidden" htmlFor="vocab-search-input">単語を検索</label><input id="vocab-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ポーランド語・日本語で検索" /></div>
      <label className="vocab-filter-label" htmlFor="vocab-topic-filter">場面<select id="vocab-topic-filter" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">すべての場面</option>{summary.topics.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="vocab-filters" role="group" aria-label="学習状態で絞り込む">{stateFilters.map((filter) => <button className={`vocab-filter${stateFilter === filter.value ? " vocab-filter-active" : ""}`} type="button" key={filter.value} aria-pressed={stateFilter === filter.value} onClick={() => setStateFilter(filter.value)}>{filter.label}</button>)}</div>
      <p className="vocab-muted">未学習：まだ回答していない単語。練習中：最後に「もう一度」を選んだ単語。わかった：最後に「わかった」を選んだ単語。定着度は確認テストの結果で別に表示します。</p>
      <label className="vocab-own-filter"><input type="checkbox" checked={personal} onChange={(event) => setPersonal(event.target.checked)} />自分で追加した単語だけ</label>

      {loading ? <p className="vocab-loading" role="status">単語を探しています…</p> : error ? (
        <div className="vocab-empty"><p className="vocab-error" role="alert">{error}</p><button className="vocab-button vocab-secondary" type="button" onClick={() => setReload((value) => value + 1)}>もう一度読み込む</button></div>
      ) : words.length === 0 ? (
        <div className="vocab-empty"><h2>単語が見つかりませんでした</h2><p>{personal ? "自分の単語を追加するか、絞り込みを変えてください。" : "検索語や場面、学習状態を変えてみてください。"}</p></div>
      ) : (
        <section aria-labelledby="vocab-library-heading"><div className="vocab-section-heading"><h2 id="vocab-library-heading">{summary.topics.find((item) => item.id === topic)?.label ?? "すべての単語"}</h2><span className="vocab-muted">{words.length}語</span></div><div className="vocab-library-list">{words.map((word) => <VocabularyLibraryWord key={word.id} word={word} retention={summary.retention?.words.find((entry) => entry.wordId === word.id)} showRetention={summary.retention !== undefined} onStart={onStart} />)}</div></section>
      )}
    </div>
  );
}

function VocabularyLibraryWord({ word, retention, showRetention, onStart }: { word: VocabularyWord; retention?: VocabularyRetentionWord; showRetention: boolean; onStart: (request: VocabularyStudyRequest) => void }) {
  const stateLabel = !word.state ? "未学習" : word.state.lastRating === "again" ? "練習中" : "わかった";
  return (
    <article className="vocab-library-word">
      <div className="vocab-word-top"><span className={`vocab-state${word.state?.lastRating === "again" ? " vocab-state-again" : word.state ? " vocab-state-known" : ""}`}>{stateLabel}</span>{word.personal && <span className="vocab-personal-label">自分の単語</span>}</div>
      {showRetention && <div className="vocab-library-retention"><VocabularyRetentionBadge word={retention} /></div>}
      <div className="vocab-word-heading"><h3 lang="pl">{word.polish}</h3><PronunciationButton text={word.polish} speakerGender={word.speakerGender} /></div>
      <p className="vocab-word-meaning">{word.meaningJa}</p>
      {word.examplePl && (
        <details className="vocab-word-usage">
          <summary>使い方を見る</summary>
          <div className="vocab-example-audio">
            <p lang="pl">{word.examplePl}</p>
            <PronunciationButton text={word.examplePl} />
          </div>
          {word.exampleJa && <p>{word.exampleJa}</p>}
        </details>
      )}
      <button className="vocab-text-button" type="button" onClick={() => onStart({ mode: "learn", wordId: word.id })}>この単語を覚える <span aria-hidden="true">→</span></button>
    </article>
  );
}
