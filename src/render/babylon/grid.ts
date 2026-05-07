import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Viewport } from "@babylonjs/core/Maths/math.viewport.js";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { ModelConfig, GridBlockConfig, ModelPlacement, PresetCameraDef, CellLayout, PresetResult } from "../../domain/models";
import "./loaders/register";
import { registerSTLLoader } from "./loaders/stl-loader";
import { registerPLYLoader } from "./loaders/ply-loader";
import { isMobile, hardwareScale } from "../../utils/device";

let stlRegistered = false;
let plyRegistered = false;

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
  private frameId = 0;
  private resizeObs: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
    if (isMobile()) this.engine.setHardwareScalingLevel(hardwareScale());
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
    if (!stlRegistered) {
      await registerSTLLoader();
      stlRegistered = true;
    }
    if (!plyRegistered) {
      await registerPLYLoader();
      plyRegistered = true;
    }

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
    if (!stlRegistered) {
      await registerSTLLoader();
      stlRegistered = true;
    }
    if (!plyRegistered) {
      await registerPLYLoader();
      plyRegistered = true;
    }

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
        // Multi-cell: collect placements referenced by cells sharing this viewport
        const seen = new Set<number>();
        cellMeshes = [];
        for (const otherCell of result.cells) {
          if (
            otherCell.viewport.x === cellDef.viewport.x &&
            otherCell.viewport.y === cellDef.viewport.y &&
            !seen.has(otherCell.modelIndex)
          ) {
            seen.add(otherCell.modelIndex);
            const m = loadedMeshes[otherCell.modelIndex];
            if (m) cellMeshes.push(...m);
          }
        }
        combinedMask = 0;
        for (const idx of seen) combinedMask |= 1 << idx;
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
    readFile?: (path: string) => Promise<ArrayBuffer>,
  ): Promise<{ root: AbstractMesh; allMeshes: AbstractMesh[] }> {
    const ext = path.split(".").pop()?.replace(".", "").toLowerCase() ?? "glb";
    const dataUrl = `data:application/octet-stream;base64,${arrayBufferToBase64(data)}`;
    const extToLoader: Record<string, string> = {
      glb: ".glb", gltf: ".gltf", stl: ".stl", obj: ".obj", splat: ".splat", ply: ".ply",
    };
    const fileExt = extToLoader[ext] ?? `.${ext}`;

    // OBJ material injection
    let restoreOBJ: (() => void) | null = null;
    if (ext === "obj" && readFile) {
      restoreOBJ = await injectOBJMTL(data, path, readFile);
    }

    const result = await SceneLoader.ImportMeshAsync(
      "",
      "",
      dataUrl,
      this.scene,
      undefined,
      fileExt,
    );
    restoreOBJ?.();
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
    const { root, allMeshes } = await this.importMesh(placement.path, data, index, readFile);

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
    const { root, allMeshes } = await this.importMesh(model.path, data, index, readFile);

    // Apply STL color if specified
    if (ext === "stl" && model.color) {
      const { Color3 } = await import("@babylonjs/core/Maths/math.color.js");
      const color = Color3.FromHexString(model.color);
      for (const m of allMeshes) {
        if (m.material && m.material.name === "stl-mat") {
          (m.material as any).diffuseColor = color;
        }
      }
    }

    // Apply wireframe if specified
    if (ext === "stl" && model.wireframe !== undefined) {
      for (const m of allMeshes) {
        if (m.material) (m.material as any).wireframe = model.wireframe;
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
    return camera;
  }

  // ── Render ─────────────────────────────────────────────────────────

  private startRenderLoop(): void {
    cancelAnimationFrame(this.frameId);
    const scene = this.scene;
    const engine = this.engine;
    const cells = this.cells;

    const loop = () => {
      // Clear the full canvas once
      engine.clear(scene.clearColor, true, true);

      for (const cell of cells) {
        // Set viewport and scissor for this cell
        engine.setViewport(cell.camera.viewport);
        const vp = cell.camera.viewport;
        const cw = engine.getRenderWidth();
        const ch = engine.getRenderHeight();
        engine.enableScissor(vp.x * cw, vp.y * ch, vp.width * cw, vp.height * ch);

        // Show only this cell's meshes
        for (const c of cells) {
          for (const m of c.meshes) m.isVisible = c === cell;
        }
        scene.activeCamera = cell.camera;
        scene.render();

        engine.disableScissor();
      }

      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  // ── Public API ─────────────────────────────────────────────────────

  captureSnapshot(): string | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;
    const scene = this.scene;
    const engine = this.engine;

    engine.clear(scene.clearColor, true, true);
    for (const cell of this.cells) {
      engine.setViewport(cell.camera.viewport);
      const vp = cell.camera.viewport;
      const cw = engine.getRenderWidth();
      const ch = engine.getRenderHeight();
      engine.enableScissor(vp.x * cw, vp.y * ch, vp.width * cw, vp.height * ch);

      for (const c of this.cells) {
        for (const m of c.meshes) m.isVisible = c === cell;
      }
      scene.activeCamera = cell.camera;
      scene.render();
      engine.disableScissor();
    }

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

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObs.disconnect();
    this.scene.dispose();
    this.engine.dispose();
    this.cells = [];
  }
}

// ── OBJ Material Injection ──────────────────────────────────────────

async function injectOBJMTL(
  objData: ArrayBuffer,
  modelPath: string,
  readFile: (path: string) => Promise<ArrayBuffer>,
): Promise<(() => void) | null> {
  const objText = new TextDecoder().decode(new Uint8Array(objData));
  const mtlMatch = objText.match(/mtllib\s+(.+)/);
  if (!mtlMatch) return null;

  const mtlFilename = mtlMatch[1].trim().split(/\s+/)[0];
  const modelDir = modelPath.includes("/") ? modelPath.slice(0, modelPath.lastIndexOf("/")) : "";
  const mtlPath = modelDir ? `${modelDir}/${mtlFilename}` : mtlFilename;

  try {
    const mtlData = await readFile(mtlPath);
    const mtlText = new TextDecoder().decode(new Uint8Array(mtlData));
    const { OBJFileLoader } = await import("@babylonjs/loaders/OBJ/objFileLoader.js");
    const proto = OBJFileLoader.prototype as any;
    const original = proto._loadMTL;
    proto._loadMTL = function (
      _url: string, _rootUrl: string, onSuccess: (data: string) => void,
    ) { onSuccess(mtlText); };
    console.log(`[AI3D Grid] Injected MTL: ${mtlPath}`);
    return () => { proto._loadMTL = original; };
  } catch {
    console.debug(`[AI3D Grid] No MTL found at ${mtlPath}`);
    return null;
  }
}

// ── Utilities ────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}
