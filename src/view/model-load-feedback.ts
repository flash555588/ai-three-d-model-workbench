import type { ModelLoadFailureDetails } from "../io/conversion/errors";

export function renderModelLoadFailure(host: HTMLElement, failure: ModelLoadFailureDetails): HTMLDivElement {
  const shell = host.createDiv({ cls: "ai3d-inline-empty ai3d-load-feedback-shell" });
  const block = shell.createDiv({ cls: `ai3d-load-feedback is-${failure.level}` });
  block.createDiv({ cls: "ai3d-load-feedback-title", text: failure.title });
  block.createDiv({ cls: "ai3d-load-feedback-message", text: failure.message });
  block.createDiv({ cls: "ai3d-load-feedback-hint", text: failure.hint });
  return shell;
}