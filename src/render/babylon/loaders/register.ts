// Side-effect imports: register Babylon SceneLoader plugins.
// Each import calls RegisterSceneLoaderPlugin() as a side-effect.

// glTF/GLB — both required: glTFFileLoader sets up the plugin, the 2.0 loader
// registers itself via GLTFFileLoader._CreateGLTF2Loader.
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";

// OBJ — classic mesh format with MTL material support
import "@babylonjs/loaders/OBJ/objFileLoader";

// SPLAT — Gaussian Splatting (.splat, .ply gaussian)
import "@babylonjs/loaders/SPLAT/splatFileLoader";

import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { registerSTLLoader } from "./stl-loader";
import { registerPLYLoader } from "./ply-loader";

let customLoadersReady = false;

/** Register all SceneLoader plugins (GLTF/OBJ/SPLAT via side-effect imports, STL/PLY custom, FBX community). */
export async function ensureLoadersRegistered(): Promise<void> {
  if (customLoadersReady) return;

  // Register FBX loader (community package, lazy import to avoid bundling if unused)
  try {
    const { FBXLoader } = await import("babylonjs-fbx-loader");
    SceneLoader.RegisterPlugin(new FBXLoader());
  } catch {
    // FBX loader not available — silently skip
  }

  await Promise.all([registerSTLLoader(), registerPLYLoader()]);
  customLoadersReady = true;
}
