import { FuzzySuggestModal, type App, type TFile } from "obsidian";
import { isSupportedModelExtension } from "../io/formats/registry";
import { t } from "../i18n";

export class ModelFileSuggestModal extends FuzzySuggestModal<TFile> {
  private onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder(t("modal.selectModel"));
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((f) => {
      const ext = f.extension.toLowerCase();
      return isSupportedModelExtension(ext);
    });
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
