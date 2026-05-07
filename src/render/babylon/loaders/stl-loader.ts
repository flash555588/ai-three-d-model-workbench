import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import type { AssetContainer } from "@babylonjs/core/assetContainer.js";

interface STLAsyncResult {
  meshes: AbstractMesh[];
  particleSystems: never[];
  skeletons: never[];
  animationGroups: never[];
  transformNodes: never[];
  geometries: never[];
  lights: never[];
  spriteManagers: never[];
}

interface STLAsyncPlugin {
  name: string;
  extensions: string;
  importMeshAsync: (
    meshNames: string | readonly string[] | null | undefined,
    scene: Scene,
    data: unknown,
    rootUrl: string,
  ) => Promise<STLAsyncResult>;
  loadAsync: (scene: Scene, data: unknown, rootUrl: string) => Promise<void>;
  loadAssetContainerAsync: (scene: Scene, data: unknown, rootUrl: string) => Promise<AssetContainer>;
  canDirectLoad: (data: string) => boolean;
  rewriteRootURL: (rootUrl: string) => string;
}

const stlPlugin: STLAsyncPlugin = {
  name: "stl",
  extensions: ".stl",

  importMeshAsync(_meshNames, scene, data) {
    return Promise.resolve().then(() => {
      const mesh = parseBinarySTL(scene, data as ArrayBuffer);
      return {
        meshes: [mesh],
        particleSystems: [],
        skeletons: [],
        animationGroups: [],
        transformNodes: [],
        geometries: [],
        lights: [],
        spriteManagers: [],
      };
    });
  },

  loadAsync(scene, data) {
    return Promise.resolve().then(() => {
      parseBinarySTL(scene, data as ArrayBuffer);
    });
  },

  loadAssetContainerAsync(scene, data) {
    const { AssetContainer } = require("@babylonjs/core/assetContainer.js") as typeof import("@babylonjs/core/assetContainer.js");
    return Promise.resolve().then(() => {
      const mesh = parseBinarySTL(scene, data as ArrayBuffer);
      const container = new AssetContainer(scene);
      container.meshes.push(mesh);
      if (mesh.material) container.materials.push(mesh.material);
      return container;
    });
  },

  canDirectLoad() { return false; },
  rewriteRootURL(rootUrl) { return rootUrl; },
};

function parseBinarySTL(scene: Scene, buffer: ArrayBuffer): Mesh {
  const { VertexData } = require("@babylonjs/core/Meshes/mesh.vertexData.js") as typeof import("@babylonjs/core/Meshes/mesh.vertexData.js");
  const { Mesh: BabylonMesh } = require("@babylonjs/core/Meshes/mesh.js") as typeof import("@babylonjs/core/Meshes/mesh.js");
  const { StandardMaterial } = require("@babylonjs/core/Materials/standardMaterial.js") as typeof import("@babylonjs/core/Materials/standardMaterial.js");
  const { Color3 } = require("@babylonjs/core/Maths/math.color.js") as typeof import("@babylonjs/core/Maths/math.color.js");

  if (buffer.byteLength < 84) {
    throw new Error(`STL buffer too small: ${buffer.byteLength} bytes (need 84+)`);
  }

  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  console.log(`[AI3D STL] Parsing ${buffer.byteLength} bytes, ${triangleCount} triangles`);

  if (triangleCount === 0) {
    throw new Error("STL file contains 0 triangles");
  }

  const expectedSize = 84 + triangleCount * 50;
  if (buffer.byteLength < expectedSize) {
    throw new Error(`STL buffer truncated: expected ${expectedSize} bytes, got ${buffer.byteLength}`);
  }

  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const indices = new Uint32Array(triangleCount * 3);

  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const base = i * 9;
    const iBase = i * 3;

    normals[base + 0] = view.getFloat32(offset, true); offset += 4;
    normals[base + 1] = view.getFloat32(offset, true); offset += 4;
    normals[base + 2] = view.getFloat32(offset, true); offset += 4;

    positions[base + 0] = view.getFloat32(offset, true); offset += 4;
    positions[base + 1] = view.getFloat32(offset, true); offset += 4;
    positions[base + 2] = view.getFloat32(offset, true); offset += 4;

    positions[base + 3] = view.getFloat32(offset, true); offset += 4;
    positions[base + 4] = view.getFloat32(offset, true); offset += 4;
    positions[base + 5] = view.getFloat32(offset, true); offset += 4;

    positions[base + 6] = view.getFloat32(offset, true); offset += 4;
    positions[base + 7] = view.getFloat32(offset, true); offset += 4;
    positions[base + 8] = view.getFloat32(offset, true); offset += 4;

    offset += 2;

    indices[iBase + 0] = base / 3 + 0;
    indices[iBase + 1] = base / 3 + 1;
    indices[iBase + 2] = base / 3 + 2;
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;

  const mesh = new BabylonMesh("stl-model", scene);
  vertexData.applyToMesh(mesh);

  const mat = new StandardMaterial("stl-mat", scene);
  mat.diffuseColor = new Color3(0.7, 0.7, 0.7);
  mat.backFaceCulling = false;
  mesh.material = mat;

  return mesh;
}

export async function registerSTLLoader() {
  const { SceneLoader } = await import("@babylonjs/core/Loading/sceneLoader.js");
  SceneLoader.RegisterPlugin(stlPlugin as any);
}
