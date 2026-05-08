import { FileView, TFile, type WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "../domain/models";
import { BabylonModelPreview } from "../render/babylon/scene";
import { createHelperButtons } from "./inline/helper-buttons";
import { createConversionManager } from "../io/conversion/factory";
import type { ConvertedAssetCache } from "../io/cache/converted-asset-cache";
import { prepareModelInput } from "../io/model-pipeline";
import { toPreviewSource } from "../io/preview/preview-source";
import { readBinaryPath, resolveVaultAbsolutePath } from "../utils/resolve-path";
import { listPreferredConversionExts } from "../io/formats/route-preferences";

export const DIRECT_VIEW_TYPE = "ai3d-direct-view";

export class DirectModelView extends FileView {
  private preview: BabylonModelPreview | null = null;
  private getSettings: () => PluginSettings;
  private convertedAssetCache: ConvertedAssetCache;

  constructor(leaf: WorkspaceLeaf, getSettings: () => PluginSettings, convertedAssetCache: ConvertedAssetCache) {
    super(leaf);
    this.getSettings = getSettings;
    this.convertedAssetCache = convertedAssetCache;
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
    this.preview?.destroy();
    this.preview = null;
  }

  private async loadModel(file: TFile): Promise<void> {
    this.preview?.destroy();
    this.preview = null;

    const host = this.contentEl.createDiv({ cls: "ai3d-preview-host" });
    host.style.height = "100%";
    host.style.minHeight = "300px";

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    createHelperButtons(
      host,
      this.app,
      () => this.preview,
      () => file.path,
      () => {
        // Remove just closes the tab
        this.leaf.detach();
      },
      this.getSettings,
    );

    try {
      const settings = this.getSettings();
      const conversionManager = createConversionManager(settings);
      const absolutePath = resolveVaultAbsolutePath(this.app, file.path) ?? undefined;
      const prepared = await prepareModelInput({
        path: file.path,
        absolutePath,
        preferConversionExts: listPreferredConversionExts(settings),
        conversionManager,
        convertedAssetCache: this.convertedAssetCache,
      });
      const source = toPreviewSource(prepared);

      this.preview = new BabylonModelPreview(canvas);
      const data = await readBinaryPath(this.app, source.path);
      console.log(`[AI3D] DirectView loading: ${file.path} via ${source.path} (${source.ext}, ${data.byteLength} bytes)`);
      const readFile = async (p: string) => readBinaryPath(this.app, p);
      await this.preview.loadModel(data, source.ext, readFile, source.path);
      console.log(`[AI3D] DirectView loaded successfully: ${file.path}`);
    } catch (err) {
      this.preview?.destroy();
      this.preview = null;
      console.error("[AI3D] Direct view failed:", err);
      host.createDiv({ cls: "ai3d-inline-empty", text: `Failed to load: ${String(err)}` });
    }
  }
}
