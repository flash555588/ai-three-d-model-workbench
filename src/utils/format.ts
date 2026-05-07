export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function escapeObsidianMarkup(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\|/g, "\\|")
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/#/g, "\\#");
}

export function normalizeTagList(raw: string[], max = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length >= max) break;
    }
  }
  return result;
}
