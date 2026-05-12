import type { App } from "obsidian";
import { TFile } from "obsidian";
import { readFile } from "./node-shim";
import { pathIsAbsolute as isAbsolute, pathJoin as join, pathNormalize as normalize } from "./node-shim";

export function normalizePortablePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function getPortableDirname(path: string): string {
  const normalized = normalizePortablePath(path).replace(/\/+$/, "");
  const sepIdx = normalized.lastIndexOf("/");
  return sepIdx > 0 ? normalized.slice(0, sepIdx) : "";
}

export function getPortableBasename(path: string): string {
  const normalized = normalizePortablePath(path).replace(/\/+$/, "");
  const sepIdx = normalized.lastIndexOf("/");
  return sepIdx >= 0 ? normalized.slice(sepIdx + 1) : normalized;
}

export function getPortableStem(path: string): string {
  return getPortableBasename(path).replace(/\.[^.]+$/, "");
}

function toArrayBuffer(buf: Uint8Array): ArrayBuffer {
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
