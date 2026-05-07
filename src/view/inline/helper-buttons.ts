import type { App } from "obsidian";

/** Any preview that supports snapshot capture. */
export interface SnapshotProvider {
  captureSnapshot(): string | null;
}

/**
 * Create helper buttons BELOW the preview host (as a sibling).
 * @param previewHost — the .ai3d-preview-host or .ai3d-grid-host element
 */
export function createHelperButtons(
  previewHost: HTMLElement,
  app: App,
  getPreview: () => SnapshotProvider | null,
  getModelPath: () => string,
  onRemove: () => void,
): void {
  const toolbar = document.createElement("div");
  toolbar.className = "ai3d-helper-toolbar";

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

  // Export snapshot button (camera)
  const exportBtn = document.createElement("button");
  exportBtn.className = "ai3d-inline-btn";
  exportBtn.setAttribute("aria-label", "Export snapshot");
  exportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  exportBtn.addEventListener("click", async () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const modelPath = getModelPath();
      const baseName = modelPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "model";
      const fileName = `${baseName}_snapshot_${Date.now()}.png`;

      const res = await fetch(dataUrl);
      const buffer = await res.arrayBuffer();

      // Save to vault's Media/3D Previews folder
      const folder = "Media/3D Previews";
      const folderExists = await app.vault.adapter.exists(folder);
      if (!folderExists) {
        await app.vault.createFolder(folder).catch(() => {});
      }

      const filePath = `${folder}/${fileName}`;
      await app.vault.createBinary(filePath, buffer);
      showTooltip(exportBtn, "Saved!");
    } catch (err) {
      console.error("[AI3D] Export snapshot failed:", err);
      showTooltip(exportBtn, "Failed");
    }
  });
  toolbar.appendChild(exportBtn);

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
