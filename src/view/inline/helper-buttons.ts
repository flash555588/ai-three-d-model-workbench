import type { App } from "obsidian";
import type { PluginSettings } from "../../domain/models";

/** Create an SVG icon that follows its button color via currentColor. */
function createSvgIcon(inner: string): SVGSVGElement {
  const svg = activeDocument.createSvg("svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    "image/svg+xml",
  );
  for (const child of Array.from(doc.documentElement.childNodes)) {
    svg.appendChild(activeDocument.importNode(child, true));
  }
  return svg;
}

/** Convert a data URL to a Blob without using fetch(). */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Any preview that supports snapshot capture. */
export interface SnapshotProvider {
  captureSnapshot(): string | null;
  resetView?(): void;
  exportModelInfo?(modelPath?: string): string;
  toggleWireframe?(): boolean;
  toggleOrientationGizmo?(): boolean;
  toggleBoundingBox?(): boolean;
  toggleDisassembly?(): boolean;
  resetDisassembly?(): void;
  hasAnimations?(): boolean;
  toggleAnimation?(): boolean;
  /** Set render resolution scale (1.0 = native). Returns the applied scale. */
  setRenderScale?(scale: number): number;
}

/** Handle returned by createHelperButtons — callers hold a direct reference. */
export interface HelperToolbar {
  showAnimButton(): void;
  showAnnotateButton(): void;
  updateAnnotationBadge(count: number): void;
}

/**
 * Create helper buttons BELOW the preview host (as a sibling).
 * @param parentEl  Parent element already in the live DOM — Obsidian's createEl
 *                  reads CSS variables from the live DOM to apply theme styling.
 * @param previewHost  The preview host element; toolbar is inserted after it.
 */
export function createHelperButtons(
  parentEl: HTMLElement,
  previewHost: HTMLElement,
  app: App,
  getPreview: () => SnapshotProvider | null,
  getModelPath: () => string,
  onRemove: () => void,
  getSettings?: () => PluginSettings,
  onToggleAnnotate?: () => boolean,
): HelperToolbar {
  // Create on parentEl (in DOM) so Obsidian's createEl inherits CSS variables
  const toolbar = parentEl.createDiv({ cls: "ai3d-helper-toolbar" });

  // Reset view button (refresh arrow)
  const resetBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Reset view" } });
  resetBtn.appendChild(createSvgIcon(`<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>`));
  resetBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (preview?.resetView) {
      preview.resetView();
      showTooltip(resetBtn, "Reset");
    }
  });

  // Export model info button (info circle)
  const infoBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Copy model info as Markdown" } });
  infoBtn.appendChild(createSvgIcon(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`));
  infoBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.exportModelInfo) return;
    try {
      const md = preview.exportModelInfo(getModelPath());
      if (!md) return;
      void navigator.clipboard.writeText(md).then(() => {
        showTooltip(infoBtn, "Copied!");
      }).catch(() => {
        showTooltip(infoBtn, "Failed");
      });
    } catch (err) {
      console.error("[AI3D] Export model info failed:", err);
      showTooltip(infoBtn, "Failed");
    }
  });

  // Wireframe toggle button (grid/square icon)
  const wireBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Toggle wireframe" } });
  wireBtn.appendChild(createSvgIcon(`<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="21"/>`));
  wireBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleWireframe) return;
    const on = preview.toggleWireframe();
    wireBtn.classList.toggle("ai3d-btn-active", on);
    showTooltip(wireBtn, on ? "Wireframe" : "Solid");
  });

  // Orientation gizmo toggle button (compass/axis icon)
  const gizmoBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Toggle orientation axes" } });
  gizmoBtn.appendChild(createSvgIcon(`<path d="M12 2v20"/><path d="M2 12h20"/><path d="M12 2l4 4"/><path d="M12 2l-4 4"/><path d="M22 12l-4-4"/><path d="M22 12l-4 4"/>`));
  gizmoBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleOrientationGizmo) return;
    const on = preview.toggleOrientationGizmo();
    gizmoBtn.classList.toggle("ai3d-btn-active", on);
    showTooltip(gizmoBtn, on ? "Axes On" : "Axes Off");
  });

  // Bounding box toggle button (cube outline icon)
  const bboxBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Toggle bounding box" } });
  bboxBtn.appendChild(createSvgIcon(`<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`));
  bboxBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleBoundingBox) return;
    const on = preview.toggleBoundingBox();
    bboxBtn.classList.toggle("ai3d-btn-active", on);
    showTooltip(bboxBtn, on ? "BBox On" : "BBox Off");
  });

  // Disassembly mode toggle button (separate parts by dragging)
  const disassembleBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Toggle disassembly mode" } });
  disassembleBtn.appendChild(createSvgIcon(`<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 17h6"/><path d="M17 14v6"/>`));
  disassembleBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleDisassembly) return;
    const on = preview.toggleDisassembly();
    disassembleBtn.classList.toggle("ai3d-btn-active", on);
    showTooltip(disassembleBtn, on ? "Disassemble On" : "Disassemble Off");
  });

  // Reset disassembled parts button
  const resetPartsBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Reset disassembled parts" } });
  resetPartsBtn.appendChild(createSvgIcon(`<path d="M3 12a9 9 0 109-9"/><path d="M3 4v8h8"/><rect x="14" y="14" width="5" height="5" rx="1"/>`));
  resetPartsBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.resetDisassembly) return;
    preview.resetDisassembly();
    showTooltip(resetPartsBtn, "Parts Reset");
  });

  // Resolution scale cycle button (percentage display)
  const RES_PRESETS = [0.5, 0.75, 1.0, 1.5, 2.0];
  let resIndex = 2; // default 1.0x
  const resBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn ai3d-res-btn", attr: { "aria-label": "Change resolution (click to cycle)" } });
  resBtn.textContent = "1.0x";
  resBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.setRenderScale) return;
    resIndex = (resIndex + 1) % RES_PRESETS.length;
    const applied = preview.setRenderScale(RES_PRESETS[resIndex]);
    resBtn.textContent = `${applied}x`;
    showTooltip(resBtn, `Resolution: ${applied}x`);
  });

  // Animation play/pause button (play triangle — hidden until animations detected)
  const animBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn is-hidden", attr: { "aria-label": "Play/pause animation" } });
  animBtn.appendChild(createSvgIcon(`<polygon points="5 3 19 12 5 21 5 3"/>`));
  animBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview?.toggleAnimation) return;
    const playing = preview.toggleAnimation();
    animBtn.replaceChildren(createSvgIcon(playing
      ? `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`
      : `<polygon points="5 3 19 12 5 21 5 3"/>`));
    showTooltip(animBtn, playing ? "Playing" : "Paused");
  });

  // Remove button (trash)
  const removeBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Remove preview" } });
  removeBtn.appendChild(createSvgIcon(`<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>`));
  removeBtn.addEventListener("click", onRemove);

  // Copy snapshot button (clipboard)
  const copyBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Copy snapshot" } });
  copyBtn.appendChild(createSvgIcon(`<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>`));
  copyBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const blob = dataUrlToBlob(dataUrl);
      void navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]).then(() => {
        showTooltip(copyBtn, "Copied!");
      }).catch(() => {
        showTooltip(copyBtn, "Failed");
      });
    } catch (err) {
      console.error("[AI3D] Copy snapshot failed:", err);
      showTooltip(copyBtn, "Failed");
    }
  });

  // Save to vault button (disk)
  const saveBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Save snapshot to vault" } });
  saveBtn.appendChild(createSvgIcon(`<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`));
  saveBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const modelPath = getModelPath();
      const baseName = modelPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "model";
      const settings = getSettings?.();
      const folder = settings?.snapshotFolder ?? "Media/3D Previews";
      const naming = settings?.snapshotNaming ?? "model-name";
      const ts = Date.now();
      const fileName = naming === "timestamp"
        ? `snapshot_${ts}.png`
        : `${baseName}_snapshot_${ts}.png`;

      const blob = dataUrlToBlob(dataUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        void app.vault.adapter.exists(folder).then((exists) => {
          const create = exists ? Promise.resolve() : app.vault.createFolder(folder).catch(() => {});
          return create;
        }).then(() => {
          return app.vault.createBinary(`${folder}/${fileName}`, buffer);
        }).then(() => {
          showTooltip(saveBtn, "Saved!");
        }).catch((err: unknown) => {
          console.error("[AI3D] Save snapshot failed:", err);
          showTooltip(saveBtn, "Failed");
        });
      };
      reader.onerror = () => {
        console.error("[AI3D] FileReader error");
        showTooltip(saveBtn, "Failed");
      };
      reader.onabort = () => {
        console.error("[AI3D] FileReader aborted");
        showTooltip(saveBtn, "Failed");
      };
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      console.error("[AI3D] Save snapshot failed:", err);
      showTooltip(saveBtn, "Failed");
    }
  });

  // Download snapshot button (download arrow)
  const downloadBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn", attr: { "aria-label": "Download snapshot" } });
  downloadBtn.appendChild(createSvgIcon(`<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`));
  downloadBtn.addEventListener("click", () => {
    const preview = getPreview();
    if (!preview) return;
    try {
      const dataUrl = preview.captureSnapshot();
      if (!dataUrl) return;
      const modelPath = getModelPath();
      const baseName = modelPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "model";
      const fileName = `${baseName}_snapshot_${Date.now()}.png`;

      // eslint-disable-next-line obsidianmd/prefer-create-el -- temporary <a> for download click, not styled
      const a = activeDocument.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      activeDocument.body.appendChild(a);
      a.click();
      a.remove();
      showTooltip(downloadBtn, "Downloaded!");
    } catch (err) {
      console.error("[AI3D] Download snapshot failed:", err);
      showTooltip(downloadBtn, "Failed");
    }
  });

  // Annotation toggle button (tag/label icon — hidden until explicitly shown)
  const annotBtn = toolbar.createEl("button", { cls: "ai3d-inline-btn is-hidden ai3d-annot-btn", attr: { "aria-label": "Toggle annotation mode" } });
  annotBtn.appendChild(createSvgIcon(`<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`));
  const annotBadge = annotBtn.createSpan({ cls: "ai3d-pin-badge is-hidden" });
  annotBtn.addEventListener("click", () => {
    if (!onToggleAnnotate) return;
    const active = onToggleAnnotate();
    annotBtn.classList.toggle("ai3d-btn-active", active);
    showTooltip(annotBtn, active ? "Annotate On · ESC to exit" : "Annotate Off");
  });

  // Move toolbar to sit right after previewHost
  parentEl.insertBefore(toolbar, previewHost.nextSibling);

  return {
    showAnimButton() { animBtn.classList.remove("is-hidden"); },
    showAnnotateButton() { annotBtn.classList.remove("is-hidden"); },
    updateAnnotationBadge(count: number) {
      if (count > 0) {
        annotBadge.textContent = String(count);
        annotBadge.classList.remove("is-hidden");
      } else {
        annotBadge.classList.add("is-hidden");
      }
    },
  };
}

// Track one tooltip per anchor to prevent stacking (#28)
const activeTooltips = new WeakMap<HTMLElement, HTMLElement>();

function showTooltip(anchor: HTMLElement, text: string): void {
  activeTooltips.get(anchor)?.remove();
  // Create on anchor's parent (in DOM) to inherit Obsidian theme colors
  const parent = anchor.parentElement;
  if (!parent) return;
  const tip = parent.createDiv({ cls: "ai3d-tooltip" });
  tip.textContent = text;
  activeTooltips.set(anchor, tip);
  activeWindow.setTimeout(() => { tip.remove(); activeTooltips.delete(anchor); }, 1500);
}
