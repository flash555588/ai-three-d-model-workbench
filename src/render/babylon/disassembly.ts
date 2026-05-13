import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { Nullable } from "@babylonjs/core/types.js";
import type { Node } from "@babylonjs/core/node.js";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Plane } from "@babylonjs/core/Maths/math.plane.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
import "@babylonjs/core/Rendering/boundingBoxRenderer.js";

interface PartTransform {
  parent: Nullable<Node>;
  position: Vector3;
  rotation: Vector3;
  rotationQuaternion: AbstractMesh["rotationQuaternion"];
  scaling: Vector3;
}

interface DragState {
  mesh: AbstractMesh;
  mode: "move" | "rotate";
  plane: Plane;
  startPoint: Vector3;
  startPosition: Vector3;
  startRotation: Vector3;
  startRotationQuaternion: AbstractMesh["rotationQuaternion"];
  pivot: Vector3; // bbox center for rotation
  pointerX: number;
  pointerY: number;
}

export class DisassemblyController {
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly meshes: AbstractMesh[];
  private readonly originals = new Map<number, PartTransform>();
  private observer: Nullable<ReturnType<Scene["onPointerObservable"]["add"]>> = null;
  private renderObserver: Nullable<ReturnType<Scene["onAfterRenderCameraObservable"]["add"]>> = null;
  private frameCount = 0;
  private lastOccluded = false;
  private static readonly BBOX_VISIBLE = new Color3(0.25, 0.7, 1);
  private static readonly BBOX_OCCLUDED = new Color3(0.1, 0.25, 0.4);
  private active = false;
  private drag: DragState | null = null;
  private selected: AbstractMesh | null = null;

  constructor(scene: Scene, camera: ArcRotateCamera, meshes: AbstractMesh[]) {
    this.scene = scene;
    this.camera = camera;
    this.meshes = meshes;
    const bboxRenderer = scene.getBoundingBoxRenderer?.();
    if (bboxRenderer) {
      bboxRenderer.frontColor = new Color3(0.25, 0.7, 1);
      bboxRenderer.backColor = new Color3(0.25, 0.7, 1);
    }
    for (const mesh of meshes) {
      this.originals.set(mesh.uniqueId, this.captureTransform(mesh));
    }
  }

  setEnabled(enabled: boolean): boolean {
    if (this.active === enabled) return this.active;
    this.active = enabled;
    this.drag = null;
    this.setSelected(null);

    if (enabled) {
      this.observer = this.scene.onPointerObservable.add((pointerInfo) => {
        const event = pointerInfo.event as PointerEvent;
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          this.startDrag(pointerInfo.pickInfo?.pickedMesh ?? null, event);
        } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          this.updateDrag(event);
        } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
          this.stopDrag();
        }
      });
      this.renderObserver = this.scene.onAfterRenderCameraObservable.add((cam) => {
        if (cam === this.camera) this.updateBboxOcclusion();
      });
    } else {
      if (this.observer) {
        this.scene.onPointerObservable.remove(this.observer);
        this.observer = null;
      }
      if (this.renderObserver) {
        this.scene.onAfterRenderCameraObservable.remove(this.renderObserver);
        this.renderObserver = null;
      }
      this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    }

    return this.active;
  }

  toggle(): boolean {
    return this.setEnabled(!this.active);
  }

  reset(): void {
    this.stopDrag();
    this.setSelected(null);
    for (const mesh of this.meshes) {
      if (mesh.isDisposed()) continue;
      const original = this.originals.get(mesh.uniqueId);
      if (!original) continue;
      mesh.setParent(original.parent);
      mesh.position.copyFrom(original.position);
      mesh.rotation.copyFrom(original.rotation);
      mesh.rotationQuaternion = original.rotationQuaternion?.clone() ?? null;
      mesh.scaling.copyFrom(original.scaling);
      mesh.computeWorldMatrix(true);
    }
  }

  dispose(): void {
    this.setEnabled(false);
    this.originals.clear();
  }

  private updateBboxOcclusion(): void {
    if (!this.selected || this.selected.isDisposed()) return;
    this.frameCount++;
    if (this.frameCount % 3 !== 0) return;

    const center = this.selected.getBoundingInfo().boundingBox.centerWorld;
    const camPos = this.camera.position;
    const dist = Vector3.Distance(camPos, center);
    const dir = center.subtract(camPos).normalize();
    const ray = new Ray(camPos, dir, dist);
    const hit = this.scene.pickWithRay(ray);
    const eps = Math.max(dist * 0.01, 0.01);
    const occluded = !!hit?.hit && hit.distance < dist - eps;

    if (occluded !== this.lastOccluded) {
      this.lastOccluded = occluded;
      const color = occluded ? DisassemblyController.BBOX_OCCLUDED : DisassemblyController.BBOX_VISIBLE;
      const renderer = this.scene.getBoundingBoxRenderer?.();
      if (renderer) {
        renderer.frontColor = color;
        renderer.backColor = color;
      }
    }
  }

  private startDrag(mesh: AbstractMesh | null, event: PointerEvent): void {
    if (event.button !== 0) return;
    const part = mesh ? this.findPart(mesh) : null;
    if (!part) {
      this.drag = null;
      this.setSelected(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.camera.detachControl();
    part.setParent(null);
    part.computeWorldMatrix(true);
    this.setSelected(part);

    const startPoint = this.getPointOnDragPlane(part, event);
    if (!startPoint) {
      this.drag = null;
      return;
    }

    if (event.shiftKey && !part.rotationQuaternion) {
      part.rotationQuaternion = Quaternion.FromEulerVector(part.rotation);
      part.rotation.set(0, 0, 0);
    }

    const pivot = part.getBoundingInfo().boundingBox.centerWorld.clone();

    this.drag = {
      mesh: part,
      mode: event.shiftKey ? "rotate" : "move",
      plane: Plane.FromPositionAndNormal(startPoint, this.camera.getForwardRay().direction),
      startPoint,
      startPosition: part.position.clone(),
      startRotation: part.rotation.clone(),
      startRotationQuaternion: part.rotationQuaternion?.clone() ?? null,
      pivot,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
  }

  private updateDrag(event: PointerEvent): void {
    if (!this.drag) return;
    event.preventDefault();
    event.stopPropagation();

    if (this.drag.mode === "rotate") {
      this.updateRotation(event);
      return;
    }

    const point = this.getRayPlanePoint(event, this.drag.plane);
    if (!point) return;

    const offset = point.subtract(this.drag.startPoint);
    this.drag.mesh.position = this.drag.startPosition.add(offset);
    this.drag.mesh.computeWorldMatrix(true);
  }

  private updateRotation(event: PointerEvent): void {
    if (!this.drag) return;

    const dx = event.clientX - this.drag.pointerX;
    const dy = event.clientY - this.drag.pointerY;
    const sensitivity = 0.01;
    const yaw = Quaternion.RotationAxis(this.camera.getDirection(Vector3.Up()).normalize(), dx * sensitivity);
    const pitch = Quaternion.RotationAxis(this.camera.getDirection(Vector3.Right()).normalize(), dy * sensitivity);
    const delta = yaw.multiply(pitch);

    // Rotate around bbox center: new_pos = pivot + delta.rotate(start_pos - pivot)
    const offset = this.drag.startPosition.subtract(this.drag.pivot);
    const rotMatrix = new Matrix();
    delta.toRotationMatrix(rotMatrix);
    const rotatedOffset = Vector3.TransformCoordinates(offset, rotMatrix);
    this.drag.mesh.position = this.drag.pivot.add(rotatedOffset);

    if (this.drag.startRotationQuaternion) {
      this.drag.mesh.rotationQuaternion = delta.multiply(this.drag.startRotationQuaternion);
    } else {
      const start = Quaternion.FromEulerVector(this.drag.startRotation);
      this.drag.mesh.rotationQuaternion = delta.multiply(start);
      this.drag.mesh.rotation.set(0, 0, 0);
    }
    this.drag.mesh.computeWorldMatrix(true);
  }

  private stopDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }

  private findPart(mesh: AbstractMesh): AbstractMesh | null {
    if (this.meshes.includes(mesh)) return mesh;
    const parent = mesh.parent;
    if (parent && "uniqueId" in parent) {
      const parentMesh = parent as AbstractMesh;
      if (this.meshes.includes(parentMesh)) return parentMesh;
    }
    return null;
  }

  private setSelected(mesh: AbstractMesh | null): void {
    if (this.selected && !this.selected.isDisposed()) {
      this.selected.showBoundingBox = false;
    }
    this.selected = mesh;
    if (this.selected && !this.selected.isDisposed()) {
      this.selected.showBoundingBox = true;
    }
  }

  private getPointOnDragPlane(mesh: AbstractMesh, event: PointerEvent): Vector3 | null {
    const bbox = mesh.getBoundingInfo().boundingBox;
    const center = bbox.centerWorld.clone();
    const plane = Plane.FromPositionAndNormal(center, this.camera.getForwardRay().direction);
    return this.getRayPlanePoint(event, plane) ?? center;
  }

  private getRayPlanePoint(event: PointerEvent, plane: Plane): Vector3 | null {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ray = this.scene.createPickingRay(x, y, Matrix.Identity(), this.camera);
    const distance = ray.intersectsPlane(plane);
    if (distance === null) return null;
    return ray.origin.add(ray.direction.scale(distance));
  }

  private captureTransform(mesh: AbstractMesh): PartTransform {
    return {
      parent: mesh.parent,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      rotationQuaternion: mesh.rotationQuaternion?.clone() ?? null,
      scaling: mesh.scaling.clone(),
    };
  }
}
