import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AI3DModelWorkbench from "./main";
import { DEFAULT_SETTINGS } from "./domain/constants";
import {
  describeConverterCommandSource,
  inspectAllConverterCommands,
  type ConverterCommandStatus,
} from "./io/conversion/command-discovery";
import { t, setLocale, type Locale } from "./i18n";

export class AI3DSettingTab extends PluginSettingTab {
  private plugin: AI3DModelWorkbench;
  private diagnosticsRunId = 0;

  constructor(app: App, plugin: AI3DModelWorkbench) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    setLocale(this.plugin.getSettings().locale);
    let refreshCommandDiagnostics: (() => Promise<void>) | undefined;

    containerEl.createEl("h2", { text: t("settings.title") });

    // ── Language ─────────────────────────────────────────────────

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("en", "English")
          .addOption("zh-CN", "简体中文")
          .setValue(this.plugin.getSettings().locale)
          .onChange(async (val: string) => {
            this.plugin.updateSettings({ locale: val as Locale });
            this.display();
          }),
      );

    // ── Folders ──────────────────────────────────────────────────

    containerEl.createEl("h3", { text: t("settings.folders") });

    new Setting(containerEl)
      .setName(t("settings.sourceModelFolder"))
      .setDesc(t("settings.sourceModelFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.sourceModelFolder)
          .setValue(this.plugin.getSettings().sourceModelFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ sourceModelFolder: val });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.reportFolder"))
      .setDesc(t("settings.reportFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.reportFolder)
          .setValue(this.plugin.getSettings().reportFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ reportFolder: val });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.snapshotFolder"))
      .setDesc(t("settings.snapshotFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.snapshotFolder)
          .setValue(this.plugin.getSettings().snapshotFolder)
          .onChange(async (val) => {
            this.plugin.updateSettings({ snapshotFolder: val });
          }),
      );

    // ── Behavior ─────────────────────────────────────────────────

    containerEl.createEl("h3", { text: t("settings.behavior") });

    new Setting(containerEl)
      .setName(t("settings.autoGenerateKnowledgeNotes"))
      .setDesc(t("settings.autoGenerateKnowledgeNotes.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().autoGenerateKnowledgeNotes)
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoGenerateKnowledgeNotes: val });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.autoRotateDefault"))
      .setDesc(t("settings.autoRotateDefault.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().autoRotateDefault)
          .onChange(async (val) => {
            this.plugin.updateSettings({ autoRotateDefault: val });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.snapshotNaming"))
      .setDesc(t("settings.snapshotNaming.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("model-name", t("settings.snapshotNaming.modelName"))
          .addOption("timestamp", t("settings.snapshotNaming.timestamp"))
          .setValue(this.plugin.getSettings().snapshotNaming)
          .onChange(async (val: string) => {
            this.plugin.updateSettings({ snapshotNaming: val as "timestamp" | "model-name" });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.logLevel"))
      .setDesc(t("settings.logLevel.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("debug", "Debug")
          .addOption("info", "Info")
          .addOption("warn", "Warn")
          .addOption("error", "Error")
          .setValue(this.plugin.getSettings().logLevel)
          .onChange(async (val: string) => {
            this.plugin.updateSettings({ logLevel: val as "debug" | "info" | "warn" | "error" });
          }),
      );

    // ── Converters ───────────────────────────────────────────────

    containerEl.createEl("h3", { text: t("settings.converters") });

    new Setting(containerEl)
      .setName(t("settings.enableCad"))
      .setDesc(t("settings.enableCad.desc"))
      .addToggle((toggle) => {
        const enabled = this.plugin.getSettings().enabledConverterIds.includes("freecad");
        return toggle.setValue(enabled).onChange(async (val) => {
          const current = this.plugin.getSettings().enabledConverterIds;
          const next = val
            ? Array.from(new Set([...current, "freecad"]))
            : current.filter((id) => id !== "freecad");
          this.plugin.updateSettings({ enabledConverterIds: next });
        });
      });

    new Setting(containerEl)
      .setName(t("settings.enableObj2gltf"))
      .setDesc(t("settings.enableObj2gltf.desc"))
      .addToggle((toggle) => {
        const enabled = this.plugin.getSettings().enabledConverterIds.includes("obj2gltf");
        return toggle.setValue(enabled).onChange(async (val) => {
          const current = this.plugin.getSettings().enabledConverterIds;
          const next = val
            ? Array.from(new Set([...current, "obj2gltf"]))
            : current.filter((id) => id !== "obj2gltf");
          this.plugin.updateSettings({ enabledConverterIds: next });
        });
      });

    new Setting(containerEl)
      .setName(t("settings.preferObj2gltf"))
      .setDesc(t("settings.preferObj2gltf.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().preferObj2gltfForObj)
          .onChange(async (val) => {
            this.plugin.updateSettings({ preferObj2gltfForObj: val });
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.enableFbx2gltf"))
      .setDesc(t("settings.enableFbx2gltf.desc"))
      .addToggle((toggle) => {
        const enabled = this.plugin.getSettings().enabledConverterIds.includes("fbx2gltf");
        return toggle.setValue(enabled).onChange(async (val) => {
          const current = this.plugin.getSettings().enabledConverterIds;
          const next = val
            ? Array.from(new Set([...current, "fbx2gltf"]))
            : current.filter((id) => id !== "fbx2gltf");
          this.plugin.updateSettings({ enabledConverterIds: next });
        });
      });

    new Setting(containerEl)
      .setName(t("settings.enableMesh"))
      .setDesc(t("settings.enableMesh.desc"))
      .addToggle((toggle) => {
        const enabled = this.plugin.getSettings().enabledConverterIds.includes("assimp");
        return toggle.setValue(enabled).onChange(async (val) => {
          const current = this.plugin.getSettings().enabledConverterIds;
          const next = val
            ? Array.from(new Set([...current, "assimp"]))
            : current.filter((id) => id !== "assimp");
          this.plugin.updateSettings({ enabledConverterIds: next });
        });
      });

    new Setting(containerEl)
      .setName(t("settings.enableSldprt"))
      .setDesc(t("settings.enableSldprt.desc"))
      .addToggle((toggle) => {
        const enabled = this.plugin.getSettings().enabledConverterIds.includes("sldprt");
        return toggle.setValue(enabled).onChange(async (val) => {
          const current = this.plugin.getSettings().enabledConverterIds;
          const next = val
            ? Array.from(new Set([...current, "sldprt"]))
            : current.filter((id) => id !== "sldprt");
          this.plugin.updateSettings({ enabledConverterIds: next });
        });
      });

    // ── Converter Paths ──────────────────────────────────────────

    containerEl.createEl("h3", { text: t("settings.paths") });

    new Setting(containerEl)
      .setName(t("settings.pythonCmd"))
      .setDesc(t("settings.pythonCmd.desc"))
      .addText((text) =>
        text
          .setPlaceholder("py")
          .setValue(this.plugin.getSettings().freecadCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ freecadCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.freecadCmd"))
      .setDesc(t("settings.freecadCmd.desc"))
      .addText((text) =>
        text
          .setPlaceholder("FreeCADCmd.exe")
          .setValue(this.plugin.getSettings().freecadcmdCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ freecadcmdCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.obj2gltfCmd"))
      .setDesc(t("settings.obj2gltfCmd.desc"))
      .addText((text) =>
        text
          .setPlaceholder("obj2gltf.cmd")
          .setValue(this.plugin.getSettings().obj2gltfCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ obj2gltfCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.fbx2gltfCmd"))
      .setDesc(t("settings.fbx2gltfCmd.desc"))
      .addText((text) =>
        text
          .setPlaceholder("FBX2glTF.exe")
          .setValue(this.plugin.getSettings().fbx2gltfCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ fbx2gltfCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.assimpCmd"))
      .setDesc(t("settings.assimpCmd.desc"))
      .addText((text) =>
        text
          .setPlaceholder("py")
          .setValue(this.plugin.getSettings().assimpCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ assimpCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    // ── Diagnostics ──────────────────────────────────────────────

    const diagnosticsSetting = new Setting(containerEl)
      .setName(t("settings.diagnostics"))
      .setDesc(t("settings.diagnostics.desc"));

    diagnosticsSetting.addButton((button) =>
      button
        .setButtonText(t("settings.diagnostics.checkNow"))
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText(t("settings.diagnostics.checking"));
          await refreshCommandDiagnostics?.();
          button.setButtonText(t("settings.diagnostics.checkNow"));
          button.setDisabled(false);
          new Notice(t("settings.diagnostics.refreshed"));
        }),
    );

    const diagnosticsEl = containerEl.createDiv();
    diagnosticsEl.style.marginTop = "0.5rem";
    refreshCommandDiagnostics = () => this.renderCommandDiagnostics(diagnosticsEl);
    void refreshCommandDiagnostics();

    // ── Performance ──────────────────────────────────────────────

    containerEl.createEl("h3", { text: t("settings.performance") });

    new Setting(containerEl)
      .setName(t("settings.canvasHeight"))
      .setDesc(t("settings.canvasHeight.desc"))
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
      .setName(t("settings.autoRotateSpeed"))
      .setDesc(t("settings.autoRotateSpeed.desc"))
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
      .setName(t("settings.renderQuality"))
      .setDesc(t("settings.renderQuality.desc"))
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
      .setName(t("settings.renderScale"))
      .setDesc(t("settings.renderScale.desc"))
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

  private async renderCommandDiagnostics(containerEl: HTMLElement): Promise<void> {
    const runId = ++this.diagnosticsRunId;
    containerEl.empty();
    containerEl.createEl("p", { text: t("settings.diagnostics.checkingAvailability") });

    const statuses = await inspectAllConverterCommands(this.plugin.getSettings());
    if (runId !== this.diagnosticsRunId) {
      return;
    }

    containerEl.empty();
    for (const status of statuses) {
      this.renderCommandStatus(containerEl, status);
    }
  }

  private renderCommandStatus(containerEl: HTMLElement, status: ConverterCommandStatus): void {
    const block = containerEl.createDiv();
    block.style.marginBottom = "0.9rem";

    block.createEl("strong", {
      text: `${status.label}: ${status.available ? "available" : "not found"}`,
    });

    const lines = [
      `Source: ${describeConverterCommandSource(status.source)}`,
      `Command: ${status.command}`,
      status.resolvedPath && status.resolvedPath !== status.command ? `Resolved path: ${status.resolvedPath}` : "",
      status.detail,
    ].filter(Boolean);

    for (const line of lines) {
      block.createEl("div", { text: line });
    }
  }
}
