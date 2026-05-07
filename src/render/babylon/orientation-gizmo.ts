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

const GIZMO_SIZE = 0.08; // fraction of canvas

/**
 * Small XYZ axis indicator rendered in the bottom-left corner.
 * Uses a separate Scene with its own camera that mirrors the main camera rotation.
 */
export class OrientationGizmo {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private viewport: Viewport;

  constructor(engine: Engine, mainCamera: MainCamera) {
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);

    // Fixed-distance camera looking at origin
    this.camera = new ArcRotateCamera("gizmo-cam", 0, 0, 5, Vector3.Zero(), this.scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 0.5;

    new HemisphericLight("gizmo-light", new Vector3(0, 1, 0.5), this.scene);

    // Create axis arrows: X=red, Y=green, Z=blue
    const axisDefs: [string, string, Vector3, Vector3][] = [
      ["x", "#e74c3c", new Vector3(0, 0, -Math.PI / 2), new Vector3(1, 0, 0)],
      ["y", "#2ecc71", new Vector3(0, 0, 0), new Vector3(0, 1, 0)],
      ["z", "#3498db", new Vector3(Math.PI / 2, 0, 0), new Vector3(0, 0, 1)],
    ];

    for (const [name, hex, rot, _dir] of axisDefs) {
      const shaft = MeshBuilder.CreateCylinder(`gizmo-${name}-shaft`, {
        height: 1.4, diameter: 0.08, tessellation: 8,
      }, this.scene);
      const head = MeshBuilder.CreateCylinder(`gizmo-${name}-head`, {
        height: 0.3, diameterTop: 0, diameterBottom: 0.2, tessellation: 8,
      }, this.scene);
      head.position.y = 0.85;

      const mat = new StandardMaterial(`gizmo-${name}-mat`, this.scene);
      mat.diffuseColor = Color3.FromHexString(hex);
      mat.emissiveColor = Color3.FromHexString(hex).scale(0.4);
      mat.disableLighting = true;
      shaft.material = mat;
      head.material = mat;

      shaft.rotation = rot;
      head.rotation = rot;
      shaft.position = rot.scale(0); // at origin
    }

    // Place at bottom-left
    const sz = GIZMO_SIZE;
    this.viewport = new Viewport(0.01, 0.01, sz, sz);

    this.syncWith(mainCamera);
  }

  /** Mirror the main camera's rotation so axes track orientation. */
  syncWith(mainCamera: MainCamera): void {
    this.camera.alpha = mainCamera.alpha;
    this.camera.beta = mainCamera.beta;
  }

  /** Render the gizmo overlay after the main scene. */
  render(engine: Engine): void {
    engine.setViewport(this.viewport);
    this.scene.render();
    engine.setViewport(new Viewport(0, 0, 1, 1));
  }

  dispose(): void {
    this.scene.dispose();
  }
}
