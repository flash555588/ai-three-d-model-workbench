import { Scene } from "@babylonjs/core/scene.js";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Viewport } from "@babylonjs/core/Maths/math.viewport.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import type { Engine } from "@babylonjs/core/Engines/engine.js";
import type { ArcRotateCamera as MainCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";

const GIZMO_SIZE = 0.12;
const AXIS_LENGTH = 1.0;
const SHAFT_DIAMETER = 0.06;
const HEAD_LENGTH = 0.25;
const HEAD_DIAMETER = 0.18;
const LABEL_OFFSET = 0.15;

const AXIS_DEFS: { name: string; color: string; rot: Vector3; labelPos: Vector3 }[] = [
  { name: "x", color: "#e74c3c", rot: new Vector3(0, 0, -Math.PI / 2), labelPos: new Vector3(AXIS_LENGTH + LABEL_OFFSET, 0, 0) },
  { name: "y", color: "#2ecc71", rot: new Vector3(0, 0, 0),            labelPos: new Vector3(0, AXIS_LENGTH + LABEL_OFFSET, 0) },
  { name: "z", color: "#3498db", rot: new Vector3(Math.PI / 2, 0, 0),  labelPos: new Vector3(0, 0, AXIS_LENGTH + LABEL_OFFSET) },
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

function createLabelPlane(name: string, text: string, hex: string, scene: Scene): Mesh {
  const size = 0.35;
  const texSize = 64;
  const plane = MeshBuilder.CreatePlane(name, { width: size, height: size, sideOrientation: 2 }, scene);

  const tex = new DynamicTexture(`${name}-tex`, texSize, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, texSize, texSize);
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hex;
  ctx.fillText(text, texSize / 2, texSize / 2);
  tex.update();

  const mat = new StandardMaterial(`${name}-mat`, scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = Color3.FromHexString(hex);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.useAlphaFromDiffuseTexture = true;
  mat.backFaceCulling = false;
  (mat as unknown as Record<string, boolean>).hasAlpha = true;
  plane.material = mat;

  return plane;
}

/**
 * Small XYZ axis indicator rendered in the bottom-left corner.
 * Uses a separate Scene with its own camera that mirrors the main camera rotation.
 */
export class OrientationGizmo {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private viewport: Viewport;
  private labelPlanes: Mesh[] = [];

  constructor(engine: Engine, mainCamera: MainCamera) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.12, 0.6);

    this.camera = new ArcRotateCamera("gizmo-cam", 0, 0, 4, Vector3.Zero(), this.scene);
    this.camera.minZ = 0.01;
    this.camera.fov = 0.6;
    this.camera.detachControl();

    new HemisphericLight("gizmo-light", new Vector3(0, 1, 0.5), this.scene);

    for (const { name, color, rot, labelPos } of AXIS_DEFS) {
      const mat = makeEmissiveMat(`gizmo-${name}-mat`, color, this.scene);

      // Shaft
      const shaft = MeshBuilder.CreateCylinder(`gizmo-${name}-shaft`, {
        height: AXIS_LENGTH, diameter: SHAFT_DIAMETER, tessellation: 8,
      }, this.scene);
      shaft.material = mat;
      shaft.rotation = rot;

      // Arrow head
      const head = MeshBuilder.CreateCylinder(`gizmo-${name}-head`, {
        height: HEAD_LENGTH, diameterTop: 0, diameterBottom: HEAD_DIAMETER, tessellation: 8,
      }, this.scene);
      head.material = mat;
      // Position head at shaft end: (AXIS_LENGTH/2 + HEAD_LENGTH/2) in local Y, then rotate
      const headOffset = AXIS_LENGTH / 2 + HEAD_LENGTH / 2;
      head.position.y = headOffset;
      head.rotation = rot;

      // Label (billboard toward camera)
      const label = createLabelPlane(`gizmo-${name}-label`, name.toUpperCase(), color, this.scene);
      label.position = labelPos;
      label.billboardMode = 7; // BILLBOARDMODE_ALL — always face camera
      this.labelPlanes.push(label);
    }

    const sz = GIZMO_SIZE;
    this.viewport = new Viewport(0.01, 0.01, sz, sz);
    this.syncWith(mainCamera);
  }

  syncWith(mainCamera: MainCamera): void {
    this.camera.alpha = mainCamera.alpha;
    this.camera.beta = mainCamera.beta;
  }

  render(engine: Engine): void {
    engine.setViewport(this.viewport);
    this.scene.render();
    engine.setViewport(new Viewport(0, 0, 1, 1));
  }

  dispose(): void {
    this.scene.dispose();
  }
}
