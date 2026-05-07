// Node.js polyfills for Three.js browser APIs
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    constructor() { this.result = null; this.onload = null; }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onload) this.onload({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString("base64");
        const type = blob.type || "application/octet-stream";
        this.result = `data:${type};base64,${b64}`;
        if (this.onload) this.onload({ target: this });
      });
    }
  };
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = { createElementNS: () => ({ getContext: () => null }) };
}

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync, mkdirSync } from "fs";

const CUBIE_SIZE = 0.95;
const CUBIE_GAP = 1.0;
const FACE_SIZE  = 0.92;
const FACE_OFFSET = CUBIE_SIZE / 2 + 0.002;
const SEGMENTS = 2;

const scene = new THREE.Scene();
scene.name = "RubiksCube_3x3";

// ── Materials ────────────────────────────────────────────
const mat = {
  interior : new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, name: "interior" }),
  front    : new THREE.MeshStandardMaterial({ color: 0x009b48, roughness: 0.55, name: "green"   }),
  back     : new THREE.MeshStandardMaterial({ color: 0x0051BA, roughness: 0.55, name: "blue"    }),
  right    : new THREE.MeshStandardMaterial({ color: 0xB90000, roughness: 0.55, name: "red"     }),
  left     : new THREE.MeshStandardMaterial({ color: 0xFF5900, roughness: 0.55, name: "orange"  }),
  top      : new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.55, name: "white"   }),
  bottom   : new THREE.MeshStandardMaterial({ color: 0xFFD500, roughness: 0.55, name: "yellow"  })
};

const faceGeo = new THREE.PlaneGeometry(FACE_SIZE, FACE_SIZE);

const pos = (i) => (i - 1) * CUBIE_GAP;

// ── Build 27 cubies ──────────────────────────────────────
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    for (let z = 0; z < 3; z++) {

      const cubie = new THREE.Group();
      cubie.name = `cubie_${x}_${y}_${z}`;
      cubie.position.set(pos(x), pos(y), pos(z));

      // Dark body
      const body = new THREE.Mesh(
        new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, SEGMENTS, 0.06),
        mat.interior
      );
      body.name = "body";
      cubie.add(body);

      // Colored stickers (only on exposed faces)
      const addFace = (faceMat, px, py, pz, rx, ry) => {
        const plane = new THREE.Mesh(faceGeo, faceMat);
        plane.position.set(px, py, pz);
        if (rx) plane.rotation.x = rx;
        if (ry) plane.rotation.y = ry;
        plane.name = faceMat.name;
        cubie.add(plane);
      };

      if (z === 2) addFace(mat.front,  0, 0,  FACE_OFFSET, 0,             0);
      if (z === 0) addFace(mat.back,   0, 0, -FACE_OFFSET, 0,             Math.PI);
      if (x === 2) addFace(mat.right,  FACE_OFFSET, 0, 0,  0,             Math.PI / 2);
      if (x === 0) addFace(mat.left,  -FACE_OFFSET, 0, 0,  0,            -Math.PI / 2);
      if (y === 2) addFace(mat.top,    0, FACE_OFFSET, 0,  -Math.PI / 2,  0);
      if (y === 0) addFace(mat.bottom, 0,-FACE_OFFSET, 0,   Math.PI / 2,  0);

      scene.add(cubie);
    }
  }
}

// ── Export ────────────────────────────────────────────────
const outDir  = "models";
const outFile = `${outDir}/rubiks-cube-3x3.glb`;

mkdirSync(outDir, { recursive: true });

new GLTFExporter().parse(
  scene,
  (buffer) => {
    writeFileSync(outFile, Buffer.from(buffer));
    const kb = (Buffer.from(buffer).length / 1024).toFixed(1);
    console.log(`Generated: ${outFile}  (${kb} KB, 27 cubies)`);
  },
  (error) => {
    console.error("Export failed:", error);
    process.exit(1);
  },
  { binary: true }
);
