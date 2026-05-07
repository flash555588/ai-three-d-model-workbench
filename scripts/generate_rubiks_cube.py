"""Generate a detachable 3x3 Rubik's Cube GLB model using trimesh."""
import os, trimesh, numpy as np

CUBIE   = 0.94   # cubie box edge
GAP     = 1.0    # center-to-center spacing
STICKER = 0.86   # sticker plane edge ( < CUBIE → visible border )
THICK   = 0.005  # sticker thickness
R       = CUBIE / 2
SR      = STICKER / 2

# ── Colours (standard Rubik's) ─────────────────────────────
C = {
    "white"  : [255, 255, 255, 255],
    "yellow" : [255, 215,   0, 255],
    "green"  : [  0, 155,  72, 255],
    "blue"   : [  0,  81, 186, 255],
    "red"    : [185,   0,   0, 255],
    "orange" : [255,  89,   0, 255],
    "dark"   : [ 18,  18,  18, 255],  # interior / border
}

def pos(i):
    return (i - 1) * GAP

def box(w, h, d, color, name=""):
    m = trimesh.creation.box(extents=[w, h, d])
    m.visual.face_colors = np.tile(color, (len(m.faces), 1))
    m.metadata["name"] = name
    return m

def sticker(axis, sign, color, name):
    """Coloured sticker plane on one face of a cubie."""
    d = [THICK, THICK, THICK]
    d[axis] = 0.0
    s = trimesh.creation.box(extents=[
        STICKER if axis != 0 else THICK,
        STICKER if axis != 1 else THICK,
        STICKER if axis != 2 else THICK,
    ])
    s.visual.face_colors = np.tile(color, (len(s.faces), 1))
    s.metadata["name"] = name

    off = R + THICK / 2
    t = np.eye(4)
    t[axis, 3] = off * sign
    s.apply_transform(t)
    return s

def cubie(x, y, z):
    """One individual cubie (body + visible stickers)."""
    parts = [box(CUBIE, CUBIE, CUBIE, C["dark"], f"cubie_{x}{y}{z}")]

    if z == 2: parts.append(sticker(2, +1, C["green"],  "F"))
    if z == 0: parts.append(sticker(2, -1, C["blue"],   "B"))
    if x == 2: parts.append(sticker(0, +1, C["red"],    "R"))
    if x == 0: parts.append(sticker(0, -1, C["orange"], "L"))
    if y == 2: parts.append(sticker(1, +1, C["white"],  "U"))
    if y == 0: parts.append(sticker(1, -1, C["yellow"], "D"))

    piece = trimesh.util.concatenate(parts)
    piece.apply_translation([pos(x), pos(y), pos(z)])
    piece.metadata["name"] = f"cubie_{x}{y}{z}"
    return piece

# ── Build scene ────────────────────────────────────────────
print("Building 27 cubies ...")
scene = trimesh.Scene()
for x in range(3):
    for y in range(3):
        for z in range(3):
            c = cubie(x, y, z)
            scene.add_geometry(c, node_name=f"cubie_{x}{y}{z}")

# ── Export GLB ─────────────────────────────────────────────
out_dir  = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "rubiks-cube-3x3.glb")

glb = scene.export(file_type="glb")
with open(out_path, "wb") as f:
    f.write(glb)

kb = os.path.getsize(out_path) / 1024
print(f"Written: {out_path}  ({kb:.1f} KB, 27 cubies)")
