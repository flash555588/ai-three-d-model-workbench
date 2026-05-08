import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

interface ExplodeMeta {
  _originalPos: { x: number; y: number; z: number };
  _originalCenter: { x: number; y: number; z: number };
}

export function setExplode(
  rootMesh: Mesh,
  factor: number,
  axis: "x" | "y" | "z",
): void {
  const children = rootMesh.getChildMeshes() as Mesh[];
  const rootCenter = rootMesh.getBoundingInfo().boundingBox.centerWorld;

  for (const child of children) {
    if (!child.metadata) child.metadata = {};
    const meta = child.metadata as ExplodeMeta;

    // Cache original position on first call (local space, relative to parent)
    if (!meta._originalPos) {
      const local = child.position;
      meta._originalPos = { x: local.x, y: local.y, z: local.z };
    }

    // Cache original bounding center on first call
    if (!meta._originalCenter) {
      const childCenter = child.getBoundingInfo().boundingBox.centerWorld;
      meta._originalCenter = { x: childCenter.x, y: childCenter.y, z: childCenter.z };
    }

    // Always compute delta from original center, never from current (moved) center
    const delta = (meta._originalCenter[axis] - rootCenter[axis]) * factor;

    const orig = meta._originalPos;
    child.position = new Vector3(
      axis === "x" ? orig.x + delta : orig.x,
      axis === "y" ? orig.y + delta : orig.y,
      axis === "z" ? orig.z + delta : orig.z,
    );
  }
}

export function resetExplode(rootMesh: Mesh): void {
  const children = rootMesh.getChildMeshes() as Mesh[];
  for (const child of children) {
    const meta = child.metadata as ExplodeMeta | undefined;
    if (meta?._originalPos) {
      child.position = new Vector3(meta._originalPos.x, meta._originalPos.y, meta._originalPos.z);
    }
  }
}
