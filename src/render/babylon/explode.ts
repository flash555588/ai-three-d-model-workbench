import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector.js";

interface ExplodeMeta {
  _originalPos: { x: number; y: number; z: number };
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

    // Cache original position on first call (world space)
    if (!meta._originalPos) {
      const abs = child.getAbsolutePosition();
      meta._originalPos = { x: abs.x, y: abs.y, z: abs.z };
    }

    const childCenter = child.getBoundingInfo().boundingBox.centerWorld;
    const delta = (childCenter[axis] - rootCenter[axis]) * factor;

    const orig = meta._originalPos;
    const pos = child.getAbsolutePosition().clone();
    pos[axis] = orig[axis] + delta;
    child.setAbsolutePosition(pos);
  }
}

export function resetExplode(rootMesh: Mesh): void {
  const children = rootMesh.getChildMeshes() as Mesh[];
  for (const child of children) {
    const meta = child.metadata as ExplodeMeta | undefined;
    if (meta?._originalPos) {
      child.setAbsolutePosition(
        child.getAbsolutePosition().clone() // reset via setAbsolutePosition
      );
      // Restore to original world position
      const pos = child.getAbsolutePosition();
      pos.x = meta._originalPos.x;
      pos.y = meta._originalPos.y;
      pos.z = meta._originalPos.z;
      child.setAbsolutePosition(pos);
    }
  }
}
