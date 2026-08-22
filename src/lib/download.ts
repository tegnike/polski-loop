export function safeTextFilename(value: string): string {
  const stem = value
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|]+/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80) || "chatgpt-voice-prompt";
  return stem.toLocaleLowerCase("en-US").endsWith(".txt") ? stem : stem + ".txt";
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeTextFilename(filename);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
