import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AI3DModelWorkbench from "./main";
import { DEFAULT_SETTINGS } from "./domain/constants";
import {
  describeConverterCommandSource,
  inspectAllConverterCommands,
  type ConverterCommandStatus,
} from "./io/conversion/command-discovery";

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
    let refreshCommandDiagnostics: (() => Promise<void>) | undefined;

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

    new Setting(containerEl)
      .setName("Log level")
      .setDesc("Controls plugin runtime log verbosity in the developer console.")
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

    new Setting(containerEl)
      .setName("Enable CAD converter (STEP/IGES/BREP)")
      .setDesc("Enable CAD conversion route for STEP/IGES/BREP formats via Python CadQuery (OpenCASCADE). Requires: pip install cadquery trimesh")
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
      .setName("Enable obj2gltf converter (experimental)")
      .setDesc("Keep OBJ direct loading as default. Enable this only if you want an optional local normalization route through obj2gltf.")
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
      .setName("Prefer obj2gltf for OBJ")
      .setDesc("Recommended default is off. Turn this on only when you want normalized GLB outputs or direct OBJ loading is not good enough.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.getSettings().preferObj2gltfForObj)
          .onChange(async (val) => {
            this.plugin.updateSettings({ preferObj2gltfForObj: val });
          }),
      );

    new Setting(containerEl)
      .setName("Enable FBX2glTF converter")
      .setDesc("Enable conversion route for FBX files via FBX2glTF. Requires the FBX2glTF binary installed locally.")
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
      .setName("Enable mesh converter (3MF/DAE)")
      .setDesc("Enable conversion route for 3MF and DAE (Collada) formats via Python trimesh. Requires Python with trimesh installed (pip install trimesh numpy networkx pycollada).")
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
      .setName("Enable SLDPRT converter (SolidWorks)")
      .setDesc("Enable conversion route for SolidWorks .sldprt files via FreeCAD. Requires FreeCAD installed (https://www.freecad.org/downloads.php).")
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

    new Setting(containerEl)
      .setName("Python command path (for CAD)")
      .setDesc("Optional path to Python executable for CAD conversion. Overrides auto-discovery and AI3D_FREECAD_CMD when set.")
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
      .setName("FreeCADCmd path (for SLDPRT)")
      .setDesc("Optional path to FreeCADCmd.exe for SolidWorks file conversion. Overrides auto-discovery and AI3D_FREECMDCMD when set.")
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
      .setName("obj2gltf command path")
      .setDesc("Optional path to obj2gltf CLI. Overrides auto-discovery and AI3D_OBJ2GLTF_CMD when set.")
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
      .setName("FBX2glTF command path")
      .setDesc("Optional path to FBX2glTF CLI. Overrides auto-discovery and AI3D_FBX2GLTF_CMD when set.")
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
      .setName("Python command path (for 3MF/DAE)")
      .setDesc("Optional path to Python executable. Overrides auto-discovery and AI3D_ASSIMP_CMD when set.")
      .addText((text) =>
        text
          .setPlaceholder("py")
          .setValue(this.plugin.getSettings().assimpCommand)
          .onChange(async (val) => {
            this.plugin.updateSettings({ assimpCommand: val.trim() });
            void refreshCommandDiagnostics?.();
          }),
      );

    const diagnosticsSetting = new Setting(containerEl)
      .setName("Converter command diagnostics")
      .setDesc("Shows the exact executable path the plugin would use right now. This is the same discovery chain used by runtime conversion and cache identity.");

    diagnosticsSetting.addButton((button) =>
      button
        .setButtonText("Check now")
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("Checking...");
          await refreshCommandDiagnostics?.();
          button.setButtonText("Check now");
          button.setDisabled(false);
          new Notice("AI 3D converter command diagnostics refreshed.");
        }),
    );

    const diagnosticsEl = containerEl.createDiv();
    diagnosticsEl.style.marginTop = "0.5rem";
    refreshCommandDiagnostics = () => this.renderCommandDiagnostics(diagnosticsEl);
    void refreshCommandDiagnostics();

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

  private async renderCommandDiagnostics(containerEl: HTMLElement): Promise<void> {
    const runId = ++this.diagnosticsRunId;
    containerEl.empty();
    containerEl.createEl("p", { text: "Checking converter command availability..." });

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
