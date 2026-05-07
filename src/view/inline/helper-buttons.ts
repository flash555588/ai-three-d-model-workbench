import type { App } from "obsidian";
import type { PluginSettings } from "../../domain/models";

/** Any preview that supports snapshot capture. */
export interface SnapshotProvider {
  captureSnapshot(): string | null;
  resetView?(): void;
  exportModelInfo?(modelPath?: string): string;
  toggleWireframe?(): boolean;
}

/**
 * Create helper buttons BELOW the preview host (as a sibling).
 * @param previewHost — the .ai3d-preview-host or .ai3d-grid-host element
 * @param getSettings — lazy accessor for plugin settings
 */
export function createHelperButtons(
  previewHost: HTMLElement,
  app: App,
  getPreview: () => SnapshotProvider | null,
  getModelPath: () => string,
  onRemove: () => void,
  getSettings?: () => PluginSettings,
): void {
  const toolbar = document.createElement("div");
  toolbar.className = "ai3d-helper-toolbar";

  // Reset view button (refresh arrow)
  const resetBtn = document.createElement("button");
  resetBtn.className = "ai3d-inline-btn";
  resetBtn.setAttribute("aria-label", "Reset view");
  resetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
  resetBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (preview?.resetView) {
      preview.resetView();
      showTooltip(resetBtn, "Reset");
    }
  });
  toolbar.appendChild(resetBtn);

  // Export model info button (info circle)
  const infoBtn = document.createElement("button");
  infoBtn.className = "ai3d-inline-btn";
  infoBtn.setAttribute("aria-label", "Copy model info as Markdown");
  infoBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  infoBtn.addEventListener("click", async () => {
    const preview = getPreview();
    if (!preview?.exportModelInfo) return;
    try {
      const md = preview.exportModelInfo(getModelPath());
      if (!md) return;
      await navigator.clipboard.writeText(md);
      showTooltip(infoBtn, "Copied!");
    } catch (err) {
      console.error("[AI3D] Export model info failed:", err);
      showTooltip(infoBtn, "Failed");
    }
  });
  toolbar.appendChild(infoBtn);

  // Wireframe toggle button (grid/square icon)
  const wireBtn = document.createElement("button");
  wireBtn.className = "ai3d-inline-btn";
  wireBtn.setAttribute("aria-label", "Toggle wireframe");
  wireBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`;
  wireBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleWireframe) return;
    const on = preview.toggleWireframe();
    wireBtn.style.color = on ? "var(--interactive-accent)" : "";
    showTooltip(wireBtn, on ? "Wireframe" : "Solid");
  });
  toolbar.appendChild(wireBtn);

  // Remove button (trash)
  const removeBtn = document.createElement("button");
  removeBtn.className = "ai3d-inline-btn";
  removeBtn.setAttribute("aria-label", "Remove preview");
  removeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;
  removeBtn.addEventListener("click", onRemove);
  toolbar.appendChild(removeBtn);

  // Copy snapshot button (clipboard)
  const copyBtn = document.createElement("button");
  copyBtn.className = "ai3d-inline-btn";
  copyBtn.setAttribute("aria-label", "Copy snapshot");
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
  copyBtn.addEventListener("click", async () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showTooltip(copyBtn, "Copied!");
    } catch (err) {
      console.error("[AI3D] Copy snapshot failed:", err);
      showTooltip(copyBtn, "Failed");
    }
  });
  toolbar.appendChild(copyBtn);

  // Save to vault button (disk)
  const saveBtn = document.createElement("button");
  saveBtn.className = "ai3d-inline-btn";
  saveBtn.setAttribute("aria-label", "Save snapshot to vault");
  saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
  saveBtn.addEventListener("click", async () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const modelPath = getModelPath();
      const baseName = modelPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "model";
      const settings = getSettings?.();
      const folder = settings?.snapshotFolder ?? "Media/3D Previews";
      const naming = settings?.snapshotNaming ?? "model-name";
      const ts = Date.now();
      const fileName = naming === "timestamp"
        ? `snapshot_${ts}.png`
        : `${baseName}_snapshot_${ts}.png`;

      const res = await fetch(dataUrl);
      const buffer = await res.arrayBuffer();

      const folderExists = await app.vault.adapter.exists(folder);
      if (!folderExists) {
        await app.vault.createFolder(folder).catch(() => {});
      }

      const filePath = `${folder}/${fileName}`;
      await app.vault.createBinary(filePath, buffer);
      showTooltip(saveBtn, "Saved!");
    } catch (err) {
      console.error("[AI3D] Save snapshot failed:", err);
      showTooltip(saveBtn, "Failed");
    }
  });
  toolbar.appendChild(saveBtn);

  // Download snapshot button (download arrow)
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "ai3d-inline-btn";
  downloadBtn.setAttribute("aria-label", "Download snapshot");
  downloadBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  downloadBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const modelPath = getModelPath();
      const baseName = modelPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "model";
      const fileName = `${baseName}_snapshot_${Date.now()}.png`;

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showTooltip(downloadBtn, "Downloaded!");
    } catch (err) {
      console.error("[AI3D] Download snapshot failed:", err);
      showTooltip(downloadBtn, "Failed");
    }
  });
  toolbar.appendChild(downloadBtn);

  // Insert toolbar as a sibling AFTER the preview host
  previewHost.parentElement?.insertBefore(toolbar, previewHost.nextSibling);
}

function showTooltip(anchor: HTMLElement, text: string): void {
  const tip = document.createElement("div");
  tip.className = "ai3d-tooltip";
  tip.textContent = text;
  anchor.parentElement?.appendChild(tip);
  setTimeout(() => tip.remove(), 1500);
}
