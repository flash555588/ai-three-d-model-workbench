import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import "@babylonjs/core/Layers/effectLayerSceneComponent.js";

/**
 * Set up click-to-pick on a scene using onPointerObservable.
 * Uses a HighlightLayer so picking never mutates or replaces model materials.
 * Returns a cleanup function.
 */
export function setupPicking(
  scene: Scene,
  onPick: (mesh: AbstractMesh | null) => void,
): () => void {
  const { PointerEventTypes } = require("@babylonjs/core/Events/pointerEvents.js") as typeof import("@babylonjs/core/Events/pointerEvents.js");
  const { Color3 } = require("@babylonjs/core/Maths/math.color.js") as typeof import("@babylonjs/core/Maths/math.color.js");
  const { HighlightLayer } = require("@babylonjs/core/Layers/highlightLayer.js") as typeof import("@babylonjs/core/Layers/highlightLayer.js");

  const highlightLayer = new HighlightLayer("ai3d-pick-highlight", scene);
  const highlightColor = new Color3(0.15, 0.45, 1.0);

  function clearHighlight() {
    highlightLayer.removeAllMeshes();
  }

  function applyHighlight(mesh: AbstractMesh) {
    if (mesh.isDisposed()) return;
    highlightLayer.addMesh(mesh as any, highlightColor);
  }

  const observer = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

    clearHighlight();
    const pickInfo = pointerInfo.pickInfo;
    if (pickInfo?.hit && pickInfo.pickedMesh) {
      applyHighlight(pickInfo.pickedMesh);
      onPick(pickInfo.pickedMesh);
    } else {
      onPick(null);
    }
  });

  return () => {
    clearHighlight();
    highlightLayer.dispose();
    scene.onPointerObservable.remove(observer);
  };
}
