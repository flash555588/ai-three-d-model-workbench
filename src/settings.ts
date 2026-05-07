import { App, PluginSettingTab, Setting } from "obsidian";
import type AI3DModelWorkbench from "./main";
import { DEFAULT_SETTINGS } from "./domain/constants";

export class AI3DSettingTab extends PluginSettingTab {
  private plugin: AI3DModelWorkbench;

  constructor(app: App, plugin: AI3DModelWorkbench) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI 3D Model Workbench" });

    // ── Folders ──────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Folders" });

    new Setting(containerEl)
      .setName("Source model folder")
      .setDesc("Vault folder where source 3D models are stored.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.sourceModelFolder)
          .setValue(this.plugin.getSettings().sourceModelFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ sourceModelFolder: val });
          }),
      );

    new Setting(containerEl)
      .setName("Report folder")
      .setDesc("Vault folder where generated knowledge notes are saved.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.reportFolder)
          .setValue(this.plugin.getSettings().reportFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ reportFolder: val });
          }),
      );

    new Setting(containerEl)
      .setName("Snapshot folder")
      .setDesc("Vault folder where exported snapshots are saved.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.snapshotFolder)
          .setValue(this.plugin.getSettings().snapshotFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ snapshotFolder: val });
          }),
      );

    // ── Behavior ─────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Behavior" });

    new Setting(containerEl)
      .setName("Auto-generate knowledge notes")
      .setDesc("Automatically create a knowledge note when saving a model profile.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().autoGenerateKnowledgeNotes)
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoGenerateKnowledgeNotes: val });
          }),
      );

    new Setting(containerEl)
      .setName("Auto-rotate by default")
      .setDesc("Start 3D previews with auto-rotation enabled.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().autoRotateDefault)
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoRotateDefault: val });
          }),
      );

    new Setting(containerEl)
      .setName("Snapshot naming")
      .setDesc("How exported snapshot files are named.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("model-name", "Model name + timestamp")
          .addOption("timestamp", "Timestamp only")
          .setValue(this.plugin.getSettings().snapshotNaming)
          .onChange(async (val: string) => {
            this.plugin.updateSettings({ snapshotNaming: val as "timestamp" | "model-name" });
          }),
      );

    // ── Performance ──────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Performance & Display" });

    new Setting(containerEl)
      .setName("Default canvas height")
      .setDesc("Default height (px) for inline 3D previews. Range: 200–800.")
      .addSlider((slider) =>
        slider
          .setLimits(200, 800, 25)
          .setValue(this.plugin.getSettings().defaultCanvasHeight)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.updateSettings({ defaultCanvasHeight: val });
          }),
      );

    new Setting(containerEl)
      .setName("Auto-rotate speed")
      .setDesc("Rotation speed when auto-rotate is enabled. Range: 0.1–2.0.")
      .addSlider((slider) =>
        slider
          .setLimits(0.1, 2.0, 0.1)
          .setValue(this.plugin.getSettings().autoRotateSpeed)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoRotateSpeed: val });
          }),
      );

    new Setting(containerEl)
      .setName("Render quality")
      .setDesc("Higher quality uses more GPU resources. Affects anti-aliasing and resolution.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("low", "Low")
          .addOption("medium", "Medium")
          .addOption("high", "High")
          .setValue(this.plugin.getSettings().renderQuality)
          .onChange(async (val: string) => {
            this.plugin.updateSettings({ renderQuality: val as "low" | "medium" | "high" });
          }),
      );

    new Setting(containerEl)
      .setName("Resolution scale")
      .setDesc("Render resolution multiplier. 1.0 = native, 0.5 = half, 2.0 = double (supersampling). Range: 0.25–2.0.")
      .addSlider((slider) =>
        slider
          .setLimits(0.25, 2.0, 0.25)
          .setValue(this.plugin.getSettings().renderScale)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.updateSettings({ renderScale: val });
          }),
      );
  }
}
