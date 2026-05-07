import type { App } from "obsidian";

/**
 * Resolve a model path using Obsidian's vault and metadata cache.
 * Returns the canonical vault path, or null if not found.
 */
export function resolveVaultPath(app: App, rawPath: string): string | null {
  const exact = app.vault.getAbstractFileByPath(rawPath);
  if (exact) return exact.path;

  const resolved = (app as any).metadataCache?.getFirstLinkpathDest?.(rawPath, "");
  if (resolved) return resolved.path;

  return null;
}
