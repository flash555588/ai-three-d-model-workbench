import { FileView, type TFile, type WorkspaceLeaf } from "obsidian";
import { BabylonModelPreview } from "../render/babylon/scene";
import { createHelperButtons } from "./inline/helper-buttons";

export const DIRECT_VIEW_TYPE = "ai3d-direct-view";

export class DirectModelView extends FileView {
  private preview: BabylonModelPreview | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
    );

    try {
      this.preview = new BabylonModelPreview(canvas);
      const data = await this.app.vault.readBinary(file);
      const ext = file.extension.toLowerCase();
      const readFile = async (p: string) => {
        const f = this.app.vault.getAbstractFileByPath(p);
        if (!f) throw new Error(`File not found: ${p}`);
        return this.app.vault.readBinary(f as any);
      };
      await this.preview.loadModel(data, ext, readFile, file.path);
    } catch (err) {
      this.preview?.destroy();
      this.preview = null;
      console.error("[AI3D] Direct view failed:", err);
      host.createDiv({ cls: "ai3d-inline-empty", text: `Failed to load: ${String(err)}` });
    }
  }
}
