import type { App, MarkdownPostProcessorContext } from "obsidian";
import { SUPPORTED_MODEL_EXTENSIONS } from "../../domain/constants";
import { BabylonModelPreview } from "../../render/babylon/scene";
import { GridRenderer } from "../../render/babylon/grid";
import { getPreset, composeSections } from "../../render/babylon/presets";
import { createHelperButtons } from "./helper-buttons";
import type { ThreeDBlockConfig, ModelConfig, GridBlockConfig } from "../../domain/models";

/**
 * Register the ```3d code block processor.
 *
 * Supports two formats:
 *
 * Simple:    ```3d path/to/model.glb```
 * JSON:      ```3d
 *            { "models": [{ "path": "model.glb" }], "scene": { "autoRotate": true } }
 *            ```
 */
export function registerCodeBlockProcessor(app: App) {
  return {
    id: "3d",
    handler: async (
      source: string,
      el: HTMLElement,
      _ctx: MarkdownPostProcessorContext,
    ) => {
      const trimmed = source.trim();
      if (!trimmed) {
        el.createDiv({ cls: "ai3d-inline-empty", text: "No model path or config specified." });
        return;
      }

      // Determine format: JSON object or simple path
      let config: ThreeDBlockConfig;
      const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");

      if (isJson) {
        try {
          const parsed = JSON.parse(trimmed);
          config = normalizeConfig(parsed);
        } catch (err) {
          const errorEl = el.createDiv({ cls: "ai3d-json-error" });
          const lineMatch = String(err).match(/position\s+(\d+)/);
          let errorMsg = `JSON parse error: ${String(err)}`;
          if (lineMatch) {
            const pos = parseInt(lineMatch[1], 10);
            const lines = trimmed.substring(0, pos).split("\n");
            errorMsg += ` (line ${lines.length})`;
          }
          errorEl.createEl("pre", { text: errorMsg });
          return;
        }
      } else {
        // Simple path format
        config = { models: [{ path: trimmed }] };
      }

      if (!config.models || config.models.length === 0) {
        el.createDiv({ cls: "ai3d-inline-empty", text: "No models specified in config." });
        return;
      }

      // Validate first model path (for now, single model inline preview)
      if (config.models.length > 1) {
        console.warn(`[AI3D] \`\`\`3d only supports one model; ${config.models.length - 1} additional models ignored. Use \`\`\`3dgrid for multi-model.`);
      }
      const modelCfg = config.models[0];
      const modelPath = resolveModelPath(app, modelCfg.path);
      if (!modelPath) {
        el.createDiv({
          cls: "ai3d-inline-empty",
          text: `File not found: ${modelCfg.path}`,
        });
        return;
      }

      const ext = modelPath.split(".").pop()?.toLowerCase() ?? "";
      if (!SUPPORTED_MODEL_EXTENSIONS.has(ext)) {
        el.createDiv({
          cls: "ai3d-inline-empty",
          text: `Unsupported format: .${ext}. Supported: ${[...SUPPORTED_MODEL_EXTENSIONS].join(", ")}`,
        });
        return;
      }

      // Create preview host with custom dimensions
      const host = el.createDiv({ cls: "ai3d-preview-host" });
      if (config.height) {
        host.style.minHeight = typeof config.height === "number" ? `${config.height}px` : config.height;
      }
      if (config.width) {
        host.style.maxWidth = typeof config.width === "number" ? `${config.width}px` : config.width;
      }

      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      host.appendChild(canvas);

      // Add helper buttons
      let preview: BabylonModelPreview | null = null;
      let destroyed = false;

      createHelperButtons(host, app, () => preview, () => modelPath, () => {
        if (destroyed) return;
        destroyed = true;
        observer.disconnect();
        preview?.destroy();
        preview = null;
        host.remove();
      });

      // Auto-destroy when the DOM element is removed
      const observer = new MutationObserver(() => {
        if (destroyed) return;
        if (!el.contains(host)) {
          destroyed = true;
          observer.disconnect();
          preview?.destroy();
          preview = null;
        }
      });
      observer.observe(el, { childList: true, subtree: true });

      try {
        const file = app.vault.getAbstractFileByPath(modelPath);
        if (!file || !("extension" in file)) {
          host.createDiv({ cls: "ai3d-inline-empty", text: `File not found: ${modelPath}` });
          return;
        }

        preview = new BabylonModelPreview(canvas);
        const data = await app.vault.readBinary(file as any);

        if (destroyed) return;
        await preview.loadModel(data, ext);

        if (destroyed) return;
        preview.applyConfig(config);

        // Apply STL-specific config from model entry
        if (ext === "stl" && modelCfg.color) {
          preview.setSTLColor(modelCfg.color);
        }
        if (ext === "stl" && modelCfg.wireframe !== undefined) {
          preview.setWireframe(modelCfg.wireframe);
        }
      } catch (err) {
        preview?.destroy();
        preview = null;
        console.error("[AI3D] Inline preview failed:", err);
        host.createDiv({ cls: "ai3d-inline-empty", text: `Failed to load: ${String(err)}` });
      }
    },
  };
}

/**
 * Resolve a model path using Obsidian's link resolution.
 * Supports both exact vault paths and link-style paths.
 */
function resolveModelPath(app: App, rawPath: string): string | null {
  // Try exact path first
  const exact = app.vault.getAbstractFileByPath(rawPath);
  if (exact) return rawPath;

  // Try metadataCache link resolution (handles links without full path)
  const resolved = (app as any).metadataCache?.getFirstLinkpathDest?.(rawPath, "");
  if (resolved) return resolved.path;

  return null;
}

/**
 * Normalize a raw parsed JSON object into ThreeDBlockConfig.
 * Handles both single-model shorthand and full config.
 */
function normalizeConfig(raw: any): ThreeDBlockConfig {
  // If it's a string, treat as simple path
  if (typeof raw === "string") {
    return { models: [{ path: raw }] };
  }

  // If it has a "path" property at top level, it's a single model config
  if (raw.path && typeof raw.path === "string") {
    return {
      models: [{ path: raw.path, color: raw.color, wireframe: raw.wireframe }],
      camera: raw.camera,
      lights: raw.lights,
      scene: raw.scene,
      stl: raw.stl,
      width: raw.width,
      height: raw.height,
    };
  }

  // Full config with models array
  const models: ModelConfig[] = Array.isArray(raw.models)
    ? raw.models
        .filter((m: any) => {
          const p = typeof m === "string" ? m : m?.path;
          return typeof p === "string" && p.length > 0;
        })
        .map((m: any) =>
          typeof m === "string" ? { path: m } : { path: m.path, color: m.color, wireframe: m.wireframe },
        )
    : [];

  return {
    models,
    camera: raw.camera,
    lights: raw.lights,
    scene: raw.scene,
    stl: raw.stl,
    width: raw.width,
    height: raw.height,
  };
}

/**
 * Register the ```3dgrid code block processor.
 *
 * Renders multiple models in a single Babylon Scene using per-cell viewports.
 * One Engine / one WebGL context — no context limit risk.
 *
 * JSON config:
 * ```3dgrid
 * { "models": ["a.glb", "b.glb", "c.glb"], "columns": 3, "rowHeight": 300 }
 * ```
 */
export function registerGridCodeBlockProcessor(app: App) {
  return {
    id: "3dgrid",
    handler: async (
      source: string,
      el: HTMLElement,
      _ctx: MarkdownPostProcessorContext,
    ) => {
      const trimmed = source.trim();
      if (!trimmed) {
        el.createDiv({ cls: "ai3d-inline-empty", text: "No config specified." });
        return;
      }

      let config: GridBlockConfig;
      try {
        config = JSON.parse(trimmed);
      } catch (err) {
        const errorEl = el.createDiv({ cls: "ai3d-json-error" });
        errorEl.createEl("pre", { text: `JSON parse error: ${String(err)}` });
        return;
      }

      if (!config.models || config.models.length === 0) {
        el.createDiv({ cls: "ai3d-inline-empty", text: "No models specified." });
        return;
      }

      // Resolve and validate paths
      const resolved: ModelConfig[] = [];
      for (const entry of config.models) {
        const rawPath = typeof entry === "string" ? entry : entry.path;
        const path = resolveModelPath(app, rawPath);
        if (!path) {
          el.createDiv({ cls: "ai3d-inline-empty", text: `File not found: ${rawPath}` });
          return;
        }
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        if (!SUPPORTED_MODEL_EXTENSIONS.has(ext)) {
          el.createDiv({
            cls: "ai3d-inline-empty",
            text: `Unsupported format: .${ext}. Supported: ${[...SUPPORTED_MODEL_EXTENSIONS].join(", ")}`,
          });
          return;
        }
        resolved.push(typeof entry === "string" ? { path } : { ...entry, path });
      }

      // Create grid container
      const gridHost = el.createDiv({ cls: "ai3d-grid-host" });
      const canvas = document.createElement("canvas");
      gridHost.appendChild(canvas);

      const rowHeight = config.rowHeight ?? 300;
      const minHeight = typeof rowHeight === "number" ? rowHeight : 300;
      if (config.preset === "compose") {
        // Compose: use rowHeight directly (sections are side-by-side or stacked)
        gridHost.style.minHeight = `${minHeight}px`;
      } else {
        const cols = config.columns ?? Math.min(resolved.length, 3);
        const rows = Math.ceil(resolved.length / cols);
        gridHost.style.minHeight = `${minHeight * rows}px`;
      }

      let renderer: GridRenderer | null = null;
      let destroyed = false;

      createHelperButtons(gridHost, app, () => renderer, () => resolved[0]?.path ?? "", () => {
        if (destroyed) return;
        destroyed = true;
        observer.disconnect();
        renderer?.destroy();
        renderer = null;
        gridHost.remove();
      });

      const observer = new MutationObserver(() => {
        if (destroyed) return;
        if (!el.contains(gridHost)) {
          destroyed = true;
          observer.disconnect();
          renderer?.destroy();
          renderer = null;
        }
      });
      observer.observe(el, { childList: true, subtree: true });

      try {
        renderer = new GridRenderer(canvas);
        const readFile = async (path: string) => {
          const file = app.vault.getAbstractFileByPath(path);
          if (!file) throw new Error(`File not found: ${path}`);
          return app.vault.readBinary(file as any);
        };

        if (config.preset === "compose") {
          // Compose: each section has its own preset + models
          if (!config.sections || config.sections.length === 0) {
            gridHost.createDiv({ cls: "ai3d-inline-empty", text: '"compose" preset requires "sections" array.' });
            renderer.destroy();
            renderer = null;
            return;
          }
          const result = composeSections(
            config.sections,
            config.direction ?? "horizontal",
            Number(config.params?.gap) || 0.02,
            (entry) => {
              const rawPath = typeof entry === "string" ? entry : entry.path;
              const path = resolveModelPath(app, rawPath);
              if (!path) return null;
              return typeof entry === "string" ? { path } : { ...entry, path };
            },
            getPreset,
          );
          if (!result) {
            gridHost.createDiv({ cls: "ai3d-inline-empty", text: "Compose: no valid sections." });
            renderer.destroy();
            renderer = null;
            return;
          }
          await renderer.loadWithPreset(result, readFile);
        } else if (config.preset) {
          const preset = getPreset(config.preset);
          if (!preset) {
            gridHost.createDiv({
              cls: "ai3d-inline-empty",
              text: `Unknown preset: "${config.preset}". Available: compare, showcase, explode, timeline, compose`,
            });
            renderer.destroy();
            renderer = null;
            return;
          }
          const result = preset.compute(resolved, config.params ?? {});
          if (!result) {
            gridHost.createDiv({
              cls: "ai3d-inline-empty",
              text: `Preset "${config.preset}" requires ${preset.minModels}-${preset.maxModels} models, got ${resolved.length}.`,
            });
            renderer.destroy();
            renderer = null;
            return;
          }
          await renderer.loadWithPreset(result, readFile);
        } else {
          await renderer.loadModels(resolved, config, readFile);
        }

        if (destroyed) return;
      } catch (err) {
        renderer?.destroy();
        renderer = null;
        console.error("[AI3D Grid] Failed:", err);
        gridHost.createDiv({ cls: "ai3d-inline-empty", text: `Grid failed: ${String(err)}` });
      }
    },
  };
}
