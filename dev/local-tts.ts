import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Connect, Plugin } from "vite";
import { normalizePronunciationText } from "../src/lib/pronunciation-config";

const execFileAsync = promisify(execFile);
const MAX_BODY_BYTES = 8 * 1024;

class LocalTtsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) {
    request.resume();
    return Promise.reject(new LocalTtsError(413, "音声リクエストが大きすぎます。"));
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const cleanup = () => {
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("error", onError);
      request.removeListener("aborted", onAborted);
    };
    const fail = (error: Error) => {
      cleanup();
      request.resume();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += bytes.length;
      if (length > MAX_BODY_BYTES) {
        fail(new LocalTtsError(413, "音声リクエストが大きすぎます。"));
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = () => fail(new LocalTtsError(400, "音声リクエストを読み取れませんでした。"));
    const onAborted = () => fail(new LocalTtsError(400, "音声リクエストが中断されました。"));
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
  });
}

function parseText(body: Buffer): string {
  let parsed: unknown;
  try { parsed = JSON.parse(body.toString("utf8")); } catch {
    throw new LocalTtsError(400, "音声リクエストのJSONが正しくありません。");
  }
  const text = typeof parsed === "object" && parsed !== null && "text" in parsed ? parsed.text : undefined;
  if (typeof text !== "string" || !text.trim() || text.includes("\0")) {
    throw new LocalTtsError(400, "発音するポーランド語を入力してください。");
  }
  if (text.length > 500) throw new LocalTtsError(400, "読み上げる文章は500文字以下にしてください。");
  return normalizePronunciationText(text);
}

export async function synthesizeLocalPolish(text: string): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), "polski-loop-tts-"));
  try {
    const output = join(directory, "pronunciation.wav");
    await execFileAsync("/usr/bin/say", ["-v", "Zosia", "-o", output, "--file-format=WAVE", "--data-format=LEI16", "--", text], {
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LC_ALL: "C" },
    });
    const audio = await readFile(output);
    if (audio.length <= 44 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
      throw new Error("Invalid local speech audio.");
    }
    return audio;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export function createLocalTtsMiddleware(synthesize = synthesizeLocalPolish): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== "POST" || request.url?.split("?")[0] !== "/api/v1/pronunciations") {
      next();
      return;
    }
    void (async () => {
      try {
        const text = parseText(await readBody(request));
        const audio = await synthesize(text);
        response.statusCode = 200;
        response.setHeader("content-type", "audio/wav");
        response.setHeader("content-length", audio.length);
        response.setHeader("cache-control", "no-store");
        response.setHeader("x-content-type-options", "nosniff");
        response.setHeader("x-polski-loop-provider", "macos-zosia");
        response.setHeader("x-polski-loop-voice", "Zosia");
        response.setHeader("x-polski-loop-engine", "macos-zosia-v1");
        response.end(audio);
      } catch (error) {
        response.statusCode = error instanceof LocalTtsError ? error.status : 503;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify({ message: error instanceof LocalTtsError ? error.message : "ローカルのポーランド語音声を生成できませんでした。" }));
      }
    })();
  };
}

export function localNativeTtsPlugin(): Plugin {
  return {
    name: "polski-loop-local-native-tts",
    apply: "serve",
    configureServer(server) {
      // Register before Vite's proxy so only this pronunciation route is handled locally.
      server.middlewares.use(createLocalTtsMiddleware());
    },
  };
}
