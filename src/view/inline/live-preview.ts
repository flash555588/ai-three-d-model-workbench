/**
 * CM6 ViewPlugin for Live Preview embed rendering.
 * Replaces `![[model.glb]]` syntax with inline 3D preview widgets.
 */

import type { App } from "obsidian";
import { EditorView, Decoration, WidgetType } from "@codemirror/view";
import { StateField, StateEffect, RangeSet, Range } from "@codemirror/state";
import { isSupportedModelExtension } from "../../io/formats/registry";
import type { PluginSettings, AnnotationPin } from "../../domain/models";
import type { BabylonModelPreview } from "../../render/babylon/scene";
import { AnnotationManager } from "../../render/babylon/annotations";
import { readBinaryPath, resolveVaultAbsolutePath, resolveVaultPath } from "../../utils/resolve-path";
import { createConversionManager } from "../../io/conversion/factory";
import type { ConvertedAssetCache } from "../../io/cache/converted-asset-cache";
import { prepareModelInput } from "../../io/model-pipeline";
import { listPreferredConversionExts } from "../../io/formats/route-preferences";
import { createLoadingOverlay, type LoadingOverlay } from "./loading-overlay";
import { createNoteReader } from "../../utils/note-reader";
import { createStagedDiv, createStagedEl } from "../../utils/dom";

// ── Widget ────────────────────────────────────────────────────────

class ModelEmbedWidget extends WidgetType {
  private preview: BabylonModelPreview | null = null;
  private annotationMgr: AnnotationManager | null = null;
  private mounted = false;
  private pollId = 0;

  constructor(
    private app: App,
    private modelPath: string,
    private width: number,
    private height: number,
    private autoRotate: boolean,
    private enabledConverterIds: string[],
    private freecadCommand: string,
    private obj2gltfCommand: string,
    private fbx2gltfCommand: string,
    private freecadcmdCommand: string,
    private preferObj2gltfForObj: boolean,
    private preferFbx2gltfForFbx: boolean,
    private annotationPreviewMode: PluginSettings["annotationPreviewMode"],
    private convertedAssetCache: ConvertedAssetCache,
    private getAnnotations?: (modelPath: string) => AnnotationPin[],
  ) {
    super();
  }

  override eq(other: ModelEmbedWidget): boolean {
    return (
      this.modelPath === other.modelPath &&
      this.width === other.width &&
      this.height === other.height &&
      this.autoRotate === other.autoRotate &&
      this.enabledConverterIds.join("|") === other.enabledConverterIds.join("|") &&
      this.freecadCommand === other.freecadCommand &&
      this.obj2gltfCommand === other.obj2gltfCommand &&
      this.fbx2gltfCommand === other.fbx2gltfCommand &&
      this.freecadcmdCommand === other.freecadcmdCommand &&
      this.preferObj2gltfForObj === other.preferObj2gltfForObj &&
      this.preferFbx2gltfForFbx === other.preferFbx2gltfForFbx &&
      this.annotationPreviewMode === other.annotationPreviewMode &&
      this.convertedAssetCache === other.convertedAssetCache
    );
  }

  override toDOM(): HTMLElement {
    const host = createStagedDiv("ai3d-embed-preview");

    const canvas = createStagedEl("canvas", "ai3d-embed-canvas");
    canvas.style.setProperty("--ai3d-embed-height", `${this.height}px`);
    host.appendChild(canvas);

    const loading = createLoadingOverlay(host);

    const error = createStagedDiv("ai3d-embed-error is-hidden");
    host.appendChild(error);

    // Poll host.isConnected via rAF — avoids O(N*M) MutationObserver on document.body
    let attempts = 0;
    const poll = () => {
      if (this.mounted) return;
      if (host.isConnected) {
        this.mounted = true;
        void this.initPreview(host, canvas, loading, error);
        return;
      }
      if (++attempts > 120) return; // ~2s at 60fps, give up
      this.pollId = requestAnimationFrame(poll);
    };
    this.pollId = requestAnimationFrame(poll);

    return host;
  }

  private async initPreview(
    host: HTMLElement,
    canvas: HTMLCanvasElement,
    loading: LoadingOverlay,
    error: HTMLDivElement,
  ): Promise<void> {
    try {
      const { BabylonModelPreview } = await import("../../render/babylon/scene");
      this.preview = new BabylonModelPreview(canvas);
      const absolutePath = resolveVaultAbsolutePath(this.app, this.modelPath) ?? undefined;
      const conversionManager = createConversionManager({
        enabledConverterIds: this.enabledConverterIds,
        freecadCommand: this.freecadCommand,
        obj2gltfCommand: this.obj2gltfCommand,
        fbx2gltfCommand: this.fbx2gltfCommand,
        freecadcmdCommand: this.freecadcmdCommand,
      });
      loading.setPhaseKey("loading.preparingModel");
      const prepared = await prepareModelInput({
        path: this.modelPath,
        absolutePath,
        preferConversionExts: listPreferredConversionExts({
          preferObj2gltfForObj: this.preferObj2gltfForObj,
          preferFbx2gltfForFbx: this.preferFbx2gltfForFbx,
        }),
        conversionManager,
        convertedAssetCache: this.convertedAssetCache,
      });
      loading.setPhaseKey("loading.loadingModel");
      const data = await readBinaryPath(this.app, prepared.effectivePath);
      await this.preview.loadModel(
        data,
        prepared.effectiveExt,
        (path) => readBinaryPath(this.app, path),
        prepared.effectivePath,
      );

      if (this.autoRotate) {
        this.preview.applyConfig({
          models: [],
          scene: { autoRotate: true, autoRotateSpeed: 0.5 },
        });
      }

      // Readonly annotations
      if (this.getAnnotations) {
        const pins = this.getAnnotations(this.modelPath);
        if (pins.length > 0) {
          const canvasEl = this.preview.getCanvas();
          if (canvasEl) {
            this.annotationMgr = new AnnotationManager(
              { scene: this.preview.getScene(), camera: this.preview.getCamera(), engine: this.preview.getEngine(), canvas: canvasEl },
              host,
              "readonly",
              pins,
              undefined,
              createNoteReader(this.app),
              undefined,
              { app: this.app, previewMode: this.annotationPreviewMode },
            );
          }
        }
      }

      loading.setProgress(100);
      loading.hide();
    } catch (err) {
      this.preview?.destroy();
      this.preview = null;
      loading.hide();
      error.classList.remove("is-hidden");
      error.textContent = `[AI3D] ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  override destroy(): void {
    cancelAnimationFrame(this.pollId);
    this.pollId = 0;
    this.annotationMgr?.destroy();
    this.annotationMgr = null;
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
  viewOrState: { state: import("@codemirror/state").EditorState } | import("@codemirror/state").EditorState,
  app: App,
  autoRotate: boolean,
  enabledConverterIds: string[],
  freecadCommand: string,
  obj2gltfCommand: string,
  fbx2gltfCommand: string,
  freecadcmdCommand: string,
  preferObj2gltfForObj: boolean,
  preferFbx2gltfForFbx: boolean,
  annotationPreviewMode: PluginSettings["annotationPreviewMode"],
  convertedAssetCache: ConvertedAssetCache,
  getAnnotations?: (modelPath: string) => AnnotationPin[],
): Range<Decoration>[] {
  const doc = "state" in viewOrState ? viewOrState.state.doc : viewOrState.doc;
  const ranges: Range<Decoration>[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    if (!text.includes("![")) continue;

    let pos = 0;
    while (pos < text.length) {
      const start = text.indexOf("![[", pos);
      if (start === -1) break;

      // Skip escaped embeds: \![[model.glb]]
      if (start > 0 && text[start - 1] === "\\") {
        pos = start + 3;
        continue;
      }

      const end = text.indexOf("]]", start + 3);
      if (end === -1) break;

      const raw = text.slice(start + 3, end);
      const parts = raw.split("|");
      const filename = parts[0].trim();

      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      if (!isSupportedModelExtension(ext)) {
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

      // Widget decorations require zero-length ranges — place at the start of the embed
      ranges.push(
        Decoration.widget({
          widget: new ModelEmbedWidget(
            app,
            modelPath,
            w,
            h,
            autoRotate,
            enabledConverterIds,
            freecadCommand,
            obj2gltfCommand,
            fbx2gltfCommand,
            freecadcmdCommand,
            preferObj2gltfForObj,
            preferFbx2gltfForFbx,
            annotationPreviewMode,
            convertedAssetCache,
            getAnnotations,
          ),
          block: true,
          side: 1,
        }).range(from),
      );

      pos = end + 2;
    }
  }

  return ranges;
}

// ── StateEffect ───────────────────────────────────────────────────

const updateEmbeds = StateEffect.define<void>();

// ── StateField + ViewPlugin ───────────────────────────────────────

type DecoSet = RangeSet<Decoration>;

function toDecoSet(ranges: Range<Decoration>[]): DecoSet {
  if (ranges.length === 0) {
    return RangeSet.empty as DecoSet;
  }
  return RangeSet.of<Decoration>(ranges, true);
}

export function registerLivePreviewExtension(
  app: App,
  getSettings: () => PluginSettings,
  convertedAssetCache: ConvertedAssetCache,
  getAnnotations?: (modelPath: string) => AnnotationPin[],
) {
  const embedField = StateField.define<DecoSet>({
    create(state): DecoSet {
      const s = getSettings();
      const ranges = findEmbeds(
        state,
        app,
        s.autoRotateDefault,
        s.enabledConverterIds,
        s.freecadCommand,
        s.obj2gltfCommand,
        s.fbx2gltfCommand,
        s.freecadcmdCommand,
        s.preferObj2gltfForObj,
        s.preferFbx2gltfForFbx,
        s.annotationPreviewMode,
        convertedAssetCache,
        getAnnotations,
      );
      return toDecoSet(ranges);
    },
    update(value, tr): DecoSet {
      if (tr.docChanged || tr.effects.some((e) => e.is(updateEmbeds))) {
        const s = getSettings();
        const ranges = findEmbeds(
          tr.state,
          app,
          s.autoRotateDefault,
          s.enabledConverterIds,
          s.freecadCommand,
          s.obj2gltfCommand,
          s.fbx2gltfCommand,
          s.freecadcmdCommand,
          s.preferObj2gltfForObj,
          s.preferFbx2gltfForFbx,
          s.annotationPreviewMode,
          convertedAssetCache,
          getAnnotations,
        );
        return toDecoSet(ranges);
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
