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

  let zeroNormalCount = 0;
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const base = i * 9;
    const iBase = i * 3;

    // Skip the stored normal (12 bytes) — will recompute from vertices
    offset += 12;

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

    // Recompute face normal from triangle vertices (cross product of two edges)
    const ax = positions[base + 3] - positions[base + 0];
    const ay = positions[base + 4] - positions[base + 1];
    const az = positions[base + 5] - positions[base + 2];
    const bx = positions[base + 6] - positions[base + 0];
    const by = positions[base + 7] - positions[base + 1];
    const bz = positions[base + 8] - positions[base + 2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-8) {
      nx /= len; ny /= len; nz /= len;
    } else {
      nx = 0; ny = 0; nz = 1;
      zeroNormalCount++;
    }
    // Assign same normal to all 3 vertices of the triangle (flat shading)
    normals[base + 0] = nx; normals[base + 1] = ny; normals[base + 2] = nz;
    normals[base + 3] = nx; normals[base + 4] = ny; normals[base + 5] = nz;
    normals[base + 6] = nx; normals[base + 7] = ny; normals[base + 8] = nz;

    indices[iBase + 0] = base / 3 + 0;
    indices[iBase + 1] = base / 3 + 1;
    indices[iBase + 2] = base / 3 + 2;
  }

  if (zeroNormalCount > 0) {
    console.warn(`[AI3D STL] ${zeroNormalCount} degenerate triangles with zero-area normals`);
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;

  const mesh = new BabylonMesh("stl-model", scene);
  vertexData.applyToMesh(mesh);

  const mat = new StandardMaterial("stl-mat", scene);
  mat.diffuseColor = new Color3(0.85, 0.85, 0.85);
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mat.specularPower = 32;
  mat.emissiveColor = new Color3(0.1, 0.1, 0.1);
  mat.backFaceCulling = false;
  mesh.material = mat;

  return mesh;
}

/**
 * Parse a binary STL ArrayBuffer and add the resulting mesh to a Scene.
 * Bypasses SceneLoader — works around Babylon v9 data-URL handling issues.
 */
export function loadSTLBuffer(scene: Scene, buffer: ArrayBuffer): Mesh {
  return parseBinarySTL(scene, buffer);
}

export async function registerSTLLoader() {
  const { SceneLoader } = await import("@babylonjs/core/Loading/sceneLoader.js");
  SceneLoader.RegisterPlugin(stlPlugin as any);
}
