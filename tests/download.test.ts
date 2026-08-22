import { describe, expect, it } from "vitest";
import { safeTextFilename } from "../src/lib/download";

describe("safeTextFilename", () => {
  it("adds a txt extension and keeps readable Unicode", () => {
    expect(safeTextFilename("Polski Loop A1 まずは挨拶")).toBe("Polski-Loop-A1-まずは挨拶.txt");
  });

  it("replaces characters that are unsafe on common filesystems", () => {
    expect(safeTextFilename('lesson: 1/2? "voice"')).toBe("lesson-1-2-voice.txt");
  });

  it("does not duplicate an existing extension", () => {
    expect(safeTextFilename("prompt.TXT")).toBe("prompt.TXT");
  });
});
