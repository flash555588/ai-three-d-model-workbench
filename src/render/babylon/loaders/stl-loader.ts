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

  // Detect ASCII STL (starts with "solid" followed by "facet" or "endsolid")
  if (buffer.byteLength >= 6) {
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 6));
    if (header === "solid " || header === "solid\n") {
      const preview = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 800)));
      if (preview.includes("facet") || preview.includes("endsolid")) {
        throw new Error("ASCII STL detected — only binary STL is supported. Convert to binary STL first.");
      }
    }
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

  // Pre-scan: detect if the file contains per-face colors (VisCAM/SolidView 15-bit RGB).
  // Color is encoded in the 2-byte attribute field after each triangle:
  //   bit 15: flag (1 = has color), bits 10-14: blue, 5-9: green, 0-4: red
  let hasFaceColors = false;
  for (let i = 0; i < triangleCount; i++) {
    const attrOffset = 84 + i * 50 + 48; // attribute bytes at end of each 50-byte record
    const attr = view.getUint16(attrOffset, true);
    if (attr & 0x8000) { hasFaceColors = true; break; }
  }

  // When faces have colors, each face needs its own 3 unshared vertices (for per-vertex color).
  // When no colors, we can share vertices across faces (compact indices).
  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const colors = hasFaceColors ? new Float32Array(triangleCount * 12) : undefined; // RGBA per vertex
  const indices = new Uint32Array(triangleCount * 3);

  let zeroNormalCount = 0;
  let colorFaceCount = 0;
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

    // Parse 2-byte attribute (VisCAM/SolidView per-face color)
    const attr = view.getUint16(offset, true);
    offset += 2;

    if (colors && (attr & 0x8000)) {
      const r = ((attr >> 0) & 0x1F) / 31;
      const g = ((attr >> 5) & 0x1F) / 31;
      const b = ((attr >> 10) & 0x1F) / 31;
      const cBase = i * 12;
      // Same color for all 3 vertices of this face
      colors[cBase + 0] = r; colors[cBase + 1] = g; colors[cBase + 2] = b; colors[cBase + 3] = 1;
      colors[cBase + 4] = r; colors[cBase + 5] = g; colors[cBase + 6] = b; colors[cBase + 7] = 1;
      colors[cBase + 8] = r; colors[cBase + 9] = g; colors[cBase + 10] = b; colors[cBase + 11] = 1;
      colorFaceCount++;
    }

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

    // Each face has its own set of 3 vertices (index = vertex offset / 3)
    indices[iBase + 0] = base / 3 + 0;
    indices[iBase + 1] = base / 3 + 1;
    indices[iBase + 2] = base / 3 + 2;
  }

  if (zeroNormalCount > 0) {
    console.warn(`[AI3D STL] ${zeroNormalCount} degenerate triangles with zero-area normals`);
  }
  if (hasFaceColors) {
    console.log(`[AI3D STL] Detected per-face colors: ${colorFaceCount}/${triangleCount} faces colored`);
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;
  if (colors) vertexData.colors = colors;

  const mesh = new BabylonMesh("stl-model", scene);
  vertexData.applyToMesh(mesh);

  const mat = new StandardMaterial("stl-mat", scene);
  mat.backFaceCulling = false;
  mat.specularColor = new Color3(0.3, 0.3, 0.3);
  mat.specularPower = 32;

  if (colors) {
    // Vertex colors present — set white diffuse so colors are not tinted
    mat.diffuseColor = new Color3(1, 1, 1);
    mat.emissiveColor = new Color3(0.05, 0.05, 0.05);
    (mat as any).vertexColorEnabled = true;
  } else {
    mat.diffuseColor = new Color3(0.85, 0.85, 0.85);
    mat.emissiveColor = new Color3(0.1, 0.1, 0.1);
  }
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
