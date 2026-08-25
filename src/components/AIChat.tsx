import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import type { AiChatMessage, AiPageContext } from "../lib/types";

interface AIChatProps {
  context: AiPageContext;
  withBottomNav?: boolean;
}

export default function AIChat({ context, withBottomNav = true }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [sessionContext, setSessionContext] = useState<AiPageContext | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);

  function resetSession() {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    generationRef.current += 1;
    setOpen(false);
    setMessages([]);
    setSessionContext(null);
    setDraft("");
    setSending(false);
    setError(null);
  }

  useEffect(() => {
    resetSession();
  }, [context.key]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    document.body.style.overflow = "hidden";
    appRoot?.setAttribute("inert", "");
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") resetSession(); };
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      appRoot?.removeAttribute("inert");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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

  return (
    <>
      <button className={`ai-chat-launcher${withBottomNav ? " above-nav" : ""}`} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span aria-hidden="true">✦</span> AIに聞く
      </button>
      {open && createPortal(
        <div className="ai-chat-backdrop" role="presentation">
          <section className="ai-chat-panel" role="dialog" aria-modal="true" aria-label="AI学習パートナー">
            <header className="ai-chat-header">
              <div><span className="eyebrow">GPT-5.6 Luna</span><strong>AI学習パートナー</strong><small>参照中：{sessionContext?.label ?? context.label}</small></div>
              <button className="icon-button" type="button" onClick={resetSession} aria-label="会話を終了">×</button>
            </header>
            <div className="ai-chat-reset-note">閉じる・画面移動・次の問題で、この会話はリセットされます。</div>
            <div className="ai-chat-messages" aria-live="polite">
              {messages.length === 0 && <div className="ai-chat-welcome"><span aria-hidden="true">✦</span><strong>この画面について自由に話せます</strong><p>質問、添削、例文、ロールプレイなど、そのまま入力してください。</p></div>}
              {messages.map((message, index) => <div className={`ai-chat-message ${message.role}`} key={`${message.role}-${index}`}><small>{message.role === "user" ? "あなた" : "AI"}</small><p>{message.content}</p></div>)}
              {sending && <div className="ai-chat-thinking"><span className="loader" />考えています…</div>}
              <div ref={messageEndRef} />
            </div>
            <div className="ai-chat-composer">
              {error && <p className="ai-chat-error" role="alert">{error}</p>}
              <div>
                <textarea ref={textareaRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }} placeholder="質問や会話を入力…" rows={2} maxLength={8_000} disabled={sending} />
                <button type="button" onClick={() => void sendMessage()} disabled={!draft.trim() || sending} aria-label="送信">↑</button>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
