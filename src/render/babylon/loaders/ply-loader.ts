import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { Mesh as BabylonMesh } from "@babylonjs/core/Meshes/mesh.js";
import { AssetContainer } from "@babylonjs/core/assetContainer.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";

interface PLYProperty {
  name: string;
  type: string;
  isList: boolean;
  countType?: string;
  itemType?: string;
}

interface PLYElement {
  name: string;
  count: number;
  properties: PLYProperty[];
}

interface PLYHeader {
  format: "ascii" | "binary_little_endian" | "binary_big_endian";
  elements: PLYElement[];
}

// ── Header parser ─────────────────────────────────────────────────

function parsePLYHeader(text: string): PLYHeader {
  const lines = text.split("\n");
  const elements: PLYElement[] = [];
  let format: PLYHeader["format"] = "binary_little_endian";
  let currentElement: PLYElement | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "end_header") break;
    if (line === "ply" || line === "" || line.startsWith("comment")) continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0];

    if (cmd === "format") {
      format = parts[1] as PLYHeader["format"];
    } else if (cmd === "element") {
      currentElement = { name: parts[1], count: parseInt(parts[2], 10), properties: [] };
      elements.push(currentElement);
    } else if (cmd === "property" && currentElement) {
      if (parts[1] === "list") {
        currentElement.properties.push({
          name: parts[4],
          type: "list",
          isList: true,
          countType: parts[2],
          itemType: parts[3],
        });
      } else {
        currentElement.properties.push({
          name: parts[2],
          type: parts[1],
          isList: false,
        });
      }
    }
  }

  return { format, elements };
}

function propertyByteSize(type: string): number {
  switch (type) {
    case "uchar": case "uint8": return 1;
    case "char": case "int8": return 1;
    case "ushort": case "uint16": return 2;
    case "short": case "int16": return 2;
    case "uint": case "uint32": return 4;
    case "int": case "int32": return 4;
    case "float": case "float32": return 4;
    case "double": case "float64": return 8;
    default: return 4;
  }
}

function readValue(view: DataView, offset: number, type: string, littleEndian: boolean): number {
  switch (type) {
    case "uchar": case "uint8": return view.getUint8(offset);
    case "char": case "int8": return view.getInt8(offset);
    case "ushort": case "uint16": return view.getUint16(offset, littleEndian);
    case "short": case "int16": return view.getInt16(offset, littleEndian);
    case "uint": case "uint32": return view.getUint32(offset, littleEndian);
    case "int": case "int32": return view.getInt32(offset, littleEndian);
    case "float": case "float32": return view.getFloat32(offset, littleEndian);
    case "double": case "float64": return view.getFloat64(offset, littleEndian);
    default: return 0;
  }
}

// ── Binary PLY parser ─────────────────────────────────────────────

function parseBinaryPLY(buffer: ArrayBuffer, header: PLYHeader, littleEndian: boolean, headerEnd: number) {
  let offset = headerEnd;

  const view = new DataView(buffer);
  let positions: number[] = [];
  let colors: number[] = [];
  let indices: number[] = [];

  const vertexEl = header.elements.find((e) => e.name === "vertex");
  const faceEl = header.elements.find((e) => e.name === "face");

  // Read vertices
  if (vertexEl) {
    const hasXYZ = vertexEl.properties.some((p) => p.name === "x");
    const hasRGB = vertexEl.properties.some((p) => p.name === "red" || p.name === "r");

    for (let i = 0; i < vertexEl.count; i++) {
      for (const prop of vertexEl.properties) {
        if (prop.isList) {
          const count = readValue(view, offset, prop.countType!, littleEndian);
          offset += propertyByteSize(prop.countType!);
          offset += count * propertyByteSize(prop.itemType!);
          continue;
        }

        const val = readValue(view, offset, prop.type, littleEndian);
        offset += propertyByteSize(prop.type);

        if (hasXYZ) {
          if (prop.name === "x") positions.push(val);
          else if (prop.name === "y") positions.push(val);
          else if (prop.name === "z") positions.push(val);
        }
        if (hasRGB) {
          if (prop.name === "red" || prop.name === "r") colors.push(val / 255);
          else if (prop.name === "green" || prop.name === "g") colors.push(val / 255);
          else if (prop.name === "blue" || prop.name === "b") colors.push(val / 255);
        }
      }
    }
  }

  // Read faces
  if (faceEl) {
    for (let i = 0; i < faceEl.count; i++) {
      for (const prop of faceEl.properties) {
        if (prop.isList) {
          const count = readValue(view, offset, prop.countType!, littleEndian);
          offset += propertyByteSize(prop.countType!);
          const verts: number[] = [];
          for (let j = 0; j < count; j++) {
            verts.push(readValue(view, offset, prop.itemType!, littleEndian));
            offset += propertyByteSize(prop.itemType!);
          }
          // Triangulate (fan)
          for (let j = 1; j < verts.length - 1; j++) {
            indices.push(verts[0], verts[j], verts[j + 1]);
          }
        } else {
          offset += propertyByteSize(prop.type);
        }
      }
    }
  }

  return { positions, colors, indices };
}

// ── ASCII PLY parser ──────────────────────────────────────────────

function parseASCIIPly(text: string, header: PLYHeader) {
  const headerEnd = text.indexOf("end_header") + "end_header".length + 1;
  const body = text.slice(headerEnd).trim();
  const lines = body.split(/\r?\n/);

  let positions: number[] = [];
  let colors: number[] = [];
  let indices: number[] = [];

  const vertexEl = header.elements.find((e) => e.name === "vertex");
  const faceEl = header.elements.find((e) => e.name === "face");

  let lineIdx = 0;

  if (vertexEl) {
    const hasXYZ = vertexEl.properties.some((p) => p.name === "x");
    const hasRGB = vertexEl.properties.some((p) => p.name === "red" || p.name === "r");
    const nonListProps = vertexEl.properties.filter((p) => !p.isList);

    for (let i = 0; i < vertexEl.count && lineIdx < lines.length; i++) {
      const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
      let col = 0;
      for (const prop of nonListProps) {
        const val = parts[col++] ?? 0;
        if (hasXYZ) {
          if (prop.name === "x") positions.push(val);
          else if (prop.name === "y") positions.push(val);
          else if (prop.name === "z") positions.push(val);
        }
        if (hasRGB) {
          if (prop.name === "red" || prop.name === "r") colors.push(val / 255);
          else if (prop.name === "green" || prop.name === "g") colors.push(val / 255);
          else if (prop.name === "blue" || prop.name === "b") colors.push(val / 255);
        }
      }
    }
  }

  if (faceEl) {
    for (let i = 0; i < faceEl.count && lineIdx < lines.length; i++) {
      const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const count = Math.round(parts[0]);
      for (let j = 1; j < count - 1; j++) {
        indices.push(Math.round(parts[1]), Math.round(parts[j + 1]), Math.round(parts[j + 2]));
      }
    }
  }

  return { positions, colors, indices };
}

// ── PLY → Babylon Mesh ────────────────────────────────────────────

function parsePLY(scene: Scene, data: ArrayBuffer): BabylonMesh {
  const text = new TextDecoder().decode(new Uint8Array(data));
  const header = parsePLYHeader(text);
  const headerEnd = text.indexOf("end_header") + "end_header".length + 1;

  const isBinary = header.format !== "ascii";
  const littleEndian = header.format === "binary_little_endian";
  const parsed = isBinary
    ? parseBinaryPLY(data, header, littleEndian, headerEnd)
    : parseASCIIPly(text, header);

  if (parsed.positions.length === 0) {
    throw new Error("PLY file contains no vertex data");
  }

  const positions = new Float32Array(parsed.positions);
  const vertexData = new VertexData();
  vertexData.positions = positions;

  if (parsed.indices.length > 0) {
    vertexData.indices = new Uint32Array(parsed.indices);
    // Compute normals from faces
    const normals = new Float32Array(positions.length);
    const idx = parsed.indices;
    const maxIdx = positions.length - 3;
    for (let i = 0; i < idx.length; i += 3) {
      const ia = idx[i] * 3, ib = idx[i + 1] * 3, ic = idx[i + 2] * 3;
      // Skip faces with out-of-range or negative vertex indices
      if (ia < 0 || ib < 0 || ic < 0 || ia > maxIdx || ib > maxIdx || ic > maxIdx) continue;
      const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
      const bx = positions[ib] - ax, by = positions[ib + 1] - ay, bz = positions[ib + 2] - az;
      const cx = positions[ic] - ax, cy = positions[ic + 1] - ay, cz = positions[ic + 2] - az;
      const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
      normals[ia] += nx; normals[ia + 1] += ny; normals[ia + 2] += nz;
      normals[ib] += nx; normals[ib + 1] += ny; normals[ib + 2] += nz;
      normals[ic] += nx; normals[ic + 1] += ny; normals[ic + 2] += nz;
    }
    // Normalize
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.sqrt(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2);
      if (len > 0) { normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len; }
    }
    vertexData.normals = normals;
  } else {
    // Point cloud — generate dummy triangles to avoid empty mesh
    const numVerts = parsed.positions.length / 3;
    const fakeIdx: number[] = [];
    for (let i = 0; i < numVerts - 2; i += 3) {
      fakeIdx.push(i, i + 1, i + 2);
    }
    if (fakeIdx.length === 0 && numVerts >= 3) {
      fakeIdx.push(0, 1, 2);
    }
    vertexData.indices = new Uint32Array(fakeIdx);
  }

  const mesh = new BabylonMesh("ply-model", scene);
  vertexData.applyToMesh(mesh);

  const mat = new StandardMaterial("ply-mat", scene);
  mat.backFaceCulling = false;

  // Apply per-vertex color if present
  if (parsed.colors.length > 0) {
    vertexData.colors = new Float32Array(parsed.colors);
    vertexData.applyToMesh(mesh);
    mat.diffuseColor = new Color3(1, 1, 1);
    (mat as any).vertexColorEnabled = true;
  } else {
    mat.diffuseColor = new Color3(0.7, 0.7, 0.7);
  }

  mesh.material = mat;
  return mesh;
}

// ── Babylon SceneLoader plugin ────────────────────────────────────

const plyPlugin = {
  name: "ply",
  extensions: ".ply",

  importMeshAsync(_meshNames: unknown, scene: Scene, data: unknown) {
    return Promise.resolve().then(() => {
      const mesh = parsePLY(scene, data as ArrayBuffer);
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

  loadAsync(scene: Scene, data: unknown) {
    return Promise.resolve().then(() => { parsePLY(scene, data as ArrayBuffer); });
  },

  loadAssetContainerAsync(scene: Scene, data: unknown) {
    return Promise.resolve().then(() => {
      const mesh = parsePLY(scene, data as ArrayBuffer);
      const container = new AssetContainer(scene);
      container.meshes.push(mesh);
      if (mesh.material) container.materials.push(mesh.material);
      return container;
    });
  },

  canDirectLoad() { return false; },
  rewriteRootURL(rootUrl: string) { return rootUrl; },
};

/**
 * Parse a PLY ArrayBuffer and add the resulting mesh to a Scene.
 * Bypasses SceneLoader — works around Babylon v9 data-URL handling issues
 * for custom plugins (same pattern as loadSTLBuffer).
 */
export function loadPLYBuffer(scene: Scene, buffer: ArrayBuffer): BabylonMesh {
  return parsePLY(scene, buffer);
}

export async function registerPLYLoader() {
  const { SceneLoader } = await import("@babylonjs/core/Loading/sceneLoader.js");
  SceneLoader.RegisterPlugin(plyPlugin as any);
}
