/**
 * Reusable loading overlay for 3D model preview hosts.
 *
 * Shows a spinner + phase text + progress bar while a model is loading.
 * Call `setPhase()` to update the message, `setProgress(0-100)` for determinate progress,
 * and `hide()` when loading completes (fades out and removes from DOM).
 */

export interface LoadingOverlay {
  /** Update the phase description (e.g. "Converting CAD...", "Loading model..."). */
  setPhase(text: string): void;
  /** Set determinate progress (0–100). Pass -1 for indeterminate mode. */
  setProgress(percent: number): void;
  /** Fade out and remove the overlay from DOM. Safe to call multiple times. */
  hide(): void;
  /** Returns the root element (for positioning checks). */
  readonly el: HTMLDivElement;
}

export function createLoadingOverlay(host: HTMLElement): LoadingOverlay {
  const overlay = document.createElement("div");
  overlay.className = "ai3d-loading-overlay";

  const spinner = document.createElement("div");
  spinner.className = "ai3d-loading-spinner";

  const text = document.createElement("div");
  text.className = "ai3d-loading-text";
  text.textContent = "Loading...";

  const track = document.createElement("div");
  track.className = "ai3d-loading-bar-track";
  const fill = document.createElement("div");
  fill.className = "ai3d-loading-bar-fill is-indeterminate";
  track.appendChild(fill);

  overlay.appendChild(spinner);
  overlay.appendChild(text);
  overlay.appendChild(track);
  host.appendChild(overlay);

  let hidden = false;

  return {
    el: overlay,

    setPhase(t: string) {
      if (!hidden) text.textContent = t;
    },

    setProgress(pct: number) {
      if (hidden) return;
      if (pct < 0) {
        fill.className = "ai3d-loading-bar-fill is-indeterminate";
        fill.style.removeProperty("--bar-width");
      } else {
        fill.className = "ai3d-loading-bar-fill";
        fill.style.setProperty("--bar-width", `${Math.min(100, Math.max(0, pct))}%`);
      }
    },

    hide() {
      if (hidden) return;
      hidden = true;
      overlay.classList.add("is-hiding");
      setTimeout(() => overlay.remove(), 300);
    },
  };
}
