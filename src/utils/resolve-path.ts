import type { App } from "obsidian";
import { TFile } from "obsidian";
import { readFile } from "./node-shim";
import { pathIsAbsolute as isAbsolute, pathJoin as join, pathNormalize as normalize } from "./node-shim";

function toArrayBuffer(buf: Buffer): ArrayBuffer { // eslint-disable-line no-undef -- Buffer is a Node.js global available in Electron
  return Uint8Array.from(buf).buffer;
}

function getVaultBasePath(app: App): string | null {
  const adapter = app.vault.adapter as {
    getBasePath?: () => string;
    basePath?: string;
  };

  if (typeof adapter.getBasePath === "function") {
    return adapter.getBasePath();
  }

  if (typeof adapter.basePath === "string" && adapter.basePath.length > 0) {
    return adapter.basePath;
  }

  return null;
}

/**
 * Resolve a model path using Obsidian's vault and metadata cache.
 * Returns the canonical vault path, or null if not found.
 */
export function resolveVaultPath(app: App, rawPath: string): string | null {
  const exact = app.vault.getAbstractFileByPath(rawPath);
  if (exact) return exact.path;

  const resolved = app.metadataCache?.getFirstLinkpathDest?.(rawPath, "");
  if (resolved) return resolved.path;

  return null;
}

export function resolveVaultAbsolutePath(app: App, vaultPath: string): string | null {
  if (isAbsolute(vaultPath)) {
    return normalize(vaultPath);
  }

  const basePath = getVaultBasePath(app);
  if (!basePath) {
    return null;
  }

  return normalize(join(basePath, vaultPath));
}

export async function readBinaryPath(app: App, path: string): Promise<ArrayBuffer> {
  if (isAbsolute(path)) {
    const buf = await readFile(path);
    return toArrayBuffer(buf);
  }

  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new Error(`File not found: ${path}`);
  }

  return app.vault.readBinary(file);
}
