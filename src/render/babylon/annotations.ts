import type { Scene } from "@babylonjs/core/scene.js";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import type { Engine } from "@babylonjs/core/Engines/engine.js";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector.js";
import type { AnnotationPin } from "../../domain/models";

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

  constructor(
    private provider: AnnotationSceneProvider,
    private hostEl: HTMLElement,
    private mode: AnnotationMode,
    initial: AnnotationPin[],
    private onChange?: (pins: AnnotationPin[]) => void,
  ) {
    // Create overlay container
    this.overlay = document.createElement("div");
    this.overlay.className = "ai3d-annotation-overlay";
    this.overlay.style.pointerEvents = "none"; // JS backup in case CSS fails to load
    this.hostEl.appendChild(this.overlay);

    // Set initial annotations
    this.setAnnotations(initial);

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
    const overlayRect = this.overlay.getBoundingClientRect();
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

    const editor = document.createElement("div");
    editor.className = "ai3d-annotation-editor";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Label...";
    input.className = "ai3d-annotation-editor-input";
    if (existingPin) input.value = existingPin.label;

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

    const btnRow = document.createElement("div");
    btnRow.className = "ai3d-annotation-editor-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "ai3d-annotation-editor-btn ai3d-annotation-editor-confirm";
    confirmBtn.textContent = existingPin ? "Save" : "OK";
    confirmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const label = input.value.trim() || "Pin";
      if (existingPin) {
        this.updatePin(existingPin.id, { label, color: selectedColor });
      } else {
        this.addPin(worldPos, label, selectedColor);
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

    editor.appendChild(input);
    editor.appendChild(colorRow);
    editor.appendChild(btnRow);

    // Position within overlay bounds
    const rect = this.overlay.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    editor.style.left = `${Math.max(0, Math.min(x, rect.width - 200))}px`;
    editor.style.top = `${Math.max(0, Math.min(y - 10, rect.height - 120))}px`;

    this.overlay.appendChild(editor);
    this.editorEl = editor;

    // Focus input after DOM insert
    requestAnimationFrame(() => input.focus());

    // Enter key confirms
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.hideEditor();
      }
    });

    // Stop click propagation to prevent canvas picking while editing
    editor.addEventListener("pointerdown", (e) => e.stopPropagation());
    editor.addEventListener("mousedown", (e) => e.stopPropagation());
  }

  hideEditor(): void {
    if (this.editorEl) {
      this.editorEl.remove();
      this.editorEl = null;
    }
  }

  destroy(): void {
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

    // Stop pointer events from reaching the canvas (edit mode only)
    if (this.mode === "edit") {
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
    } else {
      el.style.pointerEvents = "none";
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

    // Throttle occlusion check to every 3 frames
    this.frameCount++;
    const checkOcclusion = this.frameCount % 3 === 0;
    const camPos = checkOcclusion ? camera.position : null;

    for (const [, entry] of this.pinEls) {
      const projected = Vector3.Project(
        entry.worldPos,
        Matrix.Identity(),
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
          const pickInfo = scene.pick(projected.x, projected.y);
          // Relative epsilon: 1% of pin distance, min 0.01
          const eps = Math.max(pinDist * 0.01, 0.01);
          const occluded = pickInfo.hit && pickInfo.distance < pinDist - eps;

          if (this.cameraIdle && occluded) {
            // Camera idle + occluded → completely hide
            this.hidePin(entry.el);
          } else {
            this.showPin(entry.el);
            entry.el.classList.toggle("ai3d-pin-occluded", occluded);
          }
        } else if (!checkOcclusion) {
          // Non-occlusion frame: do nothing, keep current state
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
