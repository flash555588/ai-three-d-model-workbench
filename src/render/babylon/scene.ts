import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { SpotLight } from "@babylonjs/core/Lights/spotLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { AutoRotationBehavior } from "@babylonjs/core/Behaviors/Cameras/autoRotationBehavior.js";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { Light } from "@babylonjs/core/Lights/light.js";
import { GaussianSplattingMesh } from "@babylonjs/core/Meshes/GaussianSplatting/gaussianSplattingMesh.js";
import type {
  ModelPreviewSummary,
  CameraConfig,
  LightConfig,
  SceneConfig,
  ThreeDBlockConfig,
} from "../../domain/models";
import "./loaders/register";
import { registerSTLLoader } from "./loaders/stl-loader";
import { registerPLYLoader } from "./loaders/ply-loader";
import { setExplode, resetExplode } from "./explode";
import { setupPicking } from "./picking";
import { arrayBufferToBase64 } from "../../utils/base64";

let stlRegistered = false;
let plyRegistered = false;

export class BabylonModelPreview {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private rootMesh: Mesh | null = null;
  private loadedExt: string = "";
  private frameId = 0;
  private cleanupPicking: (() => void) | null = null;
  private resizeObs: ResizeObserver;
  private configLights: Light[] = [];
  private shadowGenerator: ShadowGenerator | null = null;
  private groundMesh: Mesh | null = null;
  private gridMesh: Mesh | null = null;
  private axisMeshes: Mesh[] = [];
  private autoRotateBehavior: AutoRotationBehavior | null = null;
  private wireframeEnabled = false;
  private animPlaying = false;
  private initialCamera = { alpha: Math.PI / 4, beta: Math.PI / 3, radius: 5, target: Vector3.Zero() };

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.12, 0.12, 0.14, 1);

    this.camera = new ArcRotateCamera(
      "cam",
      Math.PI / 4,
      Math.PI / 3,
      5,
      Vector3.Zero(),
      this.scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 0.1;
    this.camera.wheelPrecision = 30;

    new HemisphericLight("default-light", new Vector3(0, 1, 0.5), this.scene);

    this.resizeObs = new ResizeObserver(() => this.engine.resize());
    this.resizeObs.observe(canvas);
    // Force a resize after the canvas is mounted and has layout dimensions
    requestAnimationFrame(() => this.engine.resize());
  }

  async loadModel(
    data: ArrayBuffer,
    ext: string,
    readFile?: (path: string) => Promise<ArrayBuffer>,
    modelPath?: string,
  ): Promise<ModelPreviewSummary> {
    if (!stlRegistered) {
      await registerSTLLoader();
      stlRegistered = true;
    }
    if (!plyRegistered) {
      await registerPLYLoader();
      plyRegistered = true;
    }

    if (this.rootMesh) {
      this.rootMesh.dispose(true, true);
      this.rootMesh = null;
    }

    const extLower = ext.toLowerCase().replace(".", "");
    this.loadedExt = extLower;
    const scene = this.scene;

    // Map extension to Babylon SceneLoader file extension
    const extToLoader: Record<string, string> = {
      glb: ".glb",
      gltf: ".gltf",
      stl: ".stl",
      obj: ".obj",
      splat: ".splat",
      ply: ".ply",
    };
    const fileExt = extToLoader[extLower] ?? `.${extLower}`;

    // Use data URL instead of blob URL — Obsidian's Electron converts
    // blob: URLs to blob:app://... which Babylon's GLTF loader cannot parse.
    const dataUrl = `data:application/octet-stream;base64,${arrayBufferToBase64(data)}`;

    // OBJ material injection: read MTL from vault and inject into Babylon OBJ loader
    let restoreOBJLoader: (() => void) | null = null;
    if (extLower === "obj" && readFile && modelPath) {
      restoreOBJLoader = await this.injectOBJMaterials(data, modelPath, readFile);
    }

    const result = await SceneLoader.ImportMeshAsync(
      "",
      "",
      dataUrl,
      scene,
      undefined,
      fileExt,
    );
    if (result.meshes.length > 0) {
      this.rootMesh = result.meshes[0] as Mesh;
    }

    // Restore OBJ loader's original _loadMTL
    restoreOBJLoader?.();

    if (!this.rootMesh) {
      throw new Error("No mesh found in model file");
    }

    this.rootMesh.computeWorldMatrix(true);
    const bbox = this.rootMesh.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const radius = diag.length() / 2;
    const center = bbox.min.add(diag.scale(0.5));

    this.camera.target = center;
    this.camera.radius = radius * 2.5;
    this.camera.lowerRadiusLimit = radius * 0.05;
    this.camera.upperRadiusLimit = radius * 10;
    this.camera.minZ = radius * 0.001;
    this.camera.maxZ = radius * 20;

    this.initialCamera = {
      alpha: this.camera.alpha,
      beta: this.camera.beta,
      radius: this.camera.radius,
      target: center.clone(),
    };

    this.startRenderLoop();
    this.engine.resize();

    this.cleanupPicking?.();
    this.cleanupPicking = setupPicking(this.scene, () => {});

    return this.computeSummary(this.rootMesh);
  }

  // ── Config application ───────────────────────────────────────────

  applyConfig(config: ThreeDBlockConfig): void {
    if (config.camera) this.applyCameraConfig(config.camera);
    if (config.lights) this.applyLightConfig(config.lights);
    if (config.scene) this.applySceneConfig(config.scene);
    if (config.stl && this.loadedExt === "stl") {
      if (config.stl.color) this.setSTLColor(config.stl.color);
      if (config.stl.wireframe !== undefined) this.setWireframe(config.stl.wireframe);
    }
  }

  applyCameraConfig(config: CameraConfig): void {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;

    if (config.mode === "orthographic") {
      const radius = this.camera.radius;
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const zoom = config.zoom ?? 1;
      const size = radius / zoom;

      this.camera.mode = 1; // orthographic
      this.camera.orthoLeft = -size * aspect;
      this.camera.orthoRight = size * aspect;
      this.camera.orthoTop = size;
      this.camera.orthoBottom = -size;
    } else {
      this.camera.mode = 0; // perspective
      if (config.fov) this.camera.fov = (config.fov * Math.PI) / 180;
    }

    if (config.position) {
      const [x, y, z] = config.position;
      this.camera.setPosition(new Vector3(x, y, z));
    }

    if (config.lookAt) {
      const [x, y, z] = config.lookAt;
      this.camera.setTarget(new Vector3(x, y, z));
    }

    if (config.near !== undefined) this.camera.minZ = config.near;
    if (config.far !== undefined) this.camera.maxZ = config.far;
  }

  applyLightConfig(lights: LightConfig[]): void {
    // Dispose previous config lights and shadow generator
    for (const light of this.configLights) {
      light.dispose();
    }
    this.configLights = [];
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;

    // Remove the default light when config lights are provided
    const defaultLight = this.scene.getLightByName("default-light");
    if (defaultLight) {
      defaultLight.dispose();
    }

    for (const cfg of lights) {
      const light = this.createLight(cfg);
      if (light) this.configLights.push(light);
    }
  }

  private createLight(cfg: LightConfig): Light | null {
    const color = cfg.color ? Color3.FromHexString(cfg.color) : Color3.White();
    const intensity = cfg.intensity ?? 1;

    switch (cfg.type) {
      case "hemisphere": {
        const ground = cfg.groundColor
          ? Color3.FromHexString(cfg.groundColor)
          : new Color3(0.2, 0.2, 0.2);
        const l = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
        l.diffuse = color;
        l.groundColor = ground;
        l.intensity = intensity;
        return l;
      }
      case "directional": {
        const dir = cfg.position
          ? new Vector3(...cfg.position).normalize()
          : new Vector3(-1, -2, -1).normalize();
        const l = new DirectionalLight("dir", dir, this.scene);
        l.diffuse = color;
        l.intensity = intensity;
        if (cfg.castShadow && this.rootMesh) {
          this.setupShadow(l);
        }
        return l;
      }
      case "point": {
        const pos = cfg.position ? new Vector3(...cfg.position) : new Vector3(0, 5, 0);
        const l = new PointLight("point", pos, this.scene);
        l.diffuse = color;
        l.intensity = intensity;
        if (cfg.decay !== undefined) (l as any).decay = cfg.decay;
        return l;
      }
      case "spot": {
        const pos = cfg.position ? new Vector3(...cfg.position) : new Vector3(0, 5, 0);
        const target = cfg.target ? new Vector3(...cfg.target) : Vector3.Zero();
        const dir = target.subtract(pos).normalize();
        const angle = cfg.angle ? (cfg.angle * Math.PI) / 180 : Math.PI / 4;
        const penumbra = cfg.penumbra ?? 0.5;
        const l = new SpotLight("spot", pos, dir, angle, penumbra, this.scene);
        l.diffuse = color;
        l.intensity = intensity;
        if (cfg.decay !== undefined) (l as any).decay = cfg.decay;
        if (cfg.castShadow && this.rootMesh) {
          this.setupShadow(l);
        }
        return l;
      }
      case "attachToCam": {
        const l = new PointLight("cam-light", Vector3.Zero(), this.scene);
        l.diffuse = color;
        l.intensity = intensity;
        l.parent = this.camera;
        return l;
      }
      default:
        return null;
    }
  }

  private setupShadow(light: Light): void {
    if (!this.rootMesh) return;
    const sg = new ShadowGenerator(1024, light as any);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 32;
    const children = this.rootMesh.getChildMeshes(true);
    for (const m of children) {
      sg.addShadowCaster(m);
      m.receiveShadows = true;
    }
    this.shadowGenerator = sg;
  }

  applySceneConfig(config: SceneConfig): void {
    if (config.background !== undefined) {
      const c = Color4.FromColor3(Color3.FromHexString(config.background), config.transparent ? 0 : 1);
      this.scene.clearColor = c;
    }

    if (config.autoRotate) {
      if (!this.autoRotateBehavior) {
        this.autoRotateBehavior = new AutoRotationBehavior();
        this.autoRotateBehavior.idleRotationSpeed = config.autoRotateSpeed ?? 0.5;
        this.autoRotateBehavior.idleRotationWaitTime = 1000;
        this.autoRotateBehavior.idleRotationSpinupTime = 500;
        this.camera.addBehavior(this.autoRotateBehavior);
      } else {
        this.autoRotateBehavior.idleRotationSpeed = config.autoRotateSpeed ?? 0.5;
      }
    }

    if (config.groundShadow && this.rootMesh) {
      this.createGround();
    }

    if (config.grid) {
      this.createGrid();
    }

    if (config.axis) {
      this.createAxis();
    }
  }

  private createGround(): void {
    if (this.groundMesh) return;
    const bbox = this.rootMesh!.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const size = Math.max(diag.x, diag.z) * 3;
    const y = bbox.min.y;

    this.groundMesh = MeshBuilder.CreateGround("ground", { width: size, height: size }, this.scene);
    this.groundMesh.position.y = y;
    const mat = new StandardMaterial("ground-mat", this.scene);
    mat.diffuseColor = new Color3(0.15, 0.15, 0.15);
    mat.specularColor = Color3.Black();
    mat.alpha = 0.5;
    this.groundMesh.material = mat;
    this.groundMesh.receiveShadows = true;
  }

  private createGrid(): void {
    if (this.gridMesh) return;
    const bbox = this.rootMesh!.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const size = Math.max(diag.x, diag.z) * 2;
    const y = bbox.min.y - 0.01;

    this.gridMesh = MeshBuilder.CreateGround("grid", { width: size, height: size, subdivisions: 20 }, this.scene);
    this.gridMesh.position.y = y;
    const mat = new StandardMaterial("grid-mat", this.scene);
    mat.wireframe = true;
    mat.diffuseColor = new Color3(0.3, 0.3, 0.3);
    mat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    this.gridMesh.material = mat;
  }

  private createAxis(): void {
    if (this.axisMeshes.length > 0) return;
    const bbox = this.rootMesh!.getHierarchyBoundingVectors();
    const diag = bbox.max.subtract(bbox.min);
    const len = Math.max(diag.x, diag.y, diag.z) * 1.5;
    const origin = bbox.min;

    const axes: [string, Color3, Vector3][] = [
      ["x", Color3.Red(), new Vector3(len, 0, 0)],
      ["y", Color3.Green(), new Vector3(0, len, 0)],
      ["z", Color3.Blue(), new Vector3(0, 0, len)],
    ];

    for (const [name, color, dir] of axes) {
      const tube = MeshBuilder.CreateTube(`axis-${name}`, {
        path: [origin, origin.add(dir)],
        radius: diag.length() * 0.005,
        tessellation: 8,
      }, this.scene);
      const mat = new StandardMaterial(`axis-${name}-mat`, this.scene);
      mat.emissiveColor = color;
      mat.diffuseColor = Color3.Black();
      tube.material = mat;
      this.axisMeshes.push(tube);
    }
  }

  setSTLColor(hex: string): void {
    if (!this.rootMesh) return;
    const color = Color3.FromHexString(hex);
    const children = this.rootMesh.getChildMeshes(true);
    for (const m of children) {
      if (m.material && m.material.name === "stl-mat") {
        (m.material as StandardMaterial).diffuseColor = color;
      }
    }
  }

  setWireframe(enabled: boolean): void {
    if (!this.rootMesh) return;
    this.wireframeEnabled = enabled;
    const children = this.rootMesh.getChildMeshes(true);
    for (const m of children) {
      if (m.material) {
        (m.material as StandardMaterial).wireframe = enabled;
      }
    }
  }

  toggleWireframe(): boolean {
    this.setWireframe(!this.wireframeEnabled);
    return this.wireframeEnabled;
  }

  hasAnimations(): boolean {
    return this.scene.animationGroups.length > 0;
  }

  toggleAnimation(): boolean {
    const groups = this.scene.animationGroups;
    if (groups.length === 0) return false;
    this.animPlaying = !this.animPlaying;
    for (const g of groups) {
      if (this.animPlaying) {
        g.play(true);
      } else {
        g.pause();
      }
    }
    return this.animPlaying;
  }

  setAnimationSpeed(speed: number): void {
    for (const g of this.scene.animationGroups) {
      g.speedRatio = speed;
    }
  }

  captureSnapshot(): string | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;
    this.scene.render();
    return canvas.toDataURL("image/png");
  }

  // ── Existing API ─────────────────────────────────────────────────

  setExplode(factor: number, axis: "x" | "y" | "z") {
    if (this.rootMesh) setExplode(this.rootMesh, factor, axis);
  }

  resetExplode() {
    if (this.rootMesh) resetExplode(this.rootMesh);
  }

  resetView(): void {
    if (this.rootMesh) resetExplode(this.rootMesh);
    this.camera.mode = 0; // perspective
    this.camera.alpha = this.initialCamera.alpha;
    this.camera.beta = this.initialCamera.beta;
    this.camera.radius = this.initialCamera.radius;
    this.camera.target = this.initialCamera.target.clone();
  }

  exportModelInfo(modelPath?: string): string {
    if (!this.rootMesh) return "";
    const summary = this.computeSummary(this.rootMesh);
    const allMeshes = this.rootMesh.getChildMeshes(true);
    const isSplat = this.rootMesh instanceof GaussianSplattingMesh;
    const ext = this.loadedExt.toUpperCase();

    const name = modelPath?.split("/").pop() ?? summary.rootName;
    const countLabel = isSplat ? "Splats" : "Triangles";

    const lines: string[] = [];
    lines.push(`## ${name} — Model Info`);
    lines.push("");
    lines.push("| Property | Value |");
    lines.push("|----------|-------|");
    lines.push(`| Format | ${ext} |`);
    lines.push(`| Meshes | ${summary.meshCount} |`);
    lines.push(`| ${countLabel} | ${(summary.splatCount ?? summary.triangleCount).toLocaleString()} |`);
    lines.push(`| Vertices | ${summary.vertexCount.toLocaleString()} |`);
    lines.push(`| Materials | ${summary.materialCount} |`);
    lines.push(`| Bounding Size | ${summary.boundingSize.x.toFixed(3)} x ${summary.boundingSize.y.toFixed(3)} x ${summary.boundingSize.z.toFixed(3)} |`);
    lines.push("");

    // Per-mesh breakdown (skip if > 50 meshes to avoid noise)
    if (allMeshes.length > 1 && allMeshes.length <= 50) {
      lines.push("### Mesh Breakdown");
      lines.push("");
      lines.push("| # | Name | Triangles | Vertices | Material |");
      lines.push("|---|------|-----------|----------|----------|");
      for (let i = 0; i < allMeshes.length; i++) {
        const m = allMeshes[i];
        const tris = isSplat ? "—" : Math.floor(m.getTotalIndices() / 3).toLocaleString();
        const verts = m.getTotalVertices().toLocaleString();
        const mat = m.material?.name ?? "—";
        lines.push(`| ${i + 1} | ${m.name} | ${tris} | ${verts} | ${mat} |`);
      }
      lines.push("");
    }

    // Material list
    const matNames = new Set<string>();
    for (const m of allMeshes) {
      if (m.material) matNames.add(m.material.name);
    }
    if (matNames.size > 0) {
      lines.push("### Materials");
      lines.push("");
      for (const name of matNames) {
        lines.push(`- ${name}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  getRootMesh(): Mesh | null {
    return this.rootMesh;
  }

  getScene(): Scene {
    return this.scene;
  }

  getEngine(): Engine {
    return this.engine;
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    this.cleanupPicking?.();
    this.cleanupPicking = null;
    this.resizeObs.disconnect();
    if (this.autoRotateBehavior) {
      this.camera.removeBehavior(this.autoRotateBehavior);
      this.autoRotateBehavior = null;
    }
    for (const l of this.configLights) l.dispose();
    this.configLights = [];
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    this.groundMesh?.dispose();
    this.groundMesh = null;
    this.gridMesh?.dispose();
    this.gridMesh = null;
    for (const a of this.axisMeshes) a.dispose();
    this.axisMeshes = [];
    this.scene.dispose();
    this.engine.dispose();
  }

  private startRenderLoop() {
    cancelAnimationFrame(this.frameId);
    const loop = () => {
      this.scene.render();
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
  }

  /**
   * OBJ material injection: read MTL file from vault and override Babylon's OBJ loader
   * to use the vault content instead of fetching from a non-existent URL.
   * Returns a restore function to undo the loader override.
   */
  private async injectOBJMaterials(
    objData: ArrayBuffer,
    modelPath: string,
    readFile: (path: string) => Promise<ArrayBuffer>,
  ): Promise<(() => void) | null> {
    // Parse mtllib reference from OBJ text
    const objText = new TextDecoder().decode(new Uint8Array(objData));
    const mtlMatch = objText.match(/mtllib\s+(.+)/);
    if (!mtlMatch) return null;

    const mtlFilename = mtlMatch[1].trim().split(/\s+/)[0]; // take first file if multiple
    const modelDir = modelPath.includes("/") ? modelPath.slice(0, modelPath.lastIndexOf("/")) : "";
    const mtlPath = modelDir ? `${modelDir}/${mtlFilename}` : mtlFilename;

    try {
      const mtlData = await readFile(mtlPath);
      const mtlText = new TextDecoder().decode(new Uint8Array(mtlData));

      // Override OBJFileLoader._loadMTL to return vault content directly
      const { OBJFileLoader } = await import("@babylonjs/loaders/OBJ/objFileLoader.js");
      const proto = OBJFileLoader.prototype as any;
      const original = proto._loadMTL;
      proto._loadMTL = function (
        _url: string,
        _rootUrl: string,
        onSuccess: (data: string) => void,
      ) {
        onSuccess(mtlText);
      };

      console.log(`[AI3D] Injected MTL: ${mtlPath}`);
      return () => { proto._loadMTL = original; };
    } catch {
      // MTL file not found — OBJ will render with default material
      console.debug(`[AI3D] No MTL file found at ${mtlPath}, using default material`);
      return null;
    }
  }

  private computeSummary(root: Mesh): ModelPreviewSummary {
    const allMeshes = root.getChildMeshes(true);
    let triangleCount = 0;
    let vertexCount = 0;
    const materials = new Set<string>();

    const isSplat = root instanceof GaussianSplattingMesh;

    for (const m of allMeshes) {
      const indices = m.getTotalIndices();
      const verts = m.getTotalVertices();
      triangleCount += Math.floor(indices / 3);
      vertexCount += verts;
      if (m.material) materials.add(m.material.name);
    }

    // SPLAT has no index buffer — report splat count separately
    const splatCount = isSplat ? vertexCount : undefined;

    const bbox = root.getHierarchyBoundingVectors();
    const size = bbox.max.subtract(bbox.min);

    return {
      meshCount: allMeshes.length,
      triangleCount,
      splatCount,
      vertexCount,
      materialCount: materials.size,
      boundingSize: { x: size.x, y: size.y, z: size.z },
      rootName: root.name,
    };
  }
}
