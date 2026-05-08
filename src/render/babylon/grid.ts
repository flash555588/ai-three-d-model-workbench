import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Viewport } from "@babylonjs/core/Maths/math.viewport.js";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import type { ModelConfig, GridBlockConfig, ModelPlacement, PresetCameraDef, CellLayout, PresetResult } from "../../domain/models";
import "./loaders/register";
import { ensureLoadersRegistered } from "./loaders/register";
import { arrayBufferToBase64 } from "../../utils/base64";
import { isMobile } from "../../utils/device";

/** Babylon.js uses 32-bit layerMask — one bit per cell, so max 32 cells. */
const MAX_CELLS = 32;

interface GridCell {
  meshes: AbstractMesh[];
  camera: ArcRotateCamera;
}

/**
 * Renders multiple models in a single Babylon Scene using per-cell viewports.
 * One Engine / one WebGL context regardless of grid size.
 */
export class GridRenderer {
  private engine: Engine;
  private scene: Scene;
  private cells: GridCell[] = [];
  private initialCameras: { alpha: number; beta: number; radius: number; target: Vector3 }[] = [];
  private wireframeEnabled = false;
  private rendering = false;
  private resizeObs: ResizeObserver;
  private readonly preventCanvasWheelScroll = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  constructor(canvas: HTMLCanvasElement) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.addEventListener("wheel", this.preventCanvasWheelScroll, { passive: false });
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.12, 0.12, 0.14, 1);
    this.scene.autoClear = false;
    new HemisphericLight("default-light", new Vector3(0, 1, 0.5), this.scene);

    this.resizeObs = new ResizeObserver(() => this.engine.resize());
    this.resizeObs.observe(canvas);
    requestAnimationFrame(() => this.engine.resize());
  }

  async loadModels(
    models: ModelConfig[],
    config: GridBlockConfig,
    readFile: (path: string) => Promise<ArrayBuffer>,
  ): Promise<void> {
    await ensureLoadersRegistered();

    const effectiveModels = models.length > MAX_CELLS
      ? (console.warn(`[AI3D Grid] Capping ${models.length} models to ${MAX_CELLS} (layerMask limit)`), models.slice(0, MAX_CELLS))
      : models;

    const cols = config.columns ?? Math.min(effectiveModels.length, 3);
    const gapX = config.gapX ?? 0.02;
    const gapY = config.gapY ?? 0.02;
    const rows = Math.ceil(effectiveModels.length / cols);
    const cellW = (1 - gapX * (cols + 1)) / cols;
    const cellH = (1 - gapY * (rows + 1)) / rows;

    for (let i = 0; i < effectiveModels.length; i++) {
      const model = effectiveModels[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gapX + col * (cellW + gapX);
      const y = gapY + (rows - 1 - row) * (cellH + gapY);

      try {
        await this.loadOne(model, readFile, x, y, cellW, cellH, i);
      } catch (err) {
        console.error(`[AI3D Grid] Failed to load ${model.path}:`, err);
      }
    }

    this.startRenderLoop();
    this.engine.resize();
  }

  /**
   * Load models using a preset layout (placements + cells).
   * Models with the same path share geometry (loaded once, placed at different positions).
   */
  async loadWithPreset(
    result: PresetResult,
    readFile: (path: string) => Promise<ArrayBuffer>,
  ): Promise<void> {
    await ensureLoadersRegistered();

    // Load each unique model placement (deduplicated by path+position)
    const effectivePlacements = result.placements.length > MAX_CELLS
      ? (console.warn(`[AI3D Preset] Capping ${result.placements.length} placements to ${MAX_CELLS} (layerMask limit)`), result.placements.slice(0, MAX_CELLS))
      : result.placements;

    const loadedMeshes: AbstractMesh[][] = [];
    for (let i = 0; i < effectivePlacements.length; i++) {
      const placement = effectivePlacements[i];
      try {
        const meshes = await this.loadPlacementMesh(placement, readFile, i);
        loadedMeshes.push(meshes);
      } catch (err) {
        console.error(`[AI3D Preset] Failed to load ${placement.path}:`, err);
        loadedMeshes.push([]);
      }
    }

    // Compute overall scene bounding box (for "gallery" mode cameras)
    const allRoots = loadedMeshes.filter(m => m.length > 0).map(m => m[0]);
    let sceneCenter = Vector3.Zero();
    let sceneRadius = 1;
    if (allRoots.length > 0) {
      let min = new Vector3(Infinity, Infinity, Infinity);
      let max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const root of allRoots) {
        root.computeWorldMatrix(true);
        const bb = root.getHierarchyBoundingVectors();
        min = Vector3.Minimize(min, bb.min);
        max = Vector3.Maximize(max, bb.max);
      }
      const diag = max.subtract(min);
      sceneCenter = min.add(diag.scale(0.5));
      sceneRadius = diag.length() / 2;
    }

    // Create cells from layout definitions.
    // Single-cell presets (gallery) get ALL placements merged into one cell.
    const isSingleCell = result.cells.length === 1;

    for (const cellDef of result.cells) {
      const primaryMeshes = loadedMeshes[cellDef.modelIndex];
      if (!primaryMeshes || primaryMeshes.length === 0) continue;

      let cellMeshes: AbstractMesh[];
      let combinedMask: number;

      if (isSingleCell) {
        // Single cell: include ALL loaded placements
        cellMeshes = [];
        combinedMask = 0;
        for (let i = 0; i < loadedMeshes.length; i++) {
          if (loadedMeshes[i].length > 0) {
            cellMeshes.push(...loadedMeshes[i]);
            combinedMask |= 1 << i;
          }
        }
      } else {
        // Multi-cell: each cell gets its own placement only.
        // Camera and meshes share the same single-bit mask.
        cellMeshes = primaryMeshes ? [...primaryMeshes] : [];
        combinedMask = 1 << cellDef.modelIndex;
      }

      // Override mesh layerMasks
      for (const mesh of cellMeshes) mesh.layerMask = combinedMask;

      const camera = this.createCameraFromDef(
        cellDef,
        primaryMeshes[0],
        this.cells.length,
        sceneCenter,
        sceneRadius,
      );
      camera.layerMask = combinedMask;

      this.cells.push({ meshes: cellMeshes, camera });
    }

    this.startRenderLoop();
    this.engine.resize();
  }

  /**
   * Import a mesh from raw data using Babylon's SceneLoader.
   * Shared by loadPlacementMesh() and loadOne().
   */
  private async importMesh(
    path: string,
    data: ArrayBuffer,
    index: number,
  ): Promise<{ root: AbstractMesh; allMeshes: AbstractMesh[] }> {
    const ext = path.split(".").pop()?.replace(".", "").toLowerCase() ?? "glb";
    const dataUrl = `data:application/octet-stream;base64,${arrayBufferToBase64(data)}`;
    const extToLoader: Record<string, string> = {
      glb: ".glb", gltf: ".gltf", stl: ".stl", obj: ".obj", splat: ".splat", ply: ".ply",
    };
    const fileExt = extToLoader[ext] ?? `.${ext}`;

    const result = await SceneLoader.ImportMeshAsync(
      "",
      "",
      dataUrl,
      this.scene,
      undefined,
      fileExt,
    );
    if (result.meshes.length === 0) throw new Error(`No mesh in ${path}`);

    const root = result.meshes[0];
    const allMeshes = root.getChildMeshes(true);
    const cellMask = 1 << index;
    for (const m of allMeshes) m.layerMask = cellMask;
    if ((root as any).layerMask !== undefined) root.layerMask = cellMask;

    return { root, allMeshes };
  }

  private async loadPlacementMesh(
    placement: ModelPlacement,
    readFile: (path: string) => Promise<ArrayBuffer>,
    index: number,
  ): Promise<AbstractMesh[]> {
    const data = await readFile(placement.path);
    const { root, allMeshes } = await this.importMesh(placement.path, data, index);

    // Position in world space
    if (placement.position) {
      root.position = new Vector3(...placement.position);
    }
    if (placement.rotation) {
      root.rotation = new Vector3(...placement.rotation);
    }
    if (placement.scale !== undefined) {
      root.scaling = new Vector3(placement.scale, placement.scale, placement.scale);
    }

    return [root, ...allMeshes];
  }

  private createCameraFromDef(
    cellDef: CellLayout,
    anyMesh: AbstractMesh,
    globalIndex: number,
    sceneCenter?: Vector3,
    sceneRadius?: number,
  ): ArcRotateCamera {
    anyMesh.computeWorldMatrix(true);
    const bbox = anyMesh.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const meshRadius = diag.length() / 2;
    const meshCenter = bbox.min.add(diag.scale(0.5));
    const def = cellDef.camera;

    // Use scene-wide bounds if provided, otherwise per-mesh bounds
    const radius = sceneRadius ?? meshRadius;
    const target = def.target
      ? new Vector3(...def.target)
      : sceneCenter ?? meshCenter;

    const camera = new ArcRotateCamera(
      `cell-cam-${globalIndex}`,
      def.alpha,
      def.beta,
      radius * (def.radiusMultiplier ?? 2.5),
      target,
      this.scene,
    );
    camera.fov = ((def.fov ?? 45) * Math.PI) / 180;
    camera.minZ = radius * 0.001;
    camera.maxZ = radius * 20;
    camera.lowerRadiusLimit = radius * 0.05;
    camera.upperRadiusLimit = radius * 10;
    camera.wheelPrecision = 30;
    camera.viewport = new Viewport(
      cellDef.viewport.x,
      cellDef.viewport.y,
      cellDef.viewport.w,
      cellDef.viewport.h,
    );
    camera.layerMask = 1 << globalIndex;
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) camera.attachControl(canvas, true);
    this.initialCameras.push({
      alpha: camera.alpha, beta: camera.beta,
      radius: camera.radius, target: camera.target.clone(),
    });
    return camera;
  }

  private async loadOne(
    model: ModelConfig,
    readFile: (path: string) => Promise<ArrayBuffer>,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
    index: number,
  ): Promise<void> {
    const data = await readFile(model.path);
    const ext = model.path.split(".").pop()?.replace(".", "").toLowerCase() ?? "glb";
    const { root, allMeshes } = await this.importMesh(model.path, data, index);

    // Apply STL color if specified
    if (ext === "stl" && model.color) {
      const color = Color3.FromHexString(model.color);
      for (const m of allMeshes) {
        if (m.material instanceof StandardMaterial && m.material.name === "stl-mat") {
          m.material.diffuseColor = color;
        }
      }
    }

    // Apply wireframe if specified
    if (ext === "stl" && model.wireframe !== undefined) {
      for (const m of allMeshes) {
        if (m.material instanceof StandardMaterial) m.material.wireframe = model.wireframe;
      }
    }

    // Create camera for this cell
    const camera = this.createCellCamera(root, index, vx, vy, vw, vh);

    this.cells.push({ meshes: [root, ...allMeshes], camera });
  }

  private createCellCamera(
    root: AbstractMesh,
    index: number,
    vx: number,
    vy: number,
    vw: number,
    vh: number,
  ): ArcRotateCamera {
    root.computeWorldMatrix(true);
    const bbox = root.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const radius = diag.length() / 2;
    const center = bbox.min.add(diag.scale(0.5));

    const camera = new ArcRotateCamera(
      `cell-cam-${index}`,
      Math.PI / 4,
      Math.PI / 3,
      radius * 2.5,
      center,
      this.scene,
    );
    camera.fov = (45 * Math.PI) / 180;
    camera.minZ = radius * 0.001;
    camera.maxZ = radius * 20;
    camera.lowerRadiusLimit = radius * 0.05;
    camera.upperRadiusLimit = radius * 10;
    camera.wheelPrecision = 30;
    camera.viewport = new Viewport(vx, vy, vw, vh);
    camera.layerMask = 1 << index;
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) camera.attachControl(canvas, true);
    this.initialCameras.push({
      alpha: camera.alpha, beta: camera.beta,
      radius: camera.radius, target: camera.target.clone(),
    });
    return camera;
  }

  // ── Render ─────────────────────────────────────────────────────────

  private renderFrame(): void {
    const engine = this.engine;
    const scene = this.scene;
    engine.clear(scene.clearColor, true, true);
    for (const cell of this.cells) {
      engine.setViewport(cell.camera.viewport);
      const vp = cell.camera.viewport;
      const cw = engine.getRenderWidth();
      const ch = engine.getRenderHeight();
      engine.enableScissor(vp.x * cw, vp.y * ch, vp.width * cw, vp.height * ch);
      scene.activeCamera = cell.camera;
      scene.render();
      engine.disableScissor();
    }
  }

  private startRenderLoop(): void {
    if (this.rendering) return;
    this.rendering = true;
    this.engine.runRenderLoop(() => this.renderFrame());
  }

  // ── Public API ─────────────────────────────────────────────────────

  captureSnapshot(): string | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;
    this.renderFrame();
    return canvas.toDataURL("image/png");
  }

  getEngine(): Engine {
    return this.engine;
  }

  getScene(): Scene {
    return this.scene;
  }

  getCellCount(): number {
    return this.cells.length;
  }

  setRenderScale(scale: number): number {
    const clamped = Math.max(0.25, Math.min(scale, 2.0));
    const mobileBoost = isMobile() ? 1.5 : 1;
    this.engine.setHardwareScalingLevel(mobileBoost / clamped);
    return clamped;
  }

  resetView(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const cam = this.cells[i].camera;
      const init = this.initialCameras[i];
      if (init) {
        cam.alpha = init.alpha;
        cam.beta = init.beta;
        cam.radius = init.radius;
        cam.target = init.target.clone();
      }
    }
  }

  toggleWireframe(): boolean {
    this.wireframeEnabled = !this.wireframeEnabled;
    for (const cell of this.cells) {
      for (const m of cell.meshes) {
        if (m.material instanceof StandardMaterial) {
          m.material.wireframe = this.wireframeEnabled;
        }
      }
    }
    return this.wireframeEnabled;
  }

  exportModelInfo(): string {
    if (this.cells.length === 0) return "";
    const lines: string[] = [];
    lines.push("## Grid Models — Model Info");
    lines.push("");
    lines.push("| # | Model | Meshes | Triangles | Vertices | Materials |");
    lines.push("|---|-------|--------|-----------|----------|-----------|");

    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      const root = cell.meshes[0];
      if (!root) continue;
      const allMeshes = root.getChildMeshes(true);
      let tris = 0;
      let verts = 0;
      const mats = new Set<string>();
      for (const m of allMeshes.length > 0 ? allMeshes : [root]) {
        tris += Math.floor(m.getTotalIndices() / 3);
        verts += m.getTotalVertices();
        if (m.material) mats.add(m.material.name);
      }
      const name = root.name || `Model ${i + 1}`;
      lines.push(`| ${i + 1} | ${name} | ${allMeshes.length || 1} | ${tris.toLocaleString()} | ${verts.toLocaleString()} | ${mats.size} |`);
    }
    lines.push("");
    return lines.join("\n");
  }

  destroy(): void {
    this.engine.stopRenderLoop();
    for (const cell of this.cells) cell.camera.detachControl();
    const canvas = this.engine.getRenderingCanvas();
    canvas?.removeEventListener("wheel", this.preventCanvasWheelScroll);
    this.resizeObs.disconnect();
    this.scene.dispose();
    this.engine.dispose();
    this.cells = [];
  }
}

