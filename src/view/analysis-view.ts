import { FileView, type WorkspaceLeaf } from "obsidian";
import type { PluginStore } from "../store/plugin-store";
import { mountWorkbench } from "./workbench/app";

export const VIEW_TYPE = "ai-3d-workbench";

export class AnalysisView extends FileView {
  private store: PluginStore;
  private unmount: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, store: PluginStore) {
    super(leaf);
    this.store = store;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "AI 3D Workbench";
  }

  getIcon(): string {
    return "box";
  }

  async onOpen(): Promise<void> {
    this.unmount = mountWorkbench(this.contentEl, this.app, this.store);
  }

  async onClose(): Promise<void> {
    this.unmount?.();
    this.unmount = null;
  }
}
