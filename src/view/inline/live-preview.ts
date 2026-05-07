/**
 * CM6 ViewPlugin for Live Preview embed rendering.
 * Replaces `![[model.glb]]` syntax with inline 3D preview widgets.
 */

import type { App } from "obsidian";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { StateField, StateEffect, RangeSet, Range } from "@codemirror/state";
import { SUPPORTED_MODEL_EXTENSIONS } from "../../domain/constants";
import type { PluginSettings } from "../../domain/models";
import type { BabylonModelPreview } from "../../render/babylon/scene";

// ── Widget ────────────────────────────────────────────────────────

class ModelEmbedWidget extends WidgetType {
  private preview: BabylonModelPreview | null = null;
  private mounted = false;
  private observer: MutationObserver | null = null;

  constructor(
    private app: App,
    private modelPath: string,
    private width: number,
    private height: number,
    private autoRotate: boolean,
  ) {
    super();
  }

  override eq(other: ModelEmbedWidget): boolean {
    return (
      this.modelPath === other.modelPath &&
      this.width === other.width &&
      this.height === other.height
    );
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("div");
    host.className = "ai3d-embed-preview";

    const canvas = document.createElement("canvas");
    canvas.className = "ai3d-embed-canvas";
    canvas.style.height = `${this.height}px`;
    host.appendChild(canvas);

    const loading = document.createElement("div");
    loading.className = "ai3d-embed-loading";
    loading.textContent = "Loading 3D...";
    host.appendChild(loading);

    const error = document.createElement("div");
    error.className = "ai3d-embed-error";
    error.style.display = "none";
    host.appendChild(error);

    // Wait until widget is connected to DOM, then initialize
    this.observer = new MutationObserver(() => {
      if (!this.mounted && host.isConnected) {
        this.mounted = true;
        this.observer?.disconnect();
        this.observer = null;
        this.initPreview(canvas, loading, error);
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });

    return host;
  }

  private async initPreview(
    canvas: HTMLCanvasElement,
    loading: HTMLDivElement,
    error: HTMLDivElement,
  ): Promise<void> {
    try {
      const { BabylonModelPreview } = await import("../../render/babylon/scene");
      this.preview = new BabylonModelPreview(canvas);

      const file = this.app.vault.getAbstractFileByPath(this.modelPath);
      if (!file || !("extension" in file)) {
        throw new Error(`File not found: ${this.modelPath}`);
      }

      const data = await this.app.vault.readBinary(file as any);
      const ext = (file as any).extension.toLowerCase();
      await this.preview.loadModel(data, ext);

      if (this.autoRotate) {
        this.preview.applyConfig({
          models: [],
          scene: { autoRotate: true, autoRotateSpeed: 0.5 },
        });
      }

      loading.style.display = "none";
    } catch (err) {
      loading.style.display = "none";
      error.style.display = "";
      error.textContent = `[AI3D] ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  override destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.preview) {
      this.preview.destroy();
      this.preview = null;
    }
    this.mounted = false;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

// ── Document scanner ──────────────────────────────────────────────

function findEmbeds(
  view: EditorView,
  app: App,
  autoRotate: boolean,
): Range<Decoration>[] {
  const doc = view.state.doc;
  const ranges: Range<Decoration>[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    if (!text.includes("![")) continue;

    let pos = 0;
    while (pos < text.length) {
      const start = text.indexOf("![[", pos);
      if (start === -1) break;

      const end = text.indexOf("]]", start + 3);
      if (end === -1) break;

      const raw = text.slice(start + 3, end);
      const parts = raw.split("|");
      const filename = parts[0].trim();

      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      if (!SUPPORTED_MODEL_EXTENSIONS.has(ext)) {
        pos = end + 2;
        continue;
      }

      // Parse optional size: ![[model.glb|400x300]]
      let w = 400;
      let h = 300;
      if (parts.length > 1) {
        const sizeMatch = parts[1].trim().match(/^(\d+)\s*x\s*(\d+)$/);
        if (sizeMatch) {
          w = parseInt(sizeMatch[1], 10);
          h = parseInt(sizeMatch[2], 10);
        }
      }

      const modelPath = resolveVaultPath(app, filename);
      if (!modelPath) {
        pos = end + 2;
        continue;
      }

      const from = line.from + start;
      const to = line.from + end + 2;

      ranges.push(
        Decoration.widget({
          widget: new ModelEmbedWidget(app, modelPath, w, h, autoRotate),
          block: true,
          side: 1,
        }).range(from, to),
      );

      pos = end + 2;
    }
  }

  return ranges;
}

function resolveVaultPath(app: App, rawPath: string): string | null {
  const exact = app.vault.getAbstractFileByPath(rawPath);
  if (exact) return exact.path;

  const resolved = (app as any).metadataCache?.getFirstLinkpathDest?.(rawPath, "");
  if (resolved) return resolved.path;

  return null;
}

// ── StateEffect ───────────────────────────────────────────────────

const updateEmbeds = StateEffect.define<void>();

// ── StateField + ViewPlugin ───────────────────────────────────────

type DecoSet = RangeSet<Decoration>;

export function registerLivePreviewExtension(app: App, getSettings: () => PluginSettings) {
  const embedField = StateField.define<DecoSet>({
    create(state): DecoSet {
      const s = getSettings();
      const ranges = findEmbeds({ state } as EditorView, app, s.autoRotateDefault);
      return ranges.length > 0 ? RangeSet.of(ranges, true) : RangeSet.empty;
    },
    update(value, tr): DecoSet {
      if (tr.docChanged || tr.effects.some((e) => e.is(updateEmbeds))) {
        const s = getSettings();
        const ranges = findEmbeds(tr.state as any, app, s.autoRotateDefault);
        return ranges.length > 0 ? RangeSet.of(ranges, true) : RangeSet.empty;
      }
      return value.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const refreshPlugin = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      update.view.dispatch({ effects: updateEmbeds.of() });
    }
  });

  return [embedField, refreshPlugin];
}
