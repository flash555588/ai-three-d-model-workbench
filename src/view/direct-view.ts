import { FileView, TFile, type WorkspaceLeaf } from "obsidian";
import type { PluginSettings, ModelAssetProfile } from "../domain/models";
import { BabylonModelPreview } from "../render/babylon/scene";
import { AnnotationManager } from "../render/babylon/annotations";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { createHelperButtons } from "./inline/helper-buttons";
import { createConversionManager } from "../io/conversion/factory";
import type { ConvertedAssetCache } from "../io/cache/converted-asset-cache";
import type { PluginStore } from "../store/plugin-store";
import { prepareModelInput } from "../io/model-pipeline";
import { toPreviewSource } from "../io/preview/preview-source";
import { readBinaryPath, resolveVaultAbsolutePath } from "../utils/resolve-path";
import { listPreferredConversionExts } from "../io/formats/route-preferences";
import { createNoteReader, createHeadingSearch } from "../utils/note-reader";
import { createLoadingOverlay } from "./inline/loading-overlay";

export const DIRECT_VIEW_TYPE = "ai3d-direct-view";

function createDefaultProfile(): ModelAssetProfile {
  return { tags: [], notes: "", annotations: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export class DirectModelView extends FileView {
  private preview: BabylonModelPreview | null = null;
  private annotationMgr: AnnotationManager | null = null;
  private annotationMode = false;
  private loadGeneration = 0;
  private getSettings: () => PluginSettings;
  private convertedAssetCache: ConvertedAssetCache;
  private ps: PluginStore;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, getSettings: () => PluginSettings, convertedAssetCache: ConvertedAssetCache, ps: PluginStore) {
    super(leaf);
    this.getSettings = getSettings;
    this.convertedAssetCache = convertedAssetCache;
    this.ps = ps;
  }

  getViewType(): string {
    return DIRECT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.name ?? "3D Model";
  }

  getIcon(): string {
    return "box";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("ai3d-direct-view");

    if (this.file) {
      await this.loadModel(this.file);
    }
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.contentEl.empty();
    await this.loadModel(file);
  }

  async onClose(): Promise<void> {
    if (this.escHandler) {
      document.removeEventListener("keydown", this.escHandler);
      this.escHandler = null;
    }
    this.annotationMgr?.destroy();
    this.annotationMgr = null;
    this.preview?.destroy();
    this.preview = null;
  }

  private async loadModel(file: TFile): Promise<void> {
    const gen = ++this.loadGeneration;
    this.annotationMgr?.destroy();
    this.annotationMgr = null;
    this.annotationMode = false;
    this.preview?.destroy();
    this.preview = null;

    const host = this.contentEl.createDiv({ cls: "ai3d-preview-host" });

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    // Semi-transparent overlay for annotation mode
    const modeOverlay = document.createElement("div");
    modeOverlay.className = "ai3d-annot-mode-overlay";
    modeOverlay.style.display = "none";
    host.appendChild(modeOverlay);

    const self = this;

    function setAnnotationMode(active: boolean) {
      self.annotationMode = active;
      self.annotationMgr?.hideEditor();
      modeOverlay.style.display = active ? "" : "none";
      console.debug("[AI3D] DirectView annotation mode:", active);
    }

    // ESC key to exit annotation mode
    if (this.escHandler) document.removeEventListener("keydown", this.escHandler);
    this.escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && self.annotationMode) {
        setAnnotationMode(false);
      }
    };
    document.addEventListener("keydown", this.escHandler);

    const toolbar = createHelperButtons(
      host,
      this.app,
      () => this.preview,
      () => file.path,
      () => {
        this.leaf.detach();
      },
      this.getSettings,
      // annotation toggle callback
      () => {
        setAnnotationMode(!self.annotationMode);
        return self.annotationMode;
      },
    );

    const loading = createLoadingOverlay(host);

    try {
      const settings = this.getSettings();
      const conversionManager = createConversionManager(settings);
      const absolutePath = resolveVaultAbsolutePath(this.app, file.path) ?? undefined;
      loading.setPhase("Preparing model...");
      const prepared = await prepareModelInput({
        path: file.path,
        absolutePath,
        preferConversionExts: listPreferredConversionExts(settings),
        conversionManager,
        convertedAssetCache: this.convertedAssetCache,
      });
      if (gen !== this.loadGeneration) return;
      const source = toPreviewSource(prepared);

      this.preview = new BabylonModelPreview(canvas);
      loading.setPhase("Loading model...");
      const data = await readBinaryPath(this.app, source.path);
      if (gen !== this.loadGeneration) { this.preview.destroy(); this.preview = null; return; }
      console.log(`[AI3D] DirectView loading: ${file.path} via ${source.path} (${source.ext}, ${data.byteLength} bytes)`);
      const readFile = async (p: string) => readBinaryPath(this.app, p);
      await this.preview.loadModel(data, source.ext, readFile, source.path);
      if (gen !== this.loadGeneration) { this.preview.destroy(); this.preview = null; return; }
      console.log(`[AI3D] DirectView loaded successfully: ${file.path}`);
      loading.setProgress(100);

      // Set up annotation manager (edit mode)
      const canvasEl = this.preview.getCanvas();
      if (canvasEl) {
        const profile = this.ps.store.getState().modelAssetProfiles[file.path];
        const initialPins = profile?.annotations ?? [];
        const noteReader = createNoteReader(this.app);
        const headingSearch = createHeadingSearch(this.app);
        this.annotationMgr = new AnnotationManager(
          { scene: this.preview.getScene(), camera: this.preview.getCamera(), engine: this.preview.getEngine(), canvas: canvasEl },
          host,
          "edit",
          initialPins,
          (pins) => {
            const current = self.ps.store.getState().modelAssetProfiles;
            const existing = current[file.path] ?? createDefaultProfile();
            self.ps.store.setState({
              modelAssetProfiles: { ...current, [file.path]: { ...existing, annotations: pins, updatedAt: new Date().toISOString() } },
            });
            // Update badge count
            toolbar.updateAnnotationBadge(pins.length);
          },
          noteReader,
          headingSearch,
        );

        // Show annotate button with badge
        toolbar.showAnnotateButton();
        toolbar.updateAnnotationBadge(initialPins.length);

        // Wire pick callback
        this.preview.onPick((result) => {
          if (!self.annotationMode || !self.annotationMgr) return;
          const screenX = result.screenX;
          const screenY = result.screenY;

          let worldPos: Vector3 | null = null;
          if (result.pickedPoint) {
            worldPos = result.pickedPoint;
          } else if (result.mesh) {
            const bbox = result.mesh.getBoundingInfo().boundingBox;
            worldPos = bbox.centerWorld.clone();
            console.debug("[AI3D] Annotation: pickedPoint null, using bbox center fallback");
          }
          if (!worldPos) return;

          console.debug("[AI3D] Annotation: creating pin at", worldPos.toString(), "screen:", screenX, screenY);
          self.annotationMgr!.showEditor(screenX, screenY, worldPos);
        });
      }

      loading.hide();
    } catch (err) {
      if (gen !== this.loadGeneration) return;
      loading.hide();
      this.preview?.destroy();
      this.preview = null;
      console.error("[AI3D] Direct view failed:", err);
      host.createDiv({ cls: "ai3d-inline-empty", text: `Failed to load: ${String(err)}` });
    }
  }
}
