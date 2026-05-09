import type { Scene } from "@babylonjs/core/scene.js";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import type { Engine } from "@babylonjs/core/Engines/engine.js";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector.js";
import { Ray } from "@babylonjs/core/Culling/ray.core.js";
import type { AnnotationPin } from "../../domain/models";
import type { HeadingSearchResult } from "../../utils/note-reader";

const DEFAULT_COLORS = ["#4a9eff", "#ff6b6b", "#51cf66", "#ffd43b"];
let globalNextId = 1;

function generateId(): string {
  return `pin-${Date.now()}-${globalNextId++}`;
}

/** Any preview that exposes Babylon scene + camera for 3D→2D projection. */
export interface AnnotationSceneProvider {
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  readonly engine: Engine;
  readonly canvas: HTMLCanvasElement;
}

export type AnnotationMode = "edit" | "readonly";

export class AnnotationManager {
  private overlay: HTMLDivElement;
  private pinEls = new Map<string, { el: HTMLDivElement; worldPos: Vector3 }>();
  private observer: { remove: () => void } | null = null;
  private resizeObs: ResizeObserver | null = null;
  private annotations: AnnotationPin[] = [];
  private editorEl: HTMLDivElement | null = null;
  private disposeCallbacks: (() => void)[] = [];
  private frameCount = 0;
  // Camera idle detection
  private lastCamState = "";
  private idleFrames = 0;
  private cameraIdle = false;
  private static readonly IDLE_THRESHOLD = 15; // ~250ms at 60fps
  // Pre-allocated scratch objects for updateProjections hot path (avoids per-frame GC)
  private static readonly _identity = Matrix.Identity();
  private static readonly _scratchDir = Vector3.Zero();
  private static readonly _scratchRay = new Ray(Vector3.Zero(), Vector3.Zero(), 1);
  private hoverPopover: HTMLDivElement | null = null;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private _highlightHandler: ((e: Event) => void) | null = null;
  private _pulseTimeout: ReturnType<typeof setTimeout> | null = null;
  private _headingDropdown: HTMLDivElement | null = null;
  private _headingDebounce: ReturnType<typeof setTimeout> | null = null;
  private _selectedHeading: HeadingSearchResult | null = null;

  constructor(
    private provider: AnnotationSceneProvider,
    private hostEl: HTMLElement,
    private mode: AnnotationMode,
    initial: AnnotationPin[],
    private onChange?: (pins: AnnotationPin[]) => void,
    private noteReader?: (notePath: string, heading: string) => Promise<string | null>,
    private headingSearch?: (query: string) => HeadingSearchResult[],
  ) {
    // Create overlay container
    this.overlay = document.createElement("div");
    this.overlay.className = "ai3d-annotation-overlay";
    this.overlay.style.pointerEvents = "none"; // JS backup in case CSS fails to load
    this.hostEl.appendChild(this.overlay);

    // Set initial annotations
    this.setAnnotations(initial);

    // Listen for pin highlight events from note headings
    this._highlightHandler = (e: Event) => {
      const pinId = (e as CustomEvent).detail?.pinId;
      if (pinId) this.pulsePin(pinId);
    };
    document.addEventListener("ai3d-pin-highlight", this._highlightHandler);
    this.disposeCallbacks.push(() =>
      document.removeEventListener("ai3d-pin-highlight", this._highlightHandler!),
    );

    // Start projection update loop
    this.startProjectionLoop();
  }

  // ── Public API ──────────────────────────────────────────────

  setAnnotations(pins: AnnotationPin[]): void {
    // Remove old pins
    for (const [, entry] of this.pinEls) entry.el.remove();
    this.pinEls.clear();

    this.annotations = [...pins];
    for (const pin of pins) {
      this.createPinElement(pin);
    }
    this.updateProjections();
  }

  addPin(worldPos: Vector3, label: string, color?: string): AnnotationPin {
    const pin: AnnotationPin = {
      id: generateId(),
      position: [worldPos.x, worldPos.y, worldPos.z],
      label,
      color: color ?? DEFAULT_COLORS[this.annotations.length % DEFAULT_COLORS.length],
      createdAt: new Date().toISOString(),
    };
    this.annotations.push(pin);
    this.createPinElement(pin);
    this.updateProjections();
    this.onChange?.(this.annotations);
    return pin;
  }

  removePin(id: string): void {
    const entry = this.pinEls.get(id);
    if (entry) {
      entry.el.remove();
      this.pinEls.delete(id);
    }
    this.annotations = this.annotations.filter(p => p.id !== id);
    this.onChange?.(this.annotations);
  }

  updatePin(id: string, partial: Partial<AnnotationPin>): void {
    const pin = this.annotations.find(p => p.id === id);
    if (!pin) return;
    Object.assign(pin, partial);
    const entry = this.pinEls.get(id);
    if (entry) {
      if (partial.position) entry.worldPos = new Vector3(...partial.position);
      const labelEl = entry.el.querySelector(".ai3d-pin-label") as HTMLSpanElement | null;
      if (labelEl && partial.label !== undefined) labelEl.textContent = partial.label;
      const dotEl = entry.el.querySelector(".ai3d-pin-dot") as HTMLDivElement | null;
      if (dotEl && partial.color !== undefined) dotEl.style.background = partial.color;
    }
    this.updateProjections();
    this.onChange?.(this.annotations);
  }

  /** Show inline editor at screen position for creating a new pin. */
  showEditor(screenX: number, screenY: number, worldPos: Vector3): void {
    this.showEditorInternal(screenX, screenY, worldPos);
  }

  /** Show inline editor pre-filled for editing an existing pin. */
  editPin(id: string): void {
    const pin = this.annotations.find(p => p.id === id);
    if (!pin) return;
    const entry = this.pinEls.get(id);
    if (!entry) return;

    // Position editor near the pin element
    const rect = entry.el.getBoundingClientRect();
    const screenX = rect.left + rect.width / 2;
    const screenY = rect.top;

    this.showEditorInternal(screenX, screenY, entry.worldPos, pin);
  }

  /** Get the world position of a pin (for camera focus). */
  getPinPosition(id: string): Vector3 | null {
    const entry = this.pinEls.get(id);
    return entry ? entry.worldPos.clone() : null;
  }

  /** Get all annotations (read-only snapshot). */
  getAnnotations(): readonly AnnotationPin[] {
    return this.annotations;
  }

  private showEditorInternal(screenX: number, screenY: number, worldPos: Vector3, existingPin?: AnnotationPin): void {
    this.hideEditor();
    this._selectedHeading = null;

    const editor = document.createElement("div");
    editor.className = "ai3d-annotation-editor";

    // ── Input wrapper (input + binding indicator) ──
    const inputWrap = document.createElement("div");
    inputWrap.className = "ai3d-editor-input-wrap";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = this.headingSearch ? "Label or search heading..." : "Label...";
    input.className = "ai3d-annotation-editor-input";
    if (existingPin) input.value = existingPin.label;

    // Show existing binding indicator
    const bindingTag = document.createElement("span");
    bindingTag.className = "ai3d-editor-binding-tag";
    bindingTag.style.display = "none";
    const clearBindingBtn = document.createElement("button");
    clearBindingBtn.className = "ai3d-editor-binding-clear";
    clearBindingBtn.textContent = "\u00d7";
    clearBindingBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._selectedHeading = null;
      bindingTag.style.display = "none";
      contentPreview.style.display = "none";
      contentPreview.textContent = "";
      input.value = "";
      input.focus();
    });
    bindingTag.appendChild(clearBindingBtn);

    inputWrap.appendChild(input);
    inputWrap.appendChild(bindingTag);

    // ── Content preview (shows heading section content after binding) ──
    const contentPreview = document.createElement("div");
    contentPreview.className = "ai3d-editor-content-preview";
    contentPreview.style.display = "none";

    // ── Heading autocomplete dropdown ──
    const dropdown = document.createElement("div");
    dropdown.className = "ai3d-heading-dropdown";
    dropdown.style.display = "none";
    this._headingDropdown = dropdown;

    let dropdownIndex = -1;
    let lastResults: HeadingSearchResult[] = [];

    const setDropdownIndex = (idx: number) => {
      const items = dropdown.querySelectorAll<HTMLElement>(".ai3d-heading-dropdown-item");
      items.forEach(i => i.classList.remove("active"));
      dropdownIndex = idx;
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add("active");
        items[idx].scrollIntoView({ block: "nearest" });
      }
    };

    const selectResult = (result: HeadingSearchResult) => {
      this._selectedHeading = result;
      input.value = result.heading;
      // Show binding tag
      const shortPath = result.notePath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
      bindingTag.querySelector(".ai3d-editor-binding-text")?.remove();
      const textSpan = document.createElement("span");
      textSpan.className = "ai3d-editor-binding-text";
      textSpan.textContent = `\ud83d\udcc4 ${shortPath}`;
      bindingTag.appendChild(textSpan);
      bindingTag.style.display = "";
      hideDropdown();
      input.focus();
      // Load and show content preview
      this.loadContentPreview(contentPreview, result.notePath, result.heading);
    };

    const hideDropdown = () => {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
      dropdownIndex = -1;
    };

    const showResults = (results: HeadingSearchResult[]) => {
      dropdown.innerHTML = "";
      dropdownIndex = -1;
      lastResults = results;
      if (results.length === 0) {
        dropdown.style.display = "none";
        return;
      }
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const item = document.createElement("div");
        item.className = "ai3d-heading-dropdown-item";

        const headingEl = document.createElement("span");
        headingEl.className = "ai3d-heading-dropdown-heading";
        headingEl.textContent = `${"#".repeat(r.level)} ${r.heading}`;

        const noteEl = document.createElement("span");
        noteEl.className = "ai3d-heading-dropdown-note";
        noteEl.textContent = r.notePath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

        item.appendChild(headingEl);
        item.appendChild(noteEl);
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectResult(r);
        });
        item.addEventListener("mouseenter", () => setDropdownIndex(i));
        dropdown.appendChild(item);
      }
      dropdown.style.display = "";
    };

    // ── Input event: heading search ──
    input.addEventListener("input", () => {
      if (!this.headingSearch) return;
      if (this._headingDebounce) clearTimeout(this._headingDebounce);
      const query = input.value.trim();
      if (query.length < 1) {
        hideDropdown();
        return;
      }
      this._headingDebounce = setTimeout(() => {
        const results = this.headingSearch!(query);
        showResults(results);
      }, 150);
    });

    // ── Keyboard navigation in dropdown ──
    input.addEventListener("keydown", (e) => {
      if (dropdown.style.display === "none") {
        // No dropdown open — normal editor keys
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        } else if (e.key === "Escape") {
          e.preventDefault();
          this.hideEditor();
        }
        return;
      }
      const items = dropdown.querySelectorAll<HTMLElement>(".ai3d-heading-dropdown-item");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIndex(Math.min(dropdownIndex + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIndex(Math.max(dropdownIndex - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (dropdownIndex >= 0 && dropdownIndex < items.length) {
          // Select highlighted heading
          if (lastResults[dropdownIndex]) selectResult(lastResults[dropdownIndex]);
        } else {
          confirmBtn.click();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        hideDropdown();
      }
    });

    // Close dropdown on blur (after a short delay to allow mousedown on items)
    input.addEventListener("blur", () => {
      setTimeout(hideDropdown, 150);
    });

    // ── Color swatches ──
    const colorRow = document.createElement("div");
    colorRow.className = "ai3d-annotation-editor-colors";
    let selectedColor = existingPin?.color ?? DEFAULT_COLORS[0];
    for (const c of DEFAULT_COLORS) {
      const swatch = document.createElement("button");
      swatch.className = "ai3d-pin-color-swatch";
      swatch.style.background = c;
      if (c === selectedColor) swatch.classList.add("active");
      swatch.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedColor = c;
        colorRow.querySelectorAll(".ai3d-pin-color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
      });
      colorRow.appendChild(swatch);
    }

    // ── Action buttons ──
    const btnRow = document.createElement("div");
    btnRow.className = "ai3d-annotation-editor-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "ai3d-annotation-editor-btn ai3d-annotation-editor-confirm";
    confirmBtn.textContent = existingPin ? "Save" : "OK";
    confirmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const label = input.value.trim() || "Pin";
      const binding = this._selectedHeading;
      if (existingPin) {
        const partial: Partial<AnnotationPin> = { label, color: selectedColor };
        if (binding) {
          partial.notePath = binding.notePath;
          partial.headingRef = binding.heading;
          partial.headingLevel = binding.level;
        }
        this.updatePin(existingPin.id, partial);
      } else {
        const pin = this.addPin(worldPos, label, selectedColor);
        if (binding) {
          this.updatePin(pin.id, {
            notePath: binding.notePath,
            headingRef: binding.heading,
            headingLevel: binding.level,
          });
        }
      }
      this.hideEditor();
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ai3d-annotation-editor-btn ai3d-annotation-editor-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideEditor();
    });

    // Delete button (only for existing pins)
    if (existingPin) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "ai3d-annotation-editor-btn ai3d-annotation-editor-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removePin(existingPin.id);
        this.hideEditor();
      });
      btnRow.appendChild(deleteBtn);
    }

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);

    // ── Assemble editor ──
    editor.appendChild(inputWrap);
    editor.appendChild(dropdown);
    editor.appendChild(contentPreview);
    editor.appendChild(colorRow);
    editor.appendChild(btnRow);

    // Position within overlay bounds
    const rect = this.overlay.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    editor.style.left = `${Math.max(0, Math.min(x, rect.width - 220))}px`;
    editor.style.top = `${Math.max(0, Math.min(y - 10, rect.height - 160))}px`;

    this.overlay.appendChild(editor);
    this.editorEl = editor;

    // If editing existing pin with binding, show the tag and content
    if (existingPin?.notePath && existingPin?.headingRef) {
      const shortPath = existingPin.notePath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
      const textSpan = document.createElement("span");
      textSpan.className = "ai3d-editor-binding-text";
      textSpan.textContent = `\ud83d\udcc4 ${shortPath}`;
      bindingTag.appendChild(textSpan);
      bindingTag.style.display = "";
      this._selectedHeading = { notePath: existingPin.notePath, heading: existingPin.headingRef, level: existingPin.headingLevel ?? 2 };
      this.loadContentPreview(contentPreview, existingPin.notePath, existingPin.headingRef);
    }

    // Focus input after DOM insert
    requestAnimationFrame(() => input.focus());

    // Stop click propagation to prevent canvas picking while editing
    editor.addEventListener("pointerdown", (e) => e.stopPropagation());
    editor.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  hideEditor(): void {
    if (this._headingDebounce) { clearTimeout(this._headingDebounce); this._headingDebounce = null; }
    this._headingDropdown = null;
    this._selectedHeading = null;
    if (this.editorEl) {
      this.editorEl.remove();
      this.editorEl = null;
    }
  }

  private async loadContentPreview(el: HTMLDivElement, notePath: string, heading: string): Promise<void> {
    if (!this.noteReader) return;
    el.textContent = "";
    el.style.display = "none";
    const content = await this.noteReader(notePath, heading);
    if (!content) {
      el.textContent = "(empty section)";
      el.className = "ai3d-editor-content-preview ai3d-editor-content-preview--empty";
      el.style.display = "";
      return;
    }
    // Truncate long content
    const truncated = content.length > 300 ? content.slice(0, 300) + "..." : content;
    el.textContent = truncated;
    el.className = "ai3d-editor-content-preview";
    el.style.display = "";
  }

  private async showHoverPopover(pinEl: HTMLDivElement, pin: AnnotationPin): Promise<void> {
    if (!this.noteReader || !pin.notePath || !pin.headingRef) return;
    this.hideHoverPopover();

    const content = await this.noteReader(pin.notePath, pin.headingRef);
    if (!content) return;

    const popover = document.createElement("div");
    popover.className = "ai3d-pin-popover";

    const title = document.createElement("div");
    title.className = "ai3d-pin-popover-title";
    title.textContent = pin.headingRef;

    const body = document.createElement("div");
    body.className = "ai3d-pin-popover-body";
    body.textContent = content;

    popover.appendChild(title);
    popover.appendChild(body);

    // Position relative to pin
    const rect = pinEl.getBoundingClientRect();
    popover.style.left = `${rect.left + rect.width / 2}px`;
    popover.style.top = `${rect.bottom + 4}px`;

    document.body.appendChild(popover);
    this.hoverPopover = popover;
  }

  private hideHoverPopover(): void {
    if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
    if (this.hoverPopover) {
      this.hoverPopover.remove();
      this.hoverPopover = null;
    }
  }

  /** Pulse animation on a pin (triggered by note heading hover). */
  pulsePin(pinId: string): void {
    const entry = this.pinEls.get(pinId);
    if (!entry) return;
    if (this._pulseTimeout) { clearTimeout(this._pulseTimeout); this._pulseTimeout = null; }
    entry.el.classList.remove("ai3d-pin-pulse");
    // Force reflow to restart animation
    void entry.el.offsetWidth;
    entry.el.classList.add("ai3d-pin-pulse");
    this._pulseTimeout = setTimeout(() => {
      entry.el.classList.remove("ai3d-pin-pulse");
      this._pulseTimeout = null;
    }, 1200);
  }

  destroy(): void {
    this.hideHoverPopover();
    if (this._pulseTimeout) { clearTimeout(this._pulseTimeout); this._pulseTimeout = null; }
    if (this._headingDebounce) { clearTimeout(this._headingDebounce); this._headingDebounce = null; }
    this._headingDropdown = null;
    this._selectedHeading = null;
    this.observer?.remove();
    this.observer = null;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    for (const cb of this.disposeCallbacks) cb();
    this.disposeCallbacks = [];
    this.overlay.remove();
    this.pinEls.clear();
    this.editorEl?.remove();
    this.editorEl = null;
  }

  // ── Private ─────────────────────────────────────────────────

  private createPinElement(pin: AnnotationPin): void {
    const el = document.createElement("div");
    el.className = "ai3d-annotation-pin";
    el.dataset.pinId = pin.id;

    const dot = document.createElement("div");
    dot.className = "ai3d-pin-dot";
    dot.style.background = pin.color;

    const label = document.createElement("span");
    label.className = "ai3d-pin-label";
    label.textContent = pin.label;

    el.appendChild(dot);
    el.appendChild(label);

    // Readonly mode: no delete button
    if (this.mode === "edit") {
      const del = document.createElement("button");
      del.className = "ai3d-pin-delete";
      del.textContent = "\u00d7";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removePin(pin.id);
      });
      el.appendChild(del);

      // Click pin to edit (not delete button)
      el.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".ai3d-pin-delete")) return;
        e.stopPropagation();
        this.editPin(pin.id);
      });
    }

    // Enable pointer events on pin (overlay has pointer-events: none)
    el.style.pointerEvents = "auto";
    el.addEventListener("pointerdown", (e) => e.stopPropagation());

    // Hover popover for linked notes
    if (pin.notePath && pin.headingRef && this.noteReader) {
      el.addEventListener("mouseenter", () => {
        this.hoverTimeout = setTimeout(() => {
          this.showHoverPopover(el, pin);
        }, 300);
      });
      el.addEventListener("mouseleave", () => {
        if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
        this.hideHoverPopover();
      });
    }

    this.overlay.appendChild(el);
    this.pinEls.set(pin.id, { el, worldPos: new Vector3(...pin.position) });
  }

  private startProjectionLoop(): void {
    const scene = this.provider.scene;
    // Use the camera passed in the observable event (correct for multi-camera scenes)
    const obs = scene.onAfterRenderCameraObservable.add((cam) => {
      if (cam === this.provider.camera) {
        this.updateProjections();
      }
    });
    this.observer = { remove: () => scene.onAfterRenderCameraObservable.remove(obs) };

    // Also update on resize
    this.resizeObs = new ResizeObserver(() => this.updateProjections());
    if (this.provider.canvas) {
      this.resizeObs.observe(this.provider.canvas);
    }
  }

  private updateProjections(): void {
    if (this.pinEls.size === 0) return;
    const { scene, camera, engine, canvas } = this.provider;

    // Guard: scene may have been disposed between frames
    if (scene.isDisposed) return;

    const rw = engine.getRenderWidth();
    const rh = engine.getRenderHeight();
    if (rw === 0 || rh === 0) return;

    // Convert engine render coordinates → CSS pixels
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const scaleX = cw / rw;
    const scaleY = ch / rh;

    const transform = scene.getTransformMatrix();
    const viewport = camera.viewport.toGlobal(rw, rh);

    // Detect camera idle: hash alpha/beta/radius/target
    const camState = `${camera.alpha.toFixed(3)}_${camera.beta.toFixed(3)}_${camera.radius.toFixed(3)}_${camera.target.x.toFixed(2)}_${camera.target.y.toFixed(2)}_${camera.target.z.toFixed(2)}`;
    if (camState === this.lastCamState) {
      this.idleFrames++;
    } else {
      this.idleFrames = 0;
      this.cameraIdle = false;
    }
    this.lastCamState = camState;
    if (this.idleFrames >= AnnotationManager.IDLE_THRESHOLD && !this.cameraIdle) {
      this.cameraIdle = true;
    }

    // Throttle occlusion check to every 6 frames
    this.frameCount++;
    const checkOcclusion = this.frameCount % 6 === 0;
    const camPos = checkOcclusion ? camera.position : null;

    const identity = AnnotationManager._identity;
    const scratchDir = AnnotationManager._scratchDir;
    const scratchRay = AnnotationManager._scratchRay;

    for (const [, entry] of this.pinEls) {
      const projected = Vector3.Project(
        entry.worldPos,
        identity,
        transform,
        viewport,
      );

      // Z > 1 means behind camera
      if (projected.z > 1 || projected.z < 0) {
        this.hidePin(entry.el);
      } else {
        entry.el.style.left = `${projected.x * scaleX}px`;
        entry.el.style.top = `${projected.y * scaleY}px`;

        if (checkOcclusion && camPos) {
          const pinDist = Vector3.Distance(camPos, entry.worldPos);
          // Reuse scratch objects to avoid per-frame allocation
          entry.worldPos.subtractToRef(camPos, scratchDir);
          scratchDir.normalize();
          scratchRay.origin = camPos;
          scratchRay.direction = scratchDir;
          scratchRay.length = pinDist;
          const pickInfo = scene.pickWithRay(scratchRay);
          // Relative epsilon: 1% of pin distance, min 0.01
          const eps = Math.max(pinDist * 0.01, 0.01);
          const occluded = !!pickInfo?.hit && pickInfo.distance < pinDist - eps;

          if (this.cameraIdle && occluded) {
            // Camera idle + occluded → completely hide
            this.hidePin(entry.el);
          } else {
            this.showPin(entry.el);
            entry.el.classList.toggle("ai3d-pin-occluded", occluded);
          }
        } else if (!checkOcclusion) {
          // Camera moved → ensure previously hidden pins (behind geometry but now
          // potentially visible) get shown again immediately instead of waiting
          // for the next occlusion check frame.
          if (!this.cameraIdle && entry.el.classList.contains("ai3d-pin-hidden")) {
            this.showPin(entry.el);
          }
        }
      }
    }
  }

  private hidePin(el: HTMLDivElement): void {
    el.style.visibility = "hidden";
    el.style.opacity = "0";
    el.classList.remove("ai3d-pin-occluded");
    el.classList.add("ai3d-pin-hidden");
  }

  private showPin(el: HTMLDivElement): void {
    el.style.visibility = "visible";
    el.style.opacity = "";
    el.classList.remove("ai3d-pin-hidden");
  }
}
