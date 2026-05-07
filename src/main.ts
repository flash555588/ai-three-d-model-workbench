import { Plugin, type TFile, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "./domain/models";
import { DEFAULT_SETTINGS, SUPPORTED_MODEL_EXTENSIONS } from "./domain/constants";
import { createPluginStore, type PluginStore } from "./store/plugin-store";
import { AnalysisView, VIEW_TYPE } from "./view/analysis-view";
import { DirectModelView, DIRECT_VIEW_TYPE } from "./view/direct-view";
import { ModelFileSuggestModal } from "./view/model-file-suggest-modal";
import { AI3DSettingTab } from "./settings";

export default class AI3DModelWorkbench extends Plugin {
  private ps!: PluginStore;

  getSettings(): PluginSettings {
    return this.ps.store.getState().settings;
  }

  async updateSettings(partial: Partial<PluginSettings>) {
    const current = this.ps.store.getState().settings;
    this.ps.store.setState({ settings: { ...current, ...partial } });
  }

  async onload() {
    this.ps = createPluginStore(this);
    await this.ps.load();

    this.registerView(VIEW_TYPE, (leaf) => new AnalysisView(leaf, this.ps));

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

    this.addSettingTab(new AI3DSettingTab(this.app, this));

    // Register direct file view for .glb/.gltf/.stl
    this.registerView(DIRECT_VIEW_TYPE, (leaf) => new DirectModelView(leaf));
    this.registerExtensions([...SUPPORTED_MODEL_EXTENSIONS], DIRECT_VIEW_TYPE);

    // Register ```3d and ```3dgrid code block processors
    const { registerCodeBlockProcessor, registerGridCodeBlockProcessor } = await import("./view/inline/code-block");
    const cb = registerCodeBlockProcessor(this.app);
    this.registerMarkdownCodeBlockProcessor(cb.id, cb.handler);
    const gridCb = registerGridCodeBlockProcessor(this.app);
    this.registerMarkdownCodeBlockProcessor(gridCb.id, gridCb.handler);

    // Register Live Preview extension for ![[model.glb]] embeds
    const { registerLivePreviewExtension } = await import("./view/inline/live-preview");
    const exts = registerLivePreviewExtension(this.app);
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
      if (!SUPPORTED_MODEL_EXTENSIONS.has(ext)) {
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
    const state = this.ps.store.getState();
    if (!state.currentModelPath) return;

    // The note generation is handled in app.ts's generateKnowledgeNote
    // This command just triggers the same flow via a store flag
    // For Phase 0, we call the app-level function directly
    const { mountWorkbench } = await import("./view/workbench/app");
    // Note: actual generation is wired through the UI button in app.ts
    // This command exists as a programmatic entry point
    const profile = state.modelAssetProfiles[state.currentModelPath];
    const preview = state.modelPreview;
    const fileName = state.currentModelPath.split("/").pop() ?? "model";
    const baseName = fileName.replace(/\.[^.]+$/, "");
    const reportFolder = state.settings.reportFolder;
    const notePath = `${reportFolder}/${baseName} Report.md`;

    const folder = this.app.vault.getAbstractFileByPath(reportFolder);
    if (!folder) {
      await this.app.vault.createFolder(reportFolder).catch(() => {});
    }

    const frontmatter = [
      "---",
      `source_model: "${state.currentModelPath}"`,
      `format: ${state.currentModelPath.split(".").pop()?.toLowerCase() ?? "unknown"}`,
      `status: ready`,
      `updated_at: ${new Date().toISOString()}`,
      ...(profile?.tags.length ? [`knowledge_tags:`, ...profile.tags.map((t: string) => `  - ${t}`)] : []),
      "---",
    ].join("\n");

    const body = [
      frontmatter,
      "",
      `# ${baseName}`,
      "",
      "## Summary",
      "",
      ...(preview
        ? [
            "| Metric | Value |",
            "|--------|-------|",
            `| Meshes | ${preview.meshCount} |`,
            `| ${preview.splatCount ? "Splats" : "Triangles"} | ${(preview.splatCount ?? preview.triangleCount).toLocaleString()} |`,
            `| Vertices | ${preview.vertexCount.toLocaleString()} |`,
            `| Materials | ${preview.materialCount} |`,
            "",
          ]
        : ["(No preview data available)", ""]),
      "## Key Parts",
      "",
      "(Parts will be populated after analysis)",
      "",
      "## Review Notes",
      "",
      profile?.notes ?? "",
      "",
    ].join("\n");

    await this.app.vault.create(notePath, body);
  }
}
