import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getSpeechRecognitionConstructor,
  speechRecognitionErrorMessage,
  transcriptFromResults,
  type SpeechRecognitionConstructor,
  type SpeechRecognitionLike,
  type SpeechRecognitionResultEventLike,
} from "./speech-recognition";

export type PolishSpeechInputState = "idle" | "starting" | "listening" | "stopping";

export interface PolishSpeechInputSnapshot {
  supported: boolean;
  state: PolishSpeechInputState;
  transcript: string;
  error: string | null;
}

interface PolishSpeechInputOptions {
  onTranscript?: (text: string) => void;
}

interface ControllerOptions extends PolishSpeechInputOptions {
  getConstructor?: () => SpeechRecognitionConstructor | null;
}

interface Recording {
  recognition: SpeechRecognitionLike;
  started: boolean;
  stopRequested: boolean;
  stopCalled: boolean;
  finalTranscript: string;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

const STOP_TIMEOUT_MS = 8_000;
const SERVER_SNAPSHOT: PolishSpeechInputSnapshot = { supported: false, state: "idle", transcript: "", error: null };

/** Remove terminal ASR sentence punctuation; preserve spelling, accents and words. */
export function normalizePolishSpeechTranscript(text: string): string {
  return text.trim().replace(/[.!?。！？]+$/u, "").trimEnd();
}

function finalTranscriptFromResults(event: SpeechRecognitionResultEventLike): string {
  const finals: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index] as (typeof event.results[number] & { isFinal?: boolean }) | undefined;
    const text = result?.[0]?.transcript.trim();
    if (result?.isFinal === true && text) finals.push(text);
  }
  return finals.join(" ");
}

/** The same event controller used by the hook, injectable for microphone-free tests. */
export function createPolishSpeechInputController({ onTranscript, getConstructor = getSpeechRecognitionConstructor }: ControllerOptions = {}) {
  let active = true;
  let recording: Recording | null = null;
  let snapshot: PolishSpeechInputSnapshot = { ...SERVER_SNAPSHOT, supported: getConstructor() !== null };
  const listeners = new Set<() => void>();

  function update(next: PolishSpeechInputSnapshot) {
    if (Object.keys(next).every((key) => next[key as keyof PolishSpeechInputSnapshot] === snapshot[key as keyof PolishSpeechInputSnapshot])) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function current(run: Recording): boolean { return active && recording === run; }

  function detach(run: Recording, abort: boolean) {
    if (recording === run) recording = null;
    if (run.stopTimer !== null) clearTimeout(run.stopTimer);
    run.stopTimer = null;
    const recognition = run.recognition;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    if (abort) {
      try { recognition.abort(); } catch { /* Already ended in some browsers. */ }
    }
  }

  function fail(run: Recording, message: string) {
    if (!current(run)) return;
    detach(run, true);
    update({ ...snapshot, state: "idle", transcript: "", error: message });
  }

  function stopRecognition(run: Recording) {
    if (!current(run) || run.stopCalled) return;
    run.stopCalled = true;
    try { run.recognition.stop(); }
    catch { fail(run, "音声入力を停止できませんでした。もう一度お試しください。"); }
  }

  function start() {
    if (!active || recording) return;
    const Recognition = getConstructor();
    update({ supported: Recognition !== null, state: Recognition ? "starting" : "idle", transcript: "", error: Recognition ? null : "このブラウザは音声入力に対応していません。" });
    if (!Recognition) return;
    let recognition: SpeechRecognitionLike;
    try { recognition = new Recognition(); }
    catch { update({ ...snapshot, state: "idle", error: "音声入力を開始できませんでした。もう一度お試しください。" }); return; }
    const run: Recording = { recognition, started: false, stopRequested: false, stopCalled: false, finalTranscript: "", stopTimer: null };
    recording = run;
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (!current(run)) return;
      run.started = true;
      if (run.stopRequested) stopRecognition(run);
      else update({ ...snapshot, state: "listening" });
    };
    recognition.onresult = (event) => {
      if (!current(run)) return;
      const finalText = finalTranscriptFromResults(event);
      if (finalText) run.finalTranscript = finalText;
      update({ ...snapshot, transcript: transcriptFromResults(event) });
    };
    recognition.onerror = (event) => {
      fail(run, speechRecognitionErrorMessage(event.error) ?? "音声入力が中断されました。もう一度お試しください。");
    };
    recognition.onend = () => {
      if (!current(run)) return;
      const text = normalizePolishSpeechTranscript(run.finalTranscript);
      if (!text) { fail(run, speechRecognitionErrorMessage("no-speech")!); return; }
      if (text.length > 300) { fail(run, "認識結果が300文字を超えました。短く録り直すか、手入力で修正してください。"); return; }
      detach(run, false);
      update({ ...snapshot, state: "idle", transcript: text, error: null });
      onTranscript?.(text);
    };
    try { recognition.start(); }
    catch { fail(run, "音声入力を開始できませんでした。マイクの状態を確認して、もう一度お試しください。"); }
  }

  function stop() {
    const run = recording;
    if (!run || !current(run) || run.stopRequested) return;
    run.stopRequested = true;
    update({ ...snapshot, state: "stopping" });
    run.stopTimer = setTimeout(() => fail(run, "音声入力の終了を確認できませんでした。もう一度録音してください。"), STOP_TIMEOUT_MS);
    if (run.started) stopRecognition(run);
  }

  function reset() {
    if (recording) detach(recording, true);
    update({ ...snapshot, state: "idle", transcript: "", error: null });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start,
    stop,
    cancel: reset,
    reset,
    activate: () => { active = true; },
    dispose: () => { active = false; reset(); },
  };
}

export function usePolishSpeechInput({ onTranscript }: PolishSpeechInputOptions = {}) {
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const [controller] = useState(() => createPolishSpeechInputController({ onTranscript: (text) => callback.current?.(text) }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => SERVER_SNAPSHOT);
  useEffect(() => {
    controller.activate();
    return () => { controller.dispose(); };
  }, [controller]);
  return { ...snapshot, start: controller.start, stop: controller.stop, cancel: controller.cancel, reset: controller.reset };
}
