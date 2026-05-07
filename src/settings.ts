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
      .setName("Auto-generate knowledge notes")
      .setDesc("Automatically create a knowledge note when saving a model profile.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().autoGenerateKnowledgeNotes)
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoGenerateKnowledgeNotes: val });
          }),
      );
  }
}
