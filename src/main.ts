import { Notice, Plugin, type TFile, WorkspaceLeaf } from "obsidian";
import type { PluginSettings } from "./domain/models";
import { createConvertedAssetCache, type ConvertedAssetCache } from "./io/cache/converted-asset-cache";
import { listSupportedModelExtensions, isSupportedModelExtension } from "./io/formats/registry";
import { createPluginStore, type PluginStore } from "./store/plugin-store";
import { AnalysisView, VIEW_TYPE } from "./view/analysis-view";
import { DirectModelView, DIRECT_VIEW_TYPE } from "./view/direct-view";
import { ModelFileSuggestModal } from "./view/model-file-suggest-modal";
import { AI3DSettingTab } from "./settings";
import { inspectAllConverterCommands } from "./io/conversion/command-discovery";
import { setLogLevel } from "./utils/log";
import { setLocale, t, type Locale } from "./i18n";
import { normalizeHeadingText } from "./utils/note-reader";

export default class AI3DModelWorkbench extends Plugin {
  private ps!: PluginStore;
  private convertedAssetCache!: ConvertedAssetCache;

  getSettings(): PluginSettings {
    return this.ps.store.getState().settings;
  }

  updateSettings(partial: Partial<PluginSettings>): void {
    const current = this.ps.store.getState().settings;
    const next = { ...current, ...partial };
    this.ps.store.setState({ settings: next });
    setLogLevel(next.logLevel);
    setLocale(next.locale);
  }

  async onload() {
    this.ps = createPluginStore(this);
    await this.ps.load();
    this.convertedAssetCache = createConvertedAssetCache(
      this.ps.store.getState().convertedAssetRecords,
      (records) => this.ps.store.setState({ convertedAssetRecords: records }),
    );
    setLogLevel(this.getSettings().logLevel);
    // Auto-detect locale on first run (old data has no locale field)
    if (!this.ps.localeLoadedFromSaved) {
      const sysLang = navigator.language ?? "en";
      const detected: Locale = sysLang.startsWith("zh") ? "zh-CN" : "en";
      this.updateSettings({ locale: detected });
    }
    setLocale(this.getSettings().locale);

    this.registerView(VIEW_TYPE, (leaf) => new AnalysisView(leaf, this.ps, this.convertedAssetCache));

    this.addRibbonIcon("box", "Open 3d workbench", () => this.activateView());

    this.addCommand({
      id: "import-model",
      name: "Import 3d model",
      callback: () => this.importModel(),
    });

    this.addCommand({
      id: "open-workbench",
      name: "Open 3d workbench",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "generate-note",
      name: "Generate knowledge note",
      callback: () => this.generateNote(),
    });

    this.addCommand({
      id: "clear-conversion-cache",
      name: "Clear conversion cache",
      callback: () => this.clearConversionCache(),
    });

    this.addCommand({
      id: "check-converters",
      name: "Check converters",
      callback: () => void this.checkConverterCommands(),
    });

    this.addSettingTab(new AI3DSettingTab(this.app, this));

    // Register direct file view for all supported formats. Conversion-capable formats
    // will be routed through the shared model pipeline inside DirectModelView.
    this.registerView(DIRECT_VIEW_TYPE, (leaf) => new DirectModelView(leaf, () => this.getSettings(), this.convertedAssetCache, this.ps));
    this.registerExtensions(listSupportedModelExtensions(), DIRECT_VIEW_TYPE);

    // Register ```3d and ```3dgrid code block processors
    const { registerCodeBlockProcessor, registerGridCodeBlockProcessor } = await import("./view/inline/code-block");
    const getAnnotations = (modelPath: string) =>
      this.ps.store.getState().modelAssetProfiles[modelPath]?.annotations ?? [];
    const cb = registerCodeBlockProcessor(this.app, () => this.getSettings(), this.convertedAssetCache, getAnnotations);
    this.registerMarkdownCodeBlockProcessor(cb.id, cb.handler);
    const gridCb = registerGridCodeBlockProcessor(this.app, () => this.getSettings(), this.convertedAssetCache);
    this.registerMarkdownCodeBlockProcessor(gridCb.id, gridCb.handler);

    // Register Live Preview extension for ![[model.glb]] embeds
    const { registerLivePreviewExtension } = await import("./view/inline/live-preview");
    const exts = registerLivePreviewExtension(this.app, () => this.getSettings(), this.convertedAssetCache, getAnnotations);
    for (const e of exts) {
      this.registerEditorExtension(e);
    }

    // Watch note headings for hover → highlight pin
    this.setupHeadingPinObserver();
  }

  onunload(): void {
    this.ps.dispose();
    // Views are cleaned up by Obsidian calling onClose()
  }

  private setupHeadingPinObserver(): void {
    const headingSelector = [
      ".markdown-preview-view h1", ".markdown-preview-view h2", ".markdown-preview-view h3",
      ".markdown-preview-view h4", ".markdown-preview-view h5", ".markdown-preview-view h6",
      ".cm-heading-1", ".cm-heading-2", ".cm-heading-3",
      ".cm-heading-4", ".cm-heading-5", ".cm-heading-6",
      ".cm-header-1", ".cm-header-2", ".cm-header-3",
      ".cm-header-4", ".cm-header-5", ".cm-header-6",
    ].join(", ");

    // Track bound elements for cleanup
    const boundEntries: { el: Element; handler: () => void }[] = [];

    // Build headingRef → [{ pinId, modelPath, color }] map from stored annotations.
    // Supports multiple pins/models per heading.
    type PinEntry = { pinId: string; modelPath: string; color: string };
    const buildBadgeSwatchBackground = (colors: string[]): string => {
      if (colors.length === 0) return "var(--interactive-accent)";
      if (colors.length === 1) return colors[0];
      const step = 100 / colors.length;
      return `linear-gradient(135deg, ${colors.map((color, index) => {
        const start = Math.round(index * step);
        const end = Math.round((index + 1) * step);
        return `${color} ${start}% ${end}%`;
      }).join(", ")})`;
    };

    const buildHeadingMap = (): Map<string, PinEntry[]> => {
      const map = new Map<string, PinEntry[]>();
      const profiles = this.ps.store.getState().modelAssetProfiles;
      for (const [modelPath, profile] of Object.entries(profiles)) {
        for (const pin of profile.annotations) {
          if (pin.headingRef && pin.id) {
            let arr = map.get(pin.headingRef);
            if (!arr) { arr = []; map.set(pin.headingRef, arr); }
            arr.push({ pinId: pin.id, modelPath, color: pin.color });
          }
        }
      }
      return map;
    };

    // Normalize all headingRef keys for robust matching
    const normalizedMap = new Map<string, PinEntry[]>();
    const buildNormalizedMap = (headingMap: Map<string, PinEntry[]>): void => {
      normalizedMap.clear();
      for (const [key, entries] of headingMap) {
        normalizedMap.set(normalizeHeadingText(key), entries);
      }
    };

    const bindHeading = (el: Element) => {
      if ((el as HTMLElement).dataset.pinBound) return;

      const text = el.textContent ?? "";
      const headingText = normalizeHeadingText(text);
      const entries = normalizedMap.get(headingText);

      if (!entries || entries.length === 0) return;
      (el as HTMLElement).dataset.pinBound = entries[0].pinId;

      // Add pin badge: shows count if multiple, tooltip lists model sources
      // Create on heading element (in DOM) to inherit Obsidian CSS variables
      const badge = (el as HTMLElement).createSpan({ cls: "ai3d-heading-pin-badge" });
      const distinctColors = [...new Set(entries.map((entry) => entry.color).filter(Boolean))];
      const swatch = badge.createSpan({ cls: "ai3d-heading-pin-badge-swatch" });
      swatch.style.background = buildBadgeSwatchBackground(distinctColors);
      swatch.title = entries.length > 1 ? t("headingPin.showMultiple") : t("headingPin.showSingle");
      swatch.setAttribute("role", "button");
      swatch.setAttribute("tabindex", "0");
      if (entries.length > 1) {
        const count = badge.createSpan({ cls: "ai3d-heading-pin-badge-count" });
        count.textContent = `\u00d7${entries.length}`;
      }
      const uniqueModels = [...new Set(entries.map(e => e.modelPath.replace(/^.*\//, "").replace(/\.[^.]+$/, "")))];
      badge.title = t("headingPin.linkedTo").replace("{models}", uniqueModels.join(", "));
      const highlightLinkedPins = (e?: Event) => {
        e?.stopPropagation();
        e?.preventDefault();
        for (const entry of entries) {
          activeDocument.dispatchEvent(new CustomEvent("ai3d-pin-highlight", { detail: { pinId: entry.pinId } }));
        }
      };
      swatch.addEventListener("click", (e) => {
        highlightLinkedPins(e);
      });
      swatch.addEventListener("keydown", (e) => {
        if (!e.instanceOf(KeyboardEvent)) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        highlightLinkedPins(e);
      });
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      el.appendChild(badge);

      // Hover on heading → pulse all linked pins
      const handler = () => {
        for (const entry of entries) {
          activeDocument.dispatchEvent(new CustomEvent("ai3d-pin-highlight", { detail: { pinId: entry.pinId } }));
        }
      };
      el.addEventListener("mouseover", handler);
      boundEntries.push({ el, handler });
    };

    const processHeadings = (container: Element) => {
      const headingMap = buildHeadingMap();
      if (headingMap.size === 0) return;
      buildNormalizedMap(headingMap);
      container.querySelectorAll(headingSelector).forEach((el) => bindHeading(el));
    };

    const scanAll = () => {
      const containers = activeDocument.querySelectorAll(".markdown-preview-view, .markdown-source-view");
      containers.forEach(processHeadings);
    };

    this.registerEvent(this.app.workspace.on("layout-change", () => {
      activeWindow.setTimeout(scanAll, 200);
    }));

    // Debounced MutationObserver: coalesce rapid DOM changes into a single scan
    let pendingNodes: HTMLElement[] = [];
    let debounceTimer = 0;
    const flushPending = () => {
      const nodes = pendingNodes;
      pendingNodes = [];
      debounceTimer = 0;
      const headingMap = buildHeadingMap();
      if (headingMap.size === 0) return;
      buildNormalizedMap(headingMap);
      for (const node of nodes) {
        if (node.matches?.(headingSelector)) bindHeading(node);
        node.querySelectorAll?.(headingSelector)?.forEach((el: Element) => bindHeading(el));
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node.instanceOf(HTMLElement)) pendingNodes.push(node);
        }
      }
      if (pendingNodes.length > 0 && !debounceTimer) {
        debounceTimer = window.setTimeout(flushPending, 100);
      }
    });
    observer.observe(activeDocument.body, { childList: true, subtree: true });

    // Cleanup: disconnect observer, remove all heading listeners
    this.register(() => {
      observer.disconnect();
      if (debounceTimer) { activeWindow.clearTimeout(debounceTimer); debounceTimer = 0; }
      for (const { el, handler } of boundEntries) {
        el.removeEventListener("mouseover", handler);
        el.removeEventListener("click", handler);
      }
      boundEntries.length = 0;
    });

    // Initial scan
    activeWindow.setTimeout(scanAll, 500);
  }

  private async activateView() {
    const { workspace } = this.app;

    // Try to find existing leaf
    let leaf: WorkspaceLeaf | null = null;
    workspace.iterateAllLeaves((l) => {
      if (l.getViewState().type === VIEW_TYPE) {
        leaf = l;
      }
    });

    if (!leaf) {
      // Open in right split
      leaf = workspace.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    workspace.setActiveLeaf(leaf, { focus: true });
  }

  private importModel() {
    new ModelFileSuggestModal(this.app, (file: TFile) => {
      const ext = file.extension.toLowerCase();
      if (!isSupportedModelExtension(ext)) {
        return;
      }

      if (this.ps.store.getState().currentModelPath === file.path) {
        this.ps.store.setState({
          currentModelPath: null,
          modelPreview: null,
        });
      }

      // Update store with new model path and reset preview
      this.ps.store.setState({
        currentModelPath: file.path,
        modelPreview: null,
      });

      // Open workbench if not already open
      void this.activateView();
    }).open();
  }

  private async generateNote() {
    const { generateKnowledgeNote } = await import("./view/workbench/app");
    await generateKnowledgeNote(this.app, this.ps.store.getState());
  }

  private clearConversionCache() {
    this.convertedAssetCache.clear();
    new Notice("AI 3d conversion cache cleared.");
  }

  private async checkConverterCommands() {
    const statuses = await inspectAllConverterCommands(this.getSettings());
    const available = statuses.filter((status) => status.available).map((status) => status.label);
    const missing = statuses.filter((status) => !status.available).map((status) => status.label);

    if (missing.length === 0) {
      new Notice(`AI 3D converter diagnostics: all commands available (${available.join(", ")}).`, 8000);
      return;
    }

    new Notice(
      `AI 3D converter diagnostics: available ${available.join(", ") || "none"}; missing ${missing.join(", ")}.`,
      10000,
    );
  }
}
