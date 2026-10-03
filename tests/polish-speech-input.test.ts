import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPolishSpeechInputController, normalizePolishSpeechTranscript } from "../src/lib/use-polish-speech-input";
import type { SpeechRecognitionErrorEventLike, SpeechRecognitionLike, SpeechRecognitionResultEventLike } from "../src/lib/speech-recognition";

class MockRecognition implements SpeechRecognitionLike {
  static instances: MockRecognition[] = [];
  static failStart = false;
  static failStop = false;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onstart: SpeechRecognitionLike["onstart"] = null;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  start = vi.fn(() => { if (MockRecognition.failStart) throw new Error("start"); });
  stop = vi.fn(() => { if (MockRecognition.failStop) throw new Error("stop"); });
  abort = vi.fn();
  constructor() { MockRecognition.instances.push(this); }
  started() { this.onstart?.(new Event("start")); }
  result(parts: Array<{ text: string; final?: boolean }>) {
    this.onresult?.({ results: Object.assign(parts.map(({ text, final }) => ({ 0: { transcript: text }, length: 1, isFinal: final })), { length: parts.length }) } as unknown as SpeechRecognitionResultEventLike);
  }
  error(code: string) { this.onerror?.({ error: code } as SpeechRecognitionErrorEventLike); }
  end() { this.onend?.(new Event("end")); }
}

function setup() {
  const onTranscript = vi.fn();
  const controller = createPolishSpeechInputController({ getConstructor: () => MockRecognition, onTranscript });
  return { controller, onTranscript, instance: () => MockRecognition.instances.at(-1)! };
}

describe("one utterance Polish speech input", () => {
  beforeEach(() => { vi.useFakeTimers(); MockRecognition.instances = []; MockRecognition.failStart = false; MockRecognition.failStop = false; });
  afterEach(() => { vi.useRealTimers(); });

  it("shows interim text but adopts only a final result at the end of the recording", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start();
    expect(controller.getSnapshot()).toMatchObject({ supported: true, state: "starting", transcript: "", error: null });
    expect(instance()).toMatchObject({ lang: "pl-PL", continuous: false, interimResults: true, maxAlternatives: 1 });
    instance().started();
    expect(controller.getSnapshot().state).toBe("listening");
    instance().result([{ text: "sto", final: false }]);
    expect(controller.getSnapshot().transcript).toBe("sto");
    expect(onTranscript).not.toHaveBeenCalled();
    controller.stop();
    expect(controller.getSnapshot().state).toBe("stopping");
    expect(instance().stop).toHaveBeenCalledOnce();
    instance().result([{ text: "Stół.", final: true }]);
    expect(onTranscript).not.toHaveBeenCalled();
    instance().end();
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("Stół");
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "Stół", error: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles natural end and replaces the last recording on each new user start", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started(); instance().result([{ text: "woda", final: true }]); instance().end();
    controller.start();
    expect(controller.getSnapshot().transcript).toBe("");
    instance().started(); instance().result([{ text: "mleko", final: true }]); instance().end();
    expect(onTranscript.mock.calls).toEqual([["woda"], ["mleko"]]);
    expect(MockRecognition.instances).toHaveLength(2);
  });

  it("does not auto restart or accept an interim-only end as an answer", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started(); instance().result([{ text: "chleb", final: false }]); instance().end();
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "" });
    expect(controller.getSnapshot().error).toContain("聞き取れませんでした");
    expect(onTranscript).not.toHaveBeenCalled();
    vi.runAllTimers(); expect(MockRecognition.instances).toHaveLength(1);
    controller.start(); expect(MockRecognition.instances).toHaveLength(2);
  });

  it("rejects unmarked results and excludes interim segments from the adopted answer", () => {
    const first = setup(); first.controller.start(); first.instance().result([{ text: "woda" }]); first.instance().end();
    expect(first.onTranscript).not.toHaveBeenCalled();
    const second = setup(); second.controller.start(); second.instance().result([{ text: "dzień", final: true }, { text: "dobry", final: false }]); second.instance().end();
    expect(second.onTranscript).toHaveBeenCalledExactlyOnceWith("dzień");
  });

  it.each(["no-speech", "network", "not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "aborted"])("reports %s as recognition failure without adopting an answer", (code) => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started(); instance().result([{ text: "woda", final: true }]); instance().error(code);
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "" });
    expect(controller.getSnapshot().error).toBeTruthy();
    expect(instance().abort).toHaveBeenCalledOnce();
    instance().end(); expect(onTranscript).not.toHaveBeenCalled();
    controller.start(); expect(MockRecognition.instances).toHaveLength(2);
  });

  it("reports unsupported browsers without starting a recording", () => {
    const onTranscript = vi.fn();
    const controller = createPolishSpeechInputController({ getConstructor: () => null, onTranscript });
    controller.start();
    expect(controller.getSnapshot()).toMatchObject({ supported: false, state: "idle", transcript: "" });
    expect(controller.getSnapshot().error).toContain("対応していません");
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("defers an early stop until onstart and ignores repeated start/stop clicks", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); controller.start(); controller.stop(); controller.stop();
    expect(MockRecognition.instances).toHaveLength(1);
    expect(controller.getSnapshot().state).toBe("stopping");
    expect(instance().stop).not.toHaveBeenCalled();
    instance().started(); instance().started();
    expect(instance().stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().state).toBe("stopping");
    instance().result([{ text: "kawa", final: true }]); instance().end();
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("kawa");
    controller.stop(); expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it("invalidates captured callbacks after cancel so they cannot overwrite a new recording", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started();
    const old = instance();
    const lateStart = old.onstart!; const lateResult = old.onresult!; const lateEnd = old.onend!; const lateError = old.onerror!;
    controller.cancel();
    expect(old.abort).toHaveBeenCalledOnce();
    expect(old.onresult).toBeNull();
    controller.start(); instance().started();
    lateStart(new Event("start")); lateResult({ results: [{ 0: { transcript: "wrong" }, length: 1, isFinal: true }] } as unknown as SpeechRecognitionResultEventLike); lateError({ error: "network" } as SpeechRecognitionErrorEventLike); lateEnd(new Event("end"));
    expect(controller.getSnapshot()).toMatchObject({ state: "listening", transcript: "", error: null });
    instance().result([{ text: "herbata", final: true }]); instance().end();
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("herbata");
  });

  it("aborts on dispose, ignores callbacks and starts after unmount, and can reactivate for StrictMode", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); const old = instance(); const lateEnd = old.onend!;
    old.result([{ text: "woda", final: true }]); controller.dispose(); lateEnd(new Event("end")); controller.start();
    expect(old.abort).toHaveBeenCalledOnce();
    expect(MockRecognition.instances).toHaveLength(1); expect(onTranscript).not.toHaveBeenCalled();
    controller.activate(); controller.start(); instance().result([{ text: "sklep", final: true }]); instance().end();
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("sklep");
  });

  it("recovers from start and stop exceptions without producing an answer", () => {
    const { controller, onTranscript, instance } = setup();
    MockRecognition.failStart = true; controller.start();
    expect(controller.getSnapshot().state).toBe("idle"); expect(controller.getSnapshot().error).toContain("開始できません");
    MockRecognition.failStart = false; controller.start(); instance().started(); MockRecognition.failStop = true; controller.stop();
    expect(controller.getSnapshot().state).toBe("idle"); expect(controller.getSnapshot().error).toContain("停止できません");
    expect(vi.getTimerCount()).toBe(0); expect(onTranscript).not.toHaveBeenCalled();
  });

  it("times out a stop without onend and ignores a later final result", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started(); const lateResult = instance().onresult!; const lateEnd = instance().onend!; controller.stop();
    vi.advanceTimersByTime(8_000);
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "" });
    expect(controller.getSnapshot().error).toContain("終了を確認できません");
    lateResult({ results: [{ 0: { transcript: "woda", isFinal: true }, length: 1, isFinal: true }] } as unknown as SpeechRecognitionResultEventLike); lateEnd(new Event("end"));
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("accepts at most 300 final characters after removing terminal ASR punctuation", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().result([{ text: `${"ą".repeat(300)}.`, final: true }]); instance().end();
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("ą".repeat(300));
    controller.start(); instance().result([{ text: "ą".repeat(301), final: true }]); instance().end();
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "" });
    expect(controller.getSnapshot().error).toContain("300文字を超えました");
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });

  it("clears the stop timeout on cancel and ignores duplicate successful end callbacks", () => {
    const { controller, onTranscript, instance } = setup();
    controller.start(); instance().started(); controller.stop(); controller.cancel();
    expect(vi.getTimerCount()).toBe(0);
    controller.start(); instance().started(); const end = instance().onend!;
    instance().result([{ text: "woda", final: true }]); instance().end(); end(new Event("end"));
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("woda");
    vi.advanceTimersByTime(8_000);
    expect(controller.getSnapshot()).toMatchObject({ state: "idle", transcript: "woda", error: null });
  });

  it("keeps store snapshots stable and unsubscribes listeners", () => {
    const { controller, instance } = setup(); const listener = vi.fn(); const unsubscribe = controller.subscribe(listener);
    const initial = controller.getSnapshot(); expect(controller.getSnapshot()).toBe(initial);
    controller.reset(); expect(listener).not.toHaveBeenCalled();
    controller.start(); expect(listener).toHaveBeenCalledOnce(); unsubscribe(); instance().started();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("Polish ASR terminal punctuation", () => {
  it("removes only terminal sentence punctuation and preserves spelling, accents and multiple words", () => {
    expect(normalizePolishSpeechTranscript("  Ciasto.  ")).toBe("Ciasto");
    expect(normalizePolishSpeechTranscript("Stół。")).toBe("Stół");
    expect(normalizePolishSpeechTranscript("Dzień dobry.")).toBe("Dzień dobry");
    expect(normalizePolishSpeechTranscript("stol")).toBe("stol");
    expect(normalizePolishSpeechTranscript("A.B.")).toBe("A.B");
    expect(normalizePolishSpeechTranscript("woda?" )).toBe("woda");
    expect(normalizePolishSpeechTranscript("woda!" )).toBe("woda");
    expect(normalizePolishSpeechTranscript("woda！？。" )).toBe("woda");
    expect(normalizePolishSpeechTranscript("dzień, dobry" )).toBe("dzień, dobry");
    expect(normalizePolishSpeechTranscript("..." )).toBe("");
  });
});
