import type { App } from "obsidian";
import { MarkdownView, TFile } from "obsidian";
import type { PluginStore } from "../../store/plugin-store";
import type { PluginState, ModelAssetProfile } from "../../domain/models";
import { normalizeTagList } from "../../utils/format";
import { BabylonModelPreview } from "../../render/babylon/scene";
import { AnnotationManager } from "../../render/babylon/annotations";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Animation } from "@babylonjs/core/Animations/animation.js";
import { EasingFunction, CubicEase } from "@babylonjs/core/Animations/easing.js";
import { html } from "./h";
import { prepareModelInput } from "../../io/model-pipeline";
import { createConversionManager } from "../../io/conversion/factory";
import type { ConvertedAssetCache } from "../../io/cache/converted-asset-cache";
import { toPreviewSource } from "../../io/preview/preview-source";
import { createLogger } from "../../utils/log";
import { readBinaryPath, resolveVaultAbsolutePath } from "../../utils/resolve-path";
import { listPreferredConversionExts } from "../../io/formats/route-preferences";
import { createNoteReader, createHeadingSearch } from "../../utils/note-reader";
import { describeModelLoadFailure, type ModelLoadFailureDetails, isMissingConverterError } from "../../io/conversion/errors";
import { renderModelLoadFailure } from "../model-load-feedback";

const log = createLogger("workbench");

export function mountWorkbench(
  container: HTMLElement,
  app: App,
  ps: PluginStore,
  convertedAssetCache: ConvertedAssetCache,
): () => void {
  container.classList.add("ai3d-workbench");

  let preview: BabylonModelPreview | null = null;
  let annotationMgr: AnnotationManager | null = null;
  let annotationMode = false;
  let loading = false;
  const initialState = ps.store.getState();
  let queuedModelPath: string | null | undefined = initialState.currentModelPath;
  let lastObservedModelPath = initialState.currentModelPath;
  let lastObservedPreview = initialState.modelPreview;

  // Focus camera on a pin's world position
  function focusPin(pinId: string): void {
    if (!annotationMgr || !preview) return;
    const pos = annotationMgr.getPinPosition(pinId);
    if (!pos) return;
    const cam = preview.getCamera();
    const anim = new Animation("focusPin", "target", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([
      { frame: 0, value: cam.target.clone() },
      { frame: 20, value: pos },
    ]);
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    anim.setEasingFunction(ease);
    cam.animations = [anim];
    preview.getScene().beginAnimation(cam, 0, 20, false);
  }

  // ESC key to exit annotation mode
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape" && annotationMode) {
      setAnnotationMode(false);
    }
  };
  activeDocument.addEventListener("keydown", handleEsc);

  // ── Stable preview host (never removed from DOM) ──
  // Create on container (in DOM) to inherit Obsidian CSS variables
  const previewHost = container.createDiv({ cls: "ai3d-preview-host" });
  const emptyState = html`
    <div class="ai3d-empty-state">
      <div class="ai3d-empty-icon">3D</div>
      <div class="ai3d-empty-title">No model</div>
      <div class="ai3d-empty-text">Use the "Import 3D model" command to load a GLB, GLTF, or STL file.</div>
    </div>
  ` as HTMLElement;
  previewHost.appendChild(emptyState);

  // Semi-transparent overlay for annotation mode
  const modeOverlay = previewHost.createDiv({ cls: "ai3d-annot-mode-overlay is-hidden" });

  function clearInlineMessages(): void {
    previewHost.querySelectorAll(".ai3d-inline-empty:not(.ai3d-empty-state)").forEach((el) => el.remove());
  }

  function destroyActivePreview(): void {
    annotationMgr?.hideEditor();
    annotationMgr?.destroy();
    annotationMgr = null;
    annotationMode = false;
    modeOverlay.classList.add("is-hidden");
    preview?.destroy();
    preview = null;
    previewHost.querySelectorAll(".ai3d-canvas-full").forEach((el) => el.remove());
    clearInlineMessages();
  }

  function showEmptyPreview(message?: string | ModelLoadFailureDetails): void {
    destroyActivePreview();
    emptyState.classList.remove("is-hidden");
    if (message) {
      if (typeof message === "string") {
        const errDiv = previewHost.createDiv({ cls: "ai3d-inline-empty" });
        errDiv.textContent = message;
      } else {
        renderModelLoadFailure(previewHost, message);
      }
    }
  }

  function setAnnotationMode(active: boolean) {
    annotationMode = active;
    annotationMgr?.hideEditor();
    modeOverlay.classList.toggle("is-hidden", !active);
    renderPanels();
  }

  // ── Panels container (re-rendered on state change) ──
  const panelsEl = container.createDiv({ cls: "ai3d-panels" });

  function renderPanels() {
    const state = ps.store.getState();
    panelsEl.replaceChildren();

    // ── Model Status ──
    panelsEl.appendChild(html`
      <div class="ai3d-section">
        <div class="ai3d-section-header">
          <div>
            <div class="ai3d-section-title">3D model</div>
            <div class="ai3d-section-subtitle">Babylon.js</div>
          </div>
        </div>
        <div class="ai3d-section-body">
          <div class="ai3d-model-status">
            <span class=${`ai3d-status-dot ${state.currentModelPath ? "is-active" : ""}`}></span>
            <span class="ai3d-model-name">${state.currentModelPath ?? "No model loaded"}</span>
          </div>
        </div>
      </div>
    ` as HTMLElement);

    // ── Disassembly Controls ──
    if (preview) {
      const controlsEl = html`
        <div class="ai3d-section">
          <div class="ai3d-section-header">
            <div class="ai3d-section-title">Disassembly</div>
          </div>
          <div class="ai3d-section-body">
            <div class="ai3d-disassemble-controls">
              <div class="ai3d-slider-row">
                <span class="ai3d-slider-label">Explode</span>
                <input type="range" class="ai3d-slider" min="0" max="100" value="0" />
                <span class="ai3d-slider-value">0%</span>
              </div>
              <div class="ai3d-axis-buttons">
                <button class="ai3d-axis-btn is-active" data-axis="x">X</button>
                <button class="ai3d-axis-btn" data-axis="y">Y</button>
                <button class="ai3d-axis-btn" data-axis="z">Z</button>
              </div>
            </div>
          </div>
        </div>
      ` as HTMLElement;
      panelsEl.appendChild(controlsEl);

      const slider = controlsEl.querySelector<HTMLInputElement>(".ai3d-slider")!;
      const valueLabel = controlsEl.querySelector<HTMLSpanElement>(".ai3d-slider-value")!;
      const axisBtns = controlsEl.querySelectorAll<HTMLElement>(".ai3d-axis-btn");
      let currentAxis: "x" | "y" | "z" = "x";

      slider.addEventListener("input", () => {
        const val = parseInt(slider.value, 10);
        valueLabel.textContent = `${val}%`;
        preview?.setExplode(val / 100, currentAxis);
      });

      axisBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          axisBtns.forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          currentAxis = btn.dataset.axis as "x" | "y" | "z";
          const val = parseInt(slider.value, 10);
          preview?.resetExplode();
          if (val > 0) preview?.setExplode(val / 100, currentAxis);
        });
      });
    }

    // ── Summary Grid ──
    if (state.modelPreview) {
      const sp = state.modelPreview;
      panelsEl.appendChild(html`
        <div class="ai3d-section">
          <div class="ai3d-section-header">
            <div class="ai3d-section-title">Summary</div>
          </div>
          <div class="ai3d-section-body">
            <div class="ai3d-summary-grid">
              <div class="ai3d-summary-item">
                <div class="ai3d-summary-label">Meshes</div>
                <div class="ai3d-summary-value">${sp.meshCount}</div>
              </div>
              <div class="ai3d-summary-item">
                <div class="ai3d-summary-label">${sp.splatCount ? "Splats" : "Triangles"}</div>
                <div class="ai3d-summary-value">${(sp.splatCount ?? sp.triangleCount).toLocaleString()}</div>
              </div>
              <div class="ai3d-summary-item">
                <div class="ai3d-summary-label">Materials</div>
                <div class="ai3d-summary-value">${sp.materialCount}</div>
              </div>
            </div>
          </div>
        </div>
      ` as HTMLElement);
    }

    // ── Tags Section ──
    if (state.currentModelPath) {
      const profile = state.modelAssetProfiles[state.currentModelPath];
      const tags = profile?.tags ?? [];
      const tagsEl = html`
        <div class="ai3d-section">
          <div class="ai3d-section-header">
            <div class="ai3d-section-title">Tags</div>
          </div>
          <div class="ai3d-section-body">
            <div class="ai3d-tag-section">
              <div class="ai3d-tag-list">
                ${tags.length > 0
                  ? tags.map((t: string) => html`<span class="ai3d-tag-chip">${t}</span>`)
                  : html`<span class="ai3d-tag-empty">No tags yet</span>`}
              </div>
              <div style=${{ display: "flex", gap: "8px" }}>
                <input class="ai3d-input" placeholder="Add tag..." style=${{ flex: "1" }} />
                <button class="ai3d-axis-btn">Add</button>
              </div>
            </div>
          </div>
        </div>
      ` as HTMLElement;
      panelsEl.appendChild(tagsEl);

      const input = tagsEl.querySelector<HTMLInputElement>(".ai3d-input")!;
      const addBtn = tagsEl.querySelector<HTMLButtonElement>(".ai3d-axis-btn")!;
      function addTag() {
        const val = input.value.trim();
        if (!val) return;
        const current = ps.store.getState().modelAssetProfiles;
        const path = ps.store.getState().currentModelPath!;
        const existing = current[path] ?? createDefaultProfile();
        const newTags = normalizeTagList([...existing.tags, val]);
        ps.store.setState({
          modelAssetProfiles: { ...current, [path]: { ...existing, tags: newTags } },
        });
        input.value = "";
        renderPanels();
      }
      addBtn.addEventListener("click", addTag);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") addTag(); });
    }

    // ── Annotations Section ──
    if (state.currentModelPath && preview) {
      const profile = state.modelAssetProfiles[state.currentModelPath];
      const annotations = profile?.annotations ?? [];
      const annotEl = html`
        <div class="ai3d-section">
          <div class="ai3d-section-header">
            <div class="ai3d-section-title">Annotations</div>
          </div>
          <div class="ai3d-section-body">
            <div class="ai3d-annot-section">
              <div class="ai3d-annot-toggle-row">
                <button class=${`ai3d-axis-btn ${annotationMode ? "is-active" : ""}`} data-action="toggle-annot">
                  ${annotationMode ? "Exit annotate" : "Annotate"}
                </button>
                <span class="ai3d-annot-hint">${annotationMode ? "Click model to add label · ESC to exit" : `${annotations.length} pin(s)`}</span>
              </div>
              ${annotations.length > 0 ? html`
                <div class="ai3d-annot-list">
                  ${annotations.map((a: import("../../domain/models").AnnotationPin) => html`
                    <div class="ai3d-annot-item" data-pin-id=${a.id}>
                      <span class="ai3d-annot-dot" style=${{ background: a.color }}></span>
                      <span class="ai3d-annot-label" data-action="focus-pin" data-pin-id=${a.id}>${a.label}</span>
                      <span class="ai3d-annot-actions">
                        <button class="ai3d-annot-action-btn" data-action="edit-pin" data-pin-id=${a.id} title="Edit">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="ai3d-annot-action-btn is-delete" data-action="delete-pin" data-pin-id=${a.id} title="Delete">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                        </button>
                      </span>
                    </div>
                  `)}
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      ` as HTMLElement;
      panelsEl.appendChild(annotEl);

      // Toggle annotate mode
      const toggleBtn = annotEl.querySelector("[data-action='toggle-annot']");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          setAnnotationMode(!annotationMode);
        });
      }

      // Pin action handlers
      annotEl.querySelectorAll<HTMLElement>("[data-action='focus-pin']").forEach(el => {
        el.addEventListener("click", () => {
          const pinId = el.dataset.pinId!;
          focusPin(pinId);
        });
      });

      annotEl.querySelectorAll<HTMLElement>("[data-action='edit-pin']").forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const pinId = el.dataset.pinId!;
          annotationMgr?.editPin(pinId);
        });
      });

      annotEl.querySelectorAll<HTMLElement>("[data-action='delete-pin']").forEach(el => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const pinId = el.dataset.pinId!;
          annotationMgr?.removePin(pinId);
        });
      });
    }

    // ── Actions ──
    if (state.currentModelPath) {
      const actionsEl = html`
        <div class="ai3d-section">
          <div class="ai3d-section-body">
            <div class="ai3d-actions">
              ${preview ? html`<button class="ai3d-axis-btn" data-action="reset">Reset view</button>` : ""}
              ${preview ? html`<button class="ai3d-axis-btn" data-action="info">Insert info</button>` : ""}
              ${preview?.hasAnimations() ? html`<button class="ai3d-axis-btn" data-action="anim">Play</button>` : ""}
              <button class="ai3d-axis-btn" data-action="save">Save profile</button>
              <button class="ai3d-axis-btn" data-action="note">Generate note</button>
            </div>
          </div>
        </div>
      ` as HTMLElement;
      panelsEl.appendChild(actionsEl);

      actionsEl.querySelector("[data-action='save']")!.addEventListener("click", () => {
        void ps.save();
      });

      const resetAction = actionsEl.querySelector("[data-action='reset']");
      if (resetAction) {
        resetAction.addEventListener("click", () => {
          preview?.resetView();
        });
      }

      const infoAction = actionsEl.querySelector("[data-action='info']");
      if (infoAction) {
        infoAction.addEventListener("click", () => {
          if (!preview) return;
          const path = ps.store.getState().currentModelPath ?? undefined;
          const md = preview.exportModelInfo(path);
          if (!md) return;
          const mdView = app.workspace.getActiveViewOfType(MarkdownView);
          if (mdView && "editor" in mdView) {
            (mdView).editor.replaceSelection(md);
          } else {
            void navigator.clipboard.writeText(md).catch(() => {});
          }
        });
      }

      const animAction = actionsEl.querySelector("[data-action='anim']");
      if (animAction) {
        animAction.addEventListener("click", () => {
          if (!preview?.toggleAnimation) return;
          const playing = preview.toggleAnimation();
          animAction.textContent = playing ? "Pause" : "Play";
        });
      }

      actionsEl.querySelector("[data-action='note']")!.addEventListener("click", () => {
        void generateKnowledgeNote(app, ps.store.getState());
      });
    }
  }

  // Initial panel render
  renderPanels();

  // ── Model loading subscription ──
  async function syncSelectedModel(): Promise<void> {
    if (loading) return;

    loading = true;
    try {
      while (queuedModelPath !== undefined) {
        const path = queuedModelPath;
        queuedModelPath = undefined;
        const state = ps.store.getState();

        if (!path) {
          showEmptyPreview();
          if (state.modelPreview !== null) {
            ps.store.setState({ modelPreview: null });
          }
          continue;
        }

        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
          showEmptyPreview(`File not found: ${path}`);
          if (state.modelPreview !== null) {
            ps.store.setState({ modelPreview: null });
          }
          continue;
        }

        destroyActivePreview();
        emptyState.classList.add("is-hidden");
        const canvas = previewHost.createEl("canvas", { cls: "ai3d-canvas-full" });
        // Ensure canvas renders before modeOverlay (createEl auto-appends as last child)
        previewHost.insertBefore(canvas, modeOverlay);
        previewHost.appendChild(canvas);

        try {
          log.info("begin model load", { path });
          const absolutePath = resolveVaultAbsolutePath(app, path) ?? undefined;
          const conversionManager = createConversionManager(state.settings);
          const prepared = await prepareModelInput({
            path,
            absolutePath,
            preferConversionExts: listPreferredConversionExts(state.settings),
            conversionManager,
            convertedAssetCache,
          });
          const source = toPreviewSource(prepared);
          for (const warning of source.warnings) {
            log.warn("model prepare warning", { path, warning });
          }

          const data = await readBinaryPath(app, source.path);
          const readFile = async (p: string) => readBinaryPath(app, p);

          preview = new BabylonModelPreview(canvas);
          const summary = await preview.loadModel(data, source.ext, readFile, source.path);
          const latestPath = ps.store.getState().currentModelPath;
          if (latestPath !== path) {
            log.info("discard stale model load", { path, nextPath: latestPath });
            preview.destroy();
            preview = null;
            canvas.remove();
            continue;
          }

          const s = ps.store.getState().settings;
          preview.setRenderQuality(s.renderQuality, s.renderScale);

          const canvasEl = preview.getCanvas();
          if (canvasEl) {
            const profile = ps.store.getState().modelAssetProfiles[path];
            const noteReader = createNoteReader(app);
            const headingSearch = createHeadingSearch(app);

            annotationMgr = new AnnotationManager(
              { scene: preview.getScene(), camera: preview.getCamera(), engine: preview.getEngine(), canvas: canvasEl },
              previewHost,
              "edit",
              profile?.annotations ?? [],
              (pins) => {
                const current = ps.store.getState().modelAssetProfiles;
                const p = ps.store.getState().currentModelPath;
                if (!p) return;
                const existing = current[p] ?? createDefaultProfile();
                ps.store.setState({
                  modelAssetProfiles: { ...current, [p]: { ...existing, annotations: pins, updatedAt: new Date().toISOString() } },
                });
              },
              noteReader,
              headingSearch,
            );
            preview.onPick((result) => {
              if (!annotationMode || !annotationMgr) return;
              const screenX = result.screenX;
              const screenY = result.screenY;

              let worldPos: Vector3 | null = null;
              if (result.pickedPoint) {
                worldPos = result.pickedPoint;
              } else if (result.mesh) {
                const bbox = result.mesh.getBoundingInfo().boundingBox;
                worldPos = bbox.centerWorld.clone();
                console.debug("[AI3D] Annotation: pickedPoint null, using bbox center fallback");
              }

              if (!worldPos) return;

              console.debug("[AI3D] Annotation: creating pin at", worldPos.toString(), "screen:", screenX, screenY);
              annotationMgr.showEditor(screenX, screenY, worldPos);
            });
          }

          ps.store.setState({ modelPreview: summary });
          log.info("model load completed", {
            path,
            effectivePath: source.path,
            effectiveExt: source.ext,
            strategy: source.strategy,
            meshCount: summary.meshCount,
            triangleCount: summary.triangleCount,
          });
        } catch (err) {
          const failure = describeModelLoadFailure(err);
          if (isMissingConverterError(err)) {
            log.warn("model load blocked by converter settings", { path, error: err.message });
          } else {
            log.error("model load failed", { path, error: err instanceof Error ? err.message : String(err) });
          }
          showEmptyPreview(failure);
        }
      }
    } finally {
      loading = false;
    }
  }

  const unsubModel = ps.store.subscribe(() => {
    const state = ps.store.getState();
    const pathChanged = state.currentModelPath !== lastObservedModelPath;
    const previewWasReset = state.modelPreview === null && lastObservedPreview !== null;
    lastObservedModelPath = state.currentModelPath;
    lastObservedPreview = state.modelPreview;
    if (!pathChanged && !previewWasReset) return;
    queuedModelPath = state.currentModelPath;
    void syncSelectedModel();
  });
  void syncSelectedModel();

  // ── Panel re-render subscription ──
  const unsubPanels = ps.store.subscribe(() => renderPanels());

  return () => {
    unsubModel();
    unsubPanels();
    activeDocument.removeEventListener("keydown", handleEsc);
    destroyActivePreview();
    container.replaceChildren();
    container.classList.remove("ai3d-workbench");
  };
}

function createDefaultProfile(): ModelAssetProfile {
  return { tags: [], notes: "", annotations: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

/** Guard against concurrent or duplicate note generation calls. */
let noteGenerationLock: Promise<void> | null = null;

export async function generateKnowledgeNote(app: App, state: PluginState) {
  // Serialize concurrent calls to prevent duplicate note creation
  if (noteGenerationLock !== null) await noteGenerationLock;
  let resolveLock!: () => void;
  noteGenerationLock = new Promise<void>(r => { resolveLock = r; });

  try {
    const path = state.currentModelPath;
    if (!path) return;

    const profile = state.modelAssetProfiles[path];
    const preview = state.modelPreview;
    const fileName = path.split(/[\\/]/).pop() ?? "model";
    const baseName = fileName.replace(/\.[^.]+$/, "");
    const reportFolder = state.settings.reportFolder;
    const notePath = `${reportFolder}/${baseName} Report.md`;
    const content = buildNoteContent(baseName, path, profile, preview);

    // If file exists, update it; otherwise create (with fallback if concurrent creation won)
    const existingFile = app.vault.getAbstractFileByPath(notePath);
    if (existingFile instanceof TFile) {
      await app.vault.modify(existingFile, content);
      return;
    }

    // Ensure folder exists
    const folder = app.vault.getAbstractFileByPath(reportFolder);
    if (!folder) {
      await app.vault.createFolder(reportFolder).catch(() => {});
    }

    try {
      await app.vault.create(notePath, content);
    } catch {
      // File was created concurrently — fall back to modify
      const file = app.vault.getAbstractFileByPath(notePath);
      if (file instanceof TFile) {
        await app.vault.modify(file, content);
      }
    }
  } finally {
    resolveLock();
    if (noteGenerationLock !== null) noteGenerationLock = null;
  }
}

function buildNoteContent(
  baseName: string,
  sourcePath: string,
  profile: ModelAssetProfile | undefined,
  preview: import("../../domain/models").ModelPreviewSummary | null,
): string {
  const frontmatter = [
    "---",
    `source_model: "${sourcePath}"`,
    `format: ${sourcePath.split(".").pop()?.toLowerCase() ?? "unknown"}`,
    `status: ready`,
    `updated_at: ${new Date().toISOString()}`,
    ...(profile?.tags.length ? [`knowledge_tags:`, ...profile.tags.map((t) => `  - ${t}`)] : []),
    "---",
  ].join("\n");

  return [
    frontmatter,
    "",
    `# ${baseName}`,
    "",
    "## Summary",
    "",
    ...(preview
      ? [
          "| Metric | Value |",
          "|--------|-------|",
          `| Meshes | ${preview.meshCount} |`,
          `| ${preview.splatCount ? "Splats" : "Triangles"} | ${(preview.splatCount ?? preview.triangleCount).toLocaleString()} |`,
          `| Vertices | ${preview.vertexCount.toLocaleString()} |`,
          `| Materials | ${preview.materialCount} |`,
          `| Bounding Size | ${preview.boundingSize.x.toFixed(2)} x ${preview.boundingSize.y.toFixed(2)} x ${preview.boundingSize.z.toFixed(2)} |`,
          "",
        ]
      : ["(No preview data available)", ""]),
    "## Key Parts",
    "",
    "(Parts will be populated after analysis)",
    "",
    "## Suggested Knowledge Points",
    "",
    "(Knowledge points will be generated after AI analysis)",
    "",
    "## Review Notes",
    "",
    profile?.notes ?? "",
    "",
  ].join("\n");
}
