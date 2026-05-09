import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Viewport } from "@babylonjs/core/Maths/math.viewport.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import type { Engine } from "@babylonjs/core/Engines/engine.js";
import type { ArcRotateCamera as MainCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";

const GIZMO_SIZE = 0.32;
const AXIS_LENGTH = 1.05;
const SHAFT_DIAMETER = 0.075;
const HEAD_LENGTH = 0.28;
const HEAD_DIAMETER = 0.22;
const ORIGIN_DIAMETER = 0.16;
const CAMERA_TARGET_OFFSET = (AXIS_LENGTH + HEAD_LENGTH) * 0.42;
const CAMERA_TARGET = new Vector3(CAMERA_TARGET_OFFSET, CAMERA_TARGET_OFFSET, CAMERA_TARGET_OFFSET);

const AXIS_DEFS: { name: string; color: string; rot: Vector3; dir: Vector3 }[] = [
  { name: "x", color: "#e74c3c", rot: new Vector3(0, 0, -Math.PI / 2), dir: new Vector3(1, 0, 0) },
  { name: "y", color: "#2ecc71", rot: new Vector3(0, 0, 0), dir: new Vector3(0, 1, 0) },
  { name: "z", color: "#3498db", rot: new Vector3(Math.PI / 2, 0, 0), dir: new Vector3(0, 0, 1) },
];

function makeEmissiveMat(name: string, hex: string, scene: Scene): StandardMaterial {
  const c = Color3.FromHexString(hex);
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = c;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.backFaceCulling = false;
  return m;
}

function makeOriginMat(scene: Scene): StandardMaterial {
  const m = new StandardMaterial("gizmo-origin-mat", scene);
  m.emissiveColor = new Color3(0.72, 0.78, 0.86);
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  return m;
}

/**
 * Small XYZ axis indicator rendered in the bottom-left corner.
 * Uses a separate Scene with its own camera that mirrors the main camera rotation.
 */
export class OrientationGizmo {
  private engine: Engine;
  private scene: Scene;
  private camera: ArcRotateCamera;
  private viewport: Viewport;

  constructor(engine: Engine, mainCamera: MainCamera) {
    this.engine = engine;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);
    this.scene.autoClear = false;

    this.camera = new ArcRotateCamera("gizmo-cam", 0, 0, 4.1, CAMERA_TARGET, this.scene);
    this.camera.minZ = 0.01;
    this.camera.fov = 0.56;
    this.camera.detachControl();

    new HemisphericLight("gizmo-light", new Vector3(0, 1, 0.5), this.scene);

    const origin = MeshBuilder.CreateSphere("gizmo-origin", { diameter: ORIGIN_DIAMETER, segments: 16 }, this.scene);
    origin.material = makeOriginMat(this.scene);

    for (const { name, color, rot, dir } of AXIS_DEFS) {
      const mat = makeEmissiveMat(`gizmo-${name}-mat`, color, this.scene);

      // Shaft
      const shaft = MeshBuilder.CreateCylinder(`gizmo-${name}-shaft`, {
        height: AXIS_LENGTH, diameter: SHAFT_DIAMETER, tessellation: 8,
      }, this.scene);
      shaft.material = mat;
      shaft.position = dir.scale(AXIS_LENGTH / 2);
      shaft.rotation = rot;

      // Arrow head
      const head = MeshBuilder.CreateCylinder(`gizmo-${name}-head`, {
        height: HEAD_LENGTH, diameterTop: 0, diameterBottom: HEAD_DIAMETER, tessellation: 8,
      }, this.scene);
      head.material = mat;
      // Babylon cylinders are Y-aligned; rotation changes orientation, position must use world axis direction.
      const headOffset = AXIS_LENGTH + HEAD_LENGTH / 2;
      head.position = dir.scale(headOffset);
      head.rotation = rot;
    }

    const sz = GIZMO_SIZE;
    this.viewport = new Viewport(0.02, 0.03, sz, sz);
    this.camera.viewport = this.viewport;
    this.syncWith(mainCamera);
  }

  syncWith(mainCamera: MainCamera): void {
    this.camera.alpha = mainCamera.alpha;
    this.camera.beta = mainCamera.beta;
  }

  render(): void {
    const renderWidth = this.engine.getRenderWidth();
    const renderHeight = this.engine.getRenderHeight();
    const x = this.viewport.x * renderWidth;
    const y = this.viewport.y * renderHeight;
    const width = this.viewport.width * renderWidth;
    const height = this.viewport.height * renderHeight;

    this.engine.enableScissor(x, y, width, height);
    this.engine.clear(null, false, true, true);
    this.scene.render();
    this.engine.disableScissor();
  }

  dispose(): void {
    this.scene.dispose();
  }
}
