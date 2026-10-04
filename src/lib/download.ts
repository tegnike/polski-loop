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

export async function downloadTextFile(filename: string, content: string): Promise<void> {
  await saveFile(safeTextFilename(filename), new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" }));
}

export async function saveFile(filename: string, blob: Blob): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    await shareNativeFile(filename, blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// iOSアプリのWebViewはblobのダウンロードを扱えないため、一時ファイルを共有シートで渡す。
async function shareNativeFile(filename: string, blob: Blob): Promise<void> {
  const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blob.text(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return;
    throw error;
  }
}
