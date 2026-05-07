import type { App } from "obsidian";
import type { PluginStore } from "../../store/plugin-store";
import type { PluginState, ModelAssetProfile } from "../../domain/models";
import { normalizeTagList } from "../../utils/format";
import { BabylonModelPreview } from "../../render/babylon/scene";
import { html } from "./h";

export function mountWorkbench(
  container: HTMLElement,
  app: App,
  ps: PluginStore,
): () => void {
  container.classList.add("ai3d-workbench");

  let preview: BabylonModelPreview | null = null;
  let loading = false;

  // ── Stable preview host (never removed from DOM) ──
  const previewHost = document.createElement("div");
  previewHost.className = "ai3d-preview-host";
  const emptyState = html`
    <div class="ai3d-empty-state">
      <div class="ai3d-empty-icon">3D</div>
      <div class="ai3d-empty-title">No Model</div>
      <div class="ai3d-empty-text">Use "Import 3D Model" command to load a GLB, GLTF, or STL file.</div>
    </div>
  ` as HTMLElement;
  previewHost.appendChild(emptyState);

  // ── Panels container (re-rendered on state change) ──
  const panelsEl = document.createElement("div");
  panelsEl.className = "ai3d-panels";

  container.appendChild(previewHost);
  container.appendChild(panelsEl);

  function renderPanels() {
    const state = ps.store.getState();
    panelsEl.innerHTML = "";

    // ── Model Status ──
    panelsEl.appendChild(html`
      <div class="ai3d-section">
        <div class="ai3d-section-header">
          <div>
            <div class="ai3d-section-title">3D Model</div>
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

      const slider = controlsEl.querySelector(".ai3d-slider") as HTMLInputElement;
      const valueLabel = controlsEl.querySelector(".ai3d-slider-value") as HTMLSpanElement;
      const axisBtns = controlsEl.querySelectorAll(".ai3d-axis-btn") as NodeListOf<HTMLButtonElement>;
      let currentAxis: "x" | "y" | "z" = "x";

      slider.addEventListener("input", () => {
        const val = parseInt(slider.value, 10);
        valueLabel.textContent = `${val}%`;
        preview!.setExplode(val / 100, currentAxis);
      });

      axisBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          axisBtns.forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          currentAxis = btn.dataset.axis as "x" | "y" | "z";
          const val = parseInt(slider.value, 10);
          preview!.resetExplode();
          if (val > 0) preview!.setExplode(val / 100, currentAxis);
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

      const input = tagsEl.querySelector(".ai3d-input") as HTMLInputElement;
      const addBtn = tagsEl.querySelector(".ai3d-axis-btn") as HTMLButtonElement;
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

    // ── Actions ──
    if (state.currentModelPath) {
      const actionsEl = html`
        <div class="ai3d-section">
          <div class="ai3d-section-body">
            <div class="ai3d-actions">
              ${preview ? html`<button class="ai3d-axis-btn" data-action="reset">Reset View</button>` : ""}
              ${preview ? html`<button class="ai3d-axis-btn" data-action="info">Insert Info</button>` : ""}
              <button class="ai3d-axis-btn" data-action="save">Save Profile</button>
              <button class="ai3d-axis-btn" data-action="note">Generate Note</button>
            </div>
          </div>
        </div>
      ` as HTMLElement;
      panelsEl.appendChild(actionsEl);

      actionsEl.querySelector("[data-action='save']")!.addEventListener("click", async () => {
        await ps.save();
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
          const activeLeaf = app.workspace.activeLeaf;
          const view = activeLeaf?.view as any;
          if (view?.editor) {
            view.editor.replaceSelection(md);
          } else {
            navigator.clipboard.writeText(md);
          }
        });
      }

      actionsEl.querySelector("[data-action='note']")!.addEventListener("click", async () => {
        await generateKnowledgeNote(app, ps.store.getState());
      });
    }
  }

  // Initial panel render
  renderPanels();

  // ── Model loading subscription ──
  const unsubModel = ps.store.subscribe(async () => {
    const state = ps.store.getState();
    const path = state.currentModelPath;
    if (!path || loading) return;

    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return;

    loading = true;

    // Destroy previous preview
    preview?.destroy();
    preview = null;

    // Clear empty state, show loading
    emptyState.style.display = "none";
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    previewHost.appendChild(canvas);

    try {
      const data = await app.vault.readBinary(file as any);
      const ext = path.split(".").pop() ?? "glb";
      const readFile = async (p: string) => {
        const f = app.vault.getAbstractFileByPath(p);
        if (!f) throw new Error(`File not found: ${p}`);
        return app.vault.readBinary(f as any);
      };

      preview = new BabylonModelPreview(canvas);
      const summary = await preview.loadModel(data, ext, readFile, path);
      ps.store.setState({ modelPreview: summary });
    } catch (err) {
      console.error("[AI3D] Failed to load model:", err);
      canvas.remove();
      emptyState.style.display = "";
      const errDiv = previewHost.createDiv({ cls: "ai3d-inline-empty" });
      errDiv.textContent = `Failed to load: ${String(err)}`;
    } finally {
      loading = false;
    }
  });

  // ── Panel re-render subscription ──
  const unsubPanels = ps.store.subscribe(() => renderPanels());

  return () => {
    unsubModel();
    unsubPanels();
    preview?.destroy();
    preview = null;
    container.innerHTML = "";
    container.classList.remove("ai3d-workbench");
  };
}

function createDefaultProfile(): ModelAssetProfile {
  return { tags: [], notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

async function generateKnowledgeNote(app: App, state: PluginState) {
  const path = state.currentModelPath;
  if (!path) return;

  const profile = state.modelAssetProfiles[path];
  const preview = state.modelPreview;
  const fileName = path.split("/").pop() ?? "model";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const reportFolder = state.settings.reportFolder;
  const notePath = `${reportFolder}/${baseName} Report.md`;

  // Check if note already exists
  const exists = await app.vault.adapter.exists(notePath);
  if (exists) {
    const file = app.vault.getAbstractFileByPath(notePath);
    if (file) {
      // Update existing file
      const content = buildNoteContent(baseName, path, profile, preview);
      await app.vault.modify(file as any, content);
    }
    return;
  }

  // Ensure folder exists
  const folder = app.vault.getAbstractFileByPath(reportFolder);
  if (!folder) {
    await app.vault.createFolder(reportFolder).catch(() => {});
  }

  const content = buildNoteContent(baseName, path, profile, preview);
  await app.vault.create(notePath, content);
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
