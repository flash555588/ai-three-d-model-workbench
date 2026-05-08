import { Notice, Plugin, type TFile, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "./domain/models";
import { createConvertedAssetCache, type ConvertedAssetCache } from "./io/cache/converted-asset-cache";
import { listSupportedModelExtensions, isSupportedModelExtension } from "./io/formats/registry";
import { createPluginStore, type PluginStore } from "./store/plugin-store";
import { AnalysisView, VIEW_TYPE } from "./view/analysis-view";
import { DirectModelView, DIRECT_VIEW_TYPE } from "./view/direct-view";
import { ModelFileSuggestModal } from "./view/model-file-suggest-modal";
import { AI3DSettingTab } from "./settings";
import { inspectAllConverterCommands } from "./io/conversion/command-discovery";
import { setLogLevel } from "./utils/log";

export default class AI3DModelWorkbench extends Plugin {
  private ps!: PluginStore;
  private convertedAssetCache!: ConvertedAssetCache;

  getSettings(): PluginSettings {
    return this.ps.store.getState().settings;
  }

  async updateSettings(partial: Partial<PluginSettings>) {
    const current = this.ps.store.getState().settings;
    const next = { ...current, ...partial };
    this.ps.store.setState({ settings: next });
    setLogLevel(next.logLevel);
  }

  async onload() {
    this.ps = createPluginStore(this);
    await this.ps.load();
    this.convertedAssetCache = createConvertedAssetCache(
      this.ps.store.getState().convertedAssetRecords,
      (records) => this.ps.store.setState({ convertedAssetRecords: records }),
    );
    setLogLevel(this.getSettings().logLevel);

    this.registerView(VIEW_TYPE, (leaf) => new AnalysisView(leaf, this.ps, this.convertedAssetCache));

    this.addRibbonIcon("box", "Open 3D Workbench", () => this.activateView());

    this.addCommand({
      id: "import-model",
      name: "Import 3D Model",
      callback: () => this.importModel(),
    });

    this.addCommand({
      id: "open-workbench",
      name: "Open 3D Workbench",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "generate-note",
      name: "Generate Knowledge Note",
      callback: () => this.generateNote(),
    });

    this.addCommand({
      id: "clear-conversion-cache",
      name: "Clear Conversion Cache",
      callback: () => this.clearConversionCache(),
    });

    this.addCommand({
      id: "check-converter-commands",
      name: "Check Converter Commands",
      callback: () => void this.checkConverterCommands(),
    });

    this.addSettingTab(new AI3DSettingTab(this.app, this));

    // Register direct file view for all supported formats. Conversion-capable formats
    // will be routed through the shared model pipeline inside DirectModelView.
    this.registerView(DIRECT_VIEW_TYPE, (leaf) => new DirectModelView(leaf, () => this.getSettings(), this.convertedAssetCache));
    this.registerExtensions(listSupportedModelExtensions(), DIRECT_VIEW_TYPE);

    // Register ```3d and ```3dgrid code block processors
    const { registerCodeBlockProcessor, registerGridCodeBlockProcessor } = await import("./view/inline/code-block");
    const cb = registerCodeBlockProcessor(this.app, () => this.getSettings(), this.convertedAssetCache);
    this.registerMarkdownCodeBlockProcessor(cb.id, cb.handler);
    const gridCb = registerGridCodeBlockProcessor(this.app, () => this.getSettings(), this.convertedAssetCache);
    this.registerMarkdownCodeBlockProcessor(gridCb.id, gridCb.handler);

    // Register Live Preview extension for ![[model.glb]] embeds
    const { registerLivePreviewExtension } = await import("./view/inline/live-preview");
    const exts = registerLivePreviewExtension(this.app, () => this.getSettings(), this.convertedAssetCache);
    for (const e of exts) {
      this.registerEditorExtension(e);
    }
  }

  async onunload() {
    // Views are cleaned up by Obsidian calling onClose()
  }

  private async activateView() {
    const { workspace } = this.app;

    // Try to find existing leaf
    let leaf: WorkspaceLeaf | null = null;
    workspace.iterateAllLeaves((l) => {
      if (l.getViewState().type === VIEW_TYPE) {
        leaf = l;
      }
    });

    if (!leaf) {
      // Open in right split
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  private async importModel() {
    new ModelFileSuggestModal(this.app, async (file: TFile) => {
      const ext = file.extension.toLowerCase();
      if (!isSupportedModelExtension(ext)) {
        return;
      }

      // Update store with new model path and reset preview
      this.ps.store.setState({
        currentModelPath: file.path,
        modelPreview: null,
      });

      // Open workbench if not already open
      await this.activateView();
    }).open();
  }

  private async generateNote() {
    const { generateKnowledgeNote } = await import("./view/workbench/app");
    await generateKnowledgeNote(this.app, this.ps.store.getState());
  }

  private clearConversionCache() {
    this.convertedAssetCache.clear();
    new Notice("AI 3D conversion cache cleared.");
  }

  private async checkConverterCommands() {
    const statuses = await inspectAllConverterCommands(this.getSettings());
    const available = statuses.filter((status) => status.available).map((status) => status.label);
    const missing = statuses.filter((status) => !status.available).map((status) => status.label);

    if (missing.length === 0) {
      new Notice(`AI 3D converter diagnostics: all commands available (${available.join(", ")}).`, 8000);
      return;
    }

    new Notice(
      `AI 3D converter diagnostics: available ${available.join(", ") || "none"}; missing ${missing.join(", ")}.`,
      10000,
    );
  }
}
