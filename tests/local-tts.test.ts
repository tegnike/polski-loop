import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { createLocalTtsMiddleware, synthesizeLocalPolish } from "../dev/local-tts";
import viteConfig from "../vite.config";

interface MiddlewareResult {
  status: number;
  headers: Record<string, string | number>;
  body: Buffer;
}

function invoke(body: string | Buffer[], synthesize: (text: string) => Promise<Buffer>, contentLength?: number): Promise<MiddlewareResult> {
  return new Promise((resolve) => {
    const request = Object.assign(new EventEmitter(), {
      method: "POST",
      url: "/api/v1/pronunciations",
      headers: contentLength === undefined ? {} : { "content-length": String(contentLength) },
      resume: vi.fn(),
    });
    const headers: Record<string, string | number> = {};
    const response = {
      statusCode: 0,
      setHeader(name: string, value: string | number) { headers[name] = value; },
      end(data: Buffer | string) { resolve({ status: this.statusCode, headers, body: Buffer.isBuffer(data) ? data : Buffer.from(data) }); },
    };
    createLocalTtsMiddleware(synthesize)(request as unknown as IncomingMessage, response as unknown as ServerResponse, vi.fn());
    queueMicrotask(() => {
      for (const chunk of Array.isArray(body) ? body : [Buffer.from(body)]) request.emit("data", chunk);
      request.emit("end");
    });
  });
}

describe("local Polish audio fallback", () => {
  it("returns WAV audio and native engine metadata while passing text as a literal string", async () => {
    const text = "--output-file /tmp/never-created $(touch /tmp/never-created)";
    const audio = Buffer.from("RIFFtestWAVEpcm");
    const synthesize = vi.fn(async () => audio);
    const result = await invoke(JSON.stringify({ text: `  ${text}  ` }), synthesize);
    expect(synthesize).toHaveBeenCalledWith(text);
    expect(result.status).toBe(200);
    expect(result.body).toEqual(audio);
    expect(result.headers["content-type"]).toBe("audio/wav");
    expect(result.headers["x-polski-loop-engine"]).toBe("macos-zosia-v1");
    expect(result.headers["x-polski-loop-voice"]).toBe("Zosia");
  });

  it.each(["invalid-json", JSON.stringify({ text: "" }), JSON.stringify({ text: "   " }), JSON.stringify({ text: 1 }), JSON.stringify({ text: "a".repeat(501) }), JSON.stringify({ text: "a\0b" })])("rejects invalid text without invoking speech synthesis (%s)", async (body) => {
    const synthesize = vi.fn(async () => Buffer.alloc(0));
    const result = await invoke(body, synthesize);
    expect(result.status).toBe(400);
    expect(synthesize).not.toHaveBeenCalled();
    expect(JSON.parse(result.body.toString("utf8")).message).toEqual(expect.any(String));
  });

  it("enforces the 8KB limit for both declared and streamed request bodies", async () => {
    const synthesize = vi.fn(async () => Buffer.alloc(0));
    const declared = await invoke("{}", synthesize, 8193);
    const streamed = await invoke([Buffer.alloc(4096, " "), Buffer.alloc(4097, " ")], synthesize);
    expect(declared.status).toBe(413);
    expect(streamed.status).toBe(413);
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("returns a safe Japanese message when the native process fails", async () => {
    const result = await invoke(JSON.stringify({ text: "woda" }), async () => { throw new Error("secret stderr detail"); });
    expect(result.status).toBe(503);
    expect(result.body.toString("utf8")).not.toContain("secret");
    expect(JSON.parse(result.body.toString("utf8")).message).toBe("ローカルのポーランド語音声を生成できませんでした。");
  });

  it.each([{ method: "GET", url: "/api/v1/pronunciations" }, { method: "POST", url: "/api/v1/vocabulary" }])("passes unrelated requests to the normal Worker proxy", (request) => {
    const next = vi.fn();
    const synthesize = vi.fn();
    createLocalTtsMiddleware(synthesize)(request as IncomingMessage, {} as ServerResponse, next);
    expect(next).toHaveBeenCalledOnce();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("disables the native flag and middleware in production builds", async () => {
    const config = await (viteConfig as (env: { command: string; mode: string }) => { define: Record<string, string>; plugins: Array<{ name?: string }> })({ command: "build", mode: "production" });
    expect(config.define.__LOCAL_NATIVE_TTS__).toBe("false");
    expect(config.plugins.some((plugin) => plugin.name === "polski-loop-local-native-tts")).toBe(false);
  });

  it("keeps the Google Worker route when a cloud key is configured", async () => {
    vi.stubEnv("GOOGLE_TTS_API_KEY", "test-placeholder-key");
    try {
      const config = await (viteConfig as (env: { command: string; mode: string }) => { define: Record<string, string>; plugins: Array<{ name?: string }> })({ command: "serve", mode: "development" });
      expect(config.define.__LOCAL_NATIVE_TTS__).toBe("false");
      expect(config.plugins.some((plugin) => plugin.name === "polski-loop-local-native-tts")).toBe(false);
      expect(JSON.stringify(config.define)).not.toContain("test-placeholder-key");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.skipIf(process.platform !== "darwin" || process.env.POLSKI_NATIVE_TTS_SMOKE !== "1")("synthesizes woda into a real PCM WAV using the installed Polish voice", async () => {
    const audio = await synthesizeLocalPolish("woda");
    expect(audio.toString("ascii", 0, 4)).toBe("RIFF");
    expect(audio.toString("ascii", 8, 12)).toBe("WAVE");
    const formatChunk = audio.indexOf(Buffer.from("fmt "));
    expect(formatChunk).toBeGreaterThanOrEqual(12);
    expect(audio.readUInt16LE(formatChunk + 8)).toBe(1);
    expect(audio.readUInt16LE(formatChunk + 22)).toBe(16);
    expect(audio.length).toBeGreaterThan(1000);
  }, 25_000);
});
