import type { App, MarkdownPostProcessorContext } from "obsidian";
import { isSupportedModelExtension, listSupportedModelExtensions } from "../../io/formats/registry";
import type { PluginSettings } from "../../domain/models";
import { BabylonModelPreview } from "../../render/babylon/scene";
import { GridRenderer } from "../../render/babylon/grid";
import { readBinaryPath, resolveVaultAbsolutePath, resolveVaultPath } from "../../utils/resolve-path";
import { getPreset, composeSections } from "../../render/babylon/presets";
import { createHelperButtons, type HelperToolbar } from "./helper-buttons";
import type { ThreeDBlockConfig, ModelConfig, GridBlockConfig, ComposeSection } from "../../domain/models";
import { createConversionManager } from "../../io/conversion/factory";
import type { ConvertedAssetCache } from "../../io/cache/converted-asset-cache";
import { prepareModelInput } from "../../io/model-pipeline";
import { toPreviewSource } from "../../io/preview/preview-source";
import { listPreferredConversionExts } from "../../io/formats/route-preferences";

interface PreparedInlineModel {
  sourcePath: string;
  effectivePath: string;
  effectiveExt: string;
  model: ModelConfig;
  warnings: string[];
}

async function prepareInlineModel(
  app: App,
  entry: string | ModelConfig,
  settings: PluginSettings,
  convertedAssetCache: ConvertedAssetCache,
): Promise<PreparedInlineModel> {
  const inputModel = typeof entry === "string" ? { path: entry } : entry;
  const sourcePath = resolveVaultPath(app, inputModel.path);
  if (!sourcePath) {
    throw new Error(`File not found: ${inputModel.path}`);
  }

  const sourceExt = sourcePath.split(".").pop()?.toLowerCase() ?? "";
  if (!isSupportedModelExtension(sourceExt)) {
    throw new Error(`Unsupported format: .${sourceExt}. Supported: ${listSupportedModelExtensions().join(", ")}`);
  }

  const absolutePath = resolveVaultAbsolutePath(app, sourcePath) ?? undefined;
  const conversionManager = createConversionManager(settings);
  const prepared = await prepareModelInput({
    path: sourcePath,
    absolutePath,
    preferConversionExts: listPreferredConversionExts(settings),
    conversionManager,
    convertedAssetCache,
  });
  const source = toPreviewSource(prepared);

  return {
    sourcePath,
    effectivePath: source.path,
    effectiveExt: source.ext,
    warnings: source.warnings,
    model: {
      ...inputModel,
      path: source.path,
    },
  };
}

async function prepareInlineSection(
  app: App,
  section: ComposeSection,
  settings: PluginSettings,
  convertedAssetCache: ConvertedAssetCache,
): Promise<ComposeSection> {
  const models: ModelConfig[] = [];
  for (const entry of section.models) {
    const prepared = await prepareInlineModel(app, entry, settings, convertedAssetCache);
    models.push(prepared.model);
  }

  return {
    ...section,
    models,
  };
}

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
export function registerCodeBlockProcessor(
  app: App,
  getSettings: () => PluginSettings,
  convertedAssetCache: ConvertedAssetCache,
) {
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
      const modelPath = resolveVaultPath(app,modelCfg.path);
      if (!modelPath) {
        el.createDiv({
          cls: "ai3d-inline-empty",
          text: `File not found: ${modelCfg.path}`,
        });
        return;
      }

      const ext = modelPath.split(".").pop()?.toLowerCase() ?? "";
      if (!isSupportedModelExtension(ext)) {
        el.createDiv({
          cls: "ai3d-inline-empty",
          text: `Unsupported format: .${ext}. Supported: ${listSupportedModelExtensions().join(", ")}`,
        });
        return;
      }

      // Create preview host with custom dimensions
      const settings = getSettings();
      const host = el.createDiv({ cls: "ai3d-preview-host" });
      const effectiveHeight = config.height ?? settings.defaultCanvasHeight;
      host.style.minHeight = typeof effectiveHeight === "number" ? `${effectiveHeight}px` : effectiveHeight;
      if (config.width) {
        host.style.maxWidth = typeof config.width === "number" ? `${config.width}px` : config.width;
      }

      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.tabIndex = 0;
      canvas.addEventListener("keydown", (e) => {
        if (destroyed || !preview) return;
        const key = e.key.toLowerCase();
        if (key === "r") { preview.resetView?.(); e.preventDefault(); }
        else if (key === "w") { preview.toggleWireframe?.(); e.preventDefault(); }
        else if (key === "g") { preview.toggleOrientationGizmo?.(); e.preventDefault(); }
        else if (key === "b") { preview.toggleBoundingBox?.(); e.preventDefault(); }
        else if (key === " ") { preview.toggleAnimation?.(); e.preventDefault(); }
      });
      host.appendChild(canvas);

      // Add helper buttons
      let preview: BabylonModelPreview | null = null;
      let destroyed = false;

      const toolbar: HelperToolbar = createHelperButtons(host, app, () => preview, () => modelPath, () => {
        if (destroyed) return;
        destroyed = true;
        observer.disconnect();
        preview?.destroy();
        preview = null;
        host.remove();
      }, getSettings);

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
        const absolutePath = resolveVaultAbsolutePath(app, modelPath) ?? undefined;
        const conversionManager = createConversionManager(settings);
        const prepared = await prepareModelInput({
          path: modelPath,
          absolutePath,
          preferConversionExts: listPreferredConversionExts(settings),
          conversionManager,
          convertedAssetCache,
        });
        const source = toPreviewSource(prepared);
        preview = new BabylonModelPreview(canvas);
        const data = await readBinaryPath(app, source.path);
        const readFile = async (p: string) => readBinaryPath(app, p);

        if (destroyed) return;
        await preview.loadModel(data, source.ext, readFile, source.path);

        if (destroyed) return;
        // Apply auto-rotate default from settings if not specified in config
        if (config.scene?.autoRotate === undefined && settings.autoRotateDefault) {
          config.scene = { ...config.scene, autoRotate: true, autoRotateSpeed: settings.autoRotateSpeed };
        }
        preview.applyConfig(config);

        // Apply render quality from settings
        preview.setRenderQuality(settings.renderQuality, settings.renderScale);

        // Apply STL-specific config from model entry
        if (ext === "stl" && modelCfg.color) {
          preview.setSTLColor(modelCfg.color);
        }
        if (ext === "stl" && modelCfg.wireframe !== undefined) {
          preview.setWireframe(modelCfg.wireframe);
        }

        // Show animation button if model has animations
        if (preview.hasAnimations()) {
          toolbar.showAnimButton();
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
export function registerGridCodeBlockProcessor(
  app: App,
  getSettings: () => PluginSettings,
  convertedAssetCache: ConvertedAssetCache,
) {
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

      if (config.preset !== "compose" && (!config.models || config.models.length === 0)) {
        el.createDiv({ cls: "ai3d-inline-empty", text: "No models specified." });
        return;
      }

      const settings = getSettings();
      const preparedModels: PreparedInlineModel[] = [];
      for (const entry of config.models ?? []) {
        try {
          const prepared = await prepareInlineModel(app, entry, settings, convertedAssetCache);
          preparedModels.push(prepared);
        } catch (err) {
          el.createDiv({
            cls: "ai3d-inline-empty",
            text: err instanceof Error ? err.message : String(err),
          });
          return;
        }
      }
      const resolved: ModelConfig[] = preparedModels.map((item) => item.model);
      let helperSourcePath = preparedModels[0]?.sourcePath ?? "";

      // Create grid container
      const gridHost = el.createDiv({ cls: "ai3d-grid-host" });
      const canvas = document.createElement("canvas");
      canvas.tabIndex = 0;
      canvas.addEventListener("keydown", (e) => {
        if (destroyed || !renderer) return;
        const key = e.key.toLowerCase();
        if (key === "r") { renderer.resetView?.(); e.preventDefault(); }
        else if (key === "w") { renderer.toggleWireframe?.(); e.preventDefault(); }
      });
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

      createHelperButtons(gridHost, app, () => renderer, () => helperSourcePath, () => {
        if (destroyed) return;
        destroyed = true;
        observer.disconnect();
        renderer?.destroy();
        renderer = null;
        gridHost.remove();
      }, getSettings);

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
        const readFile = async (path: string) => readBinaryPath(app, path);

        if (config.preset === "compose") {
          // Compose: each section has its own preset + models
          if (!config.sections || config.sections.length === 0) {
            gridHost.createDiv({ cls: "ai3d-inline-empty", text: '"compose" preset requires "sections" array.' });
            renderer.destroy();
            renderer = null;
            return;
          }
          const preparedSections: ComposeSection[] = [];
          for (const section of config.sections) {
            try {
              if (!helperSourcePath) {
                const firstEntry = section.models[0];
                if (firstEntry) {
                  const rawPath = typeof firstEntry === "string" ? firstEntry : firstEntry.path;
                  helperSourcePath = resolveVaultPath(app, rawPath) ?? rawPath;
                }
              }
              const preparedSection = await prepareInlineSection(app, section, settings, convertedAssetCache);
              preparedSections.push(preparedSection);
            } catch (err) {
              gridHost.createDiv({
                cls: "ai3d-inline-empty",
                text: err instanceof Error ? err.message : String(err),
              });
              renderer.destroy();
              renderer = null;
              return;
            }
          }
          const result = composeSections(
            preparedSections,
            config.direction ?? "horizontal",
            Number(config.params?.gap) || 0.02,
            (entry) => {
              if (typeof entry === "string") return null;
              return entry;
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
