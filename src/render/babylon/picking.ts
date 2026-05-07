import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { Material } from "@babylonjs/core/Materials/material.js";

const HIGHLIGHT_MARKER = "__ai3d_highlight_original_mat";

/**
 * Set up click-to-pick on a scene using onPointerObservable.
 * Clones material on highlight to avoid mutating shared materials.
 * Returns a cleanup function.
 */
export function setupPicking(
  scene: Scene,
  onPick: (mesh: AbstractMesh | null) => void,
): () => void {
  const { PointerEventTypes } = require("@babylonjs/core/Events/pointerEvents.js") as typeof import("@babylonjs/core/Events/pointerEvents.js");
  const { Color3 } = require("@babylonjs/core/Maths/math.color.js") as typeof import("@babylonjs/core/Maths/math.color.js");

  let highlighted: AbstractMesh | null = null;
  let originalMaterial: Material | null = null;
  let highlightMaterial: Material | null = null;

  function clearHighlight() {
    if (!highlighted) return;
    if (originalMaterial && highlightMaterial) {
      highlighted.material = originalMaterial;
      highlightMaterial.dispose();
    }
    highlighted = null;
    originalMaterial = null;
    highlightMaterial = null;
  }

  function applyHighlight(mesh: AbstractMesh) {
    const mat = mesh.material;
    if (!mat) return;

    originalMaterial = mat;
    highlightMaterial = mat.clone(mat.name + "_highlight")!;
    (highlightMaterial as any).emissiveColor = new Color3(0.3, 0.5, 1.0);
    mesh.material = highlightMaterial;
  }

  const observer = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

    clearHighlight();
    const pickInfo = pointerInfo.pickInfo;
    if (pickInfo?.hit && pickInfo.pickedMesh) {
      highlighted = pickInfo.pickedMesh;
      applyHighlight(highlighted);
      onPick(highlighted);
    } else {
      onPick(null);
    }
  });

  return () => {
    clearHighlight();
    scene.onPointerObservable.remove(observer);
  };
}
