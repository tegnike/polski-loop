import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { parseAiTutorMessage } from "../lib/ai-chat";
import {
  appendSpeechTranscript,
  canRestartSpeechRecognitionAfter,
  configureContinuousSpeechRecognition,
  getSpeechRecognitionConstructor,
  SPEECH_INPUT_LANGUAGES,
  speechRecognitionErrorMessage,
  transcriptFromResults,
  type SpeechInputLanguage,
  type SpeechRecognitionLike,
} from "../lib/speech-recognition";
import type { AiChatMessage, AiPageContext } from "../lib/types";
import PronunciationButton from "./PronunciationButton";

interface AIChatProps {
  context: AiPageContext;
  withBottomNav?: boolean;
}

function MessageContent({ message }: { message: AiChatMessage }) {
  if (message.role === "user") return <p>{message.content}</p>;

  return (
    <p>
      {parseAiTutorMessage(message.content).map((part, index) => part.kind === "polish" ? (
        <span className="ai-chat-polish" key={`${index}-${part.content}`}>
          <span lang="pl">{part.content}</span>
          <PronunciationButton text={part.content} className="ai-chat-pronunciation" />
        </span>
      ) : <span key={`${index}-${part.content}`}>{part.content}</span>)}
    </p>
  );
}

export default function AIChat({ context, withBottomNav = true }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sessionContext, setSessionContext] = useState<AiPageContext | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechLanguage, setSpeechLanguage] = useState<SpeechInputLanguage>("ja-JP");
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseDraftRef = useRef("");
  const speechCurrentDraftRef = useRef("");
  const speechRequestedRef = useRef(false);
  const speechRestartTimerRef = useRef<number | null>(null);
  const speechSupported = getSpeechRecognitionConstructor() !== null;

  function clearSpeechRestartTimer() {
    if (speechRestartTimerRef.current === null) return;
    window.clearTimeout(speechRestartTimerRef.current);
    speechRestartTimerRef.current = null;
  }

  function cancelSpeechRecognition() {
    speechRequestedRef.current = false;
    clearSpeechRestartTimer();
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    }
    setListening(false);
  }

  function resetSession() {
    cancelSpeechRecognition();
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    generationRef.current += 1;
    setOpen(false);
    setMessages([]);
    setSessionContext(null);
    setDraft("");
    setSending(false);
    setError(null);
    setSpeechError(null);
  }

  useEffect(() => {
    resetSession();
  }, [context.key]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") resetSession(); };
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    speechRequestedRef.current = false;
    clearSpeechRestartTimer();
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  }, []);

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, open]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    const capturedContext = sessionContext ?? context;
    const previousMessages = messages;
    const nextMessages: AiChatMessage[] = [...previousMessages, { role: "user", content }];
    const requestGeneration = generationRef.current;
    const controller = new AbortController();
    requestAbortRef.current = controller;
    setSessionContext(capturedContext);
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const response = await api.aiChat({ context: capturedContext, messages: nextMessages }, controller.signal);
      if (generationRef.current !== requestGeneration) return;
      setMessages([...nextMessages, { role: "assistant", content: response.message }]);
    } catch (sendError) {
      if (generationRef.current !== requestGeneration) return;
      setMessages(previousMessages);
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : "AIから回答を取得できませんでした。");
    } finally {
      if (generationRef.current === requestGeneration) {
        requestAbortRef.current = null;
        setSending(false);
      }
    }
  }

  function startSpeechRecognitionCycle(Recognition: NonNullable<ReturnType<typeof getSpeechRecognitionConstructor>>, language: SpeechInputLanguage) {
    if (!speechRequestedRef.current) return;
    const recognition = new Recognition();
    let canRestart = true;
    speechRecognitionRef.current = recognition;
    configureContinuousSpeechRecognition(recognition, language);
    recognition.onstart = () => {
      if (speechRecognitionRef.current !== recognition) return;
      setListening(true);
      setSpeechError(null);
    };
    recognition.onresult = (event) => {
      if (speechRecognitionRef.current !== recognition) return;
      const nextDraft = appendSpeechTranscript(speechBaseDraftRef.current, transcriptFromResults(event));
      speechCurrentDraftRef.current = nextDraft;
      setDraft(nextDraft);
    };
    recognition.onerror = (event) => {
      if (speechRecognitionRef.current !== recognition) return;
      canRestart = canRestartSpeechRecognitionAfter(event.error);
      if (canRestart) {
        setSpeechError(null);
      } else {
        speechRequestedRef.current = false;
        setSpeechError(speechRecognitionErrorMessage(event.error));
      }
    };
    recognition.onend = () => {
      if (speechRecognitionRef.current !== recognition) return;
      speechRecognitionRef.current = null;
      if (speechRequestedRef.current && canRestart) {
        speechBaseDraftRef.current = speechCurrentDraftRef.current;
        speechRestartTimerRef.current = window.setTimeout(() => {
          speechRestartTimerRef.current = null;
          startSpeechRecognitionCycle(Recognition, language);
        }, 150);
        return;
      }
      setListening(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };

    try {
      setListening(true);
      recognition.start();
    } catch {
      speechRecognitionRef.current = null;
      speechRequestedRef.current = false;
      setListening(false);
      setSpeechError("音声入力を開始できませんでした。少し待ってからもう一度お試しください。");
    }
  }

  function toggleSpeechRecognition() {
    if (listening) {
      speechRequestedRef.current = false;
      clearSpeechRestartTimer();
      const recognition = speechRecognitionRef.current;
      if (!recognition) {
        setListening(false);
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      try {
        recognition.stop();
      } catch {
        cancelSpeechRecognition();
      }
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition || sending) return;
    speechBaseDraftRef.current = draft;
    speechCurrentDraftRef.current = draft;
    speechRequestedRef.current = true;
    setListening(true);
    setSpeechError(null);
    startSpeechRecognitionCycle(Recognition, speechLanguage);
  }

  return (
    <>
      <button className={`ai-chat-launcher${withBottomNav ? " above-nav" : ""}`} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="ai-chat-panel">
        <span aria-hidden="true">✦</span> AIに聞く
      </button>
      {open && createPortal(
        <div className="ai-chat-backdrop" role="presentation">
          <section id="ai-chat-panel" className="ai-chat-panel" role="dialog" aria-modal="false" aria-label="AI学習パートナー">
            <header className="ai-chat-header">
              <div><span className="eyebrow">GPT-5.6 Luna</span><strong>AI学習パートナー</strong><small>参照中：{sessionContext?.label ?? context.label}</small></div>
              <button className="icon-button" type="button" onClick={resetSession} aria-label="会話を終了">×</button>
            </header>
            <div className="ai-chat-reset-note">画面上の操作はそのまま使えます。閉じる・画面移動・次の問題で会話はリセットされます。</div>
            <div className="ai-chat-messages" aria-live="polite">
              {messages.length === 0 && <div className="ai-chat-welcome"><span aria-hidden="true">✦</span><strong>この画面について自由に話せます</strong><p>質問、添削、例文、ロールプレイなど、そのまま入力してください。</p></div>}
              {messages.map((message, index) => <div className={`ai-chat-message ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === "user" ? "あなた" : "AI"}</small><MessageContent message={message} /></div>)}
              {sending && <div className="ai-chat-thinking"><span className="loader" />考えています…</div>}
              <div ref={messageEndRef} />
            </div>
            <div className="ai-chat-composer">
              {error && <p className="ai-chat-error" role="alert">{error}</p>}
              {speechError && <p className="ai-chat-error" role="alert">{speechError}</p>}
              {speechSupported && (
                <div className="ai-chat-speech-settings">
                  <label>音声
                    <select value={speechLanguage} onChange={(event) => setSpeechLanguage(event.target.value as SpeechInputLanguage)} disabled={sending || listening} aria-label="音声入力の言語">
                      {SPEECH_INPUT_LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                    </select>
                  </label>
                  <span role="status">{listening ? "録音中…停止ボタンを押すまで継続" : "ブラウザの音声認識で文字に変換"}</span>
                </div>
              )}
              <div className={`ai-chat-composer-main${speechSupported ? " has-speech" : ""}`}>
                <textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }} placeholder="質問や会話を入力…" rows={2} maxLength={8_000} disabled={sending || listening} />
                {speechSupported && <button className={`ai-chat-mic${listening ? " listening" : ""}`} type="button" onClick={toggleSpeechRecognition} disabled={sending} aria-label={listening ? "音声入力を停止" : "音声入力を開始"} aria-pressed={listening}>{listening ? <span aria-hidden="true">■</span> : <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>}</button>}
                <button className="ai-chat-send" type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || sending || listening} aria-label="送信">↑</button>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
