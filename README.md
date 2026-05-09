# AI 3D Model Workbench

> An Obsidian plugin that renders 3D models in a Babylon.js viewport and connects them to your knowledge notes. Common mesh formats render directly; CAD, FBX, and interchange formats can be converted to GLB through local tools.

**English** | [简体中文](README.zh-CN.md)

<img width="2132" height="1502" alt="preview" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Format Support](#format-support)
- [Usage](#usage)
- [Settings](#settings)
- [External Dependencies](#external-dependencies)
- [Technical Details](#technical-details)
- [Known Limitations](#known-limitations)
- [Deployment](#deployment)
- [License](#license)

---

## Features

- **Direct mesh preview** for GLB/GLTF, STL, OBJ, PLY, and SPLAT
- **Optional conversion** for CAD, FBX, 3MF, and DAE assets
- **Babylon.js 9.6** engine with WebGL 2 rendering
- **Three embedding methods**: Live Preview, code blocks, direct file view
- **Grid system**: render multiple models in a single viewport with presets
- **3D annotations**: click-to-pin bookmarks with labels, colors, and depth-aware occlusion
- **Knowledge notes**: generate structured Markdown from loaded models
- **Snapshots**: copy, save, or download rendered previews as PNG
- **i18n**: English and Simplified Chinese with auto-detect system locale
- **Mobile support**: Obsidian Mobile with adaptive hardware scaling

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the plugin
npm run build

# 3. Copy to Obsidian vault
cp main.js manifest.json styles.css \
  /path/to/vault/.obsidian/plugins/ai-3d-model-workbench/

# 4. Enable in Obsidian Settings > Community Plugins
```

Then in any note:

```markdown
![[model.glb]]           # Renders inline in Live Preview
![[model.glb|400x300]]   # Custom size
```

---

## Installation

### Option A: Build from Source (Recommended)

```bash
git clone https://github.com/flash555588/ai-3d-model-workbench.git
cd ai-3d-model-workbench
npm install
npm run build
```

Copy the three output files to your vault:

| File | Size | Description |
|------|------|-------------|
| `main.js` | ~1.7 MB | Plugin runtime (Babylon.js core) |
| `manifest.json` | ~1 KB | Obsidian plugin manifest |
| `styles.css` | ~10 KB | Plugin styles |

**Target directory**: `<vault>/.obsidian/plugins/ai-3d-model-workbench/`

### Option B: Symlink for Development

```bash
# Windows (PowerShell)
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\Documents\MyVault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"

# macOS / Linux
ln -s /path/to/ai-3d-model-workbench \
  ~/Documents/MyVault/.obsidian/plugins/ai-3d-model-workbench
```

Then run `npm run dev` for watch mode during development.

### Option C: Manual Download

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/flash555588/ai-3d-model-workbench/releases)
2. Create folder `<vault>/.obsidian/plugins/ai-3d-model-workbench/`
3. Place files in the folder
4. Enable in Obsidian Settings > Community Plugins

---

## Format Support

### Direct Rendering (No External Tools)

| Format | Extension | Features |
|--------|-----------|----------|
| GLB / GLTF | `.glb` `.gltf` | PBR materials, animations, textures, scene hierarchy |
| STL | `.stl` | Binary format, per-face colors (VisCAM/SolidView) |
| OBJ | `.obj` | MTL materials, vault-relative texture resolution |
| PLY | `.ply` | ASCII/binary, vertex colors, point cloud support |
| SPLAT | `.splat` | Gaussian Splatting point clouds |

### Conversion (Requires External Tools)

| Format | Extension | Converter | Output |
|--------|-----------|-----------|--------|
| STEP | `.step` `.stp` | Python + CadQuery/OCCT | GLB |
| IGES | `.iges` `.igs` | Python + CadQuery/OCCT | GLB |
| BREP | `.brep` | Python + CadQuery/OCCT | GLB |
| SLDPRT | `.sldprt` | FreeCAD | GLB |
| 3MF | `.3mf` | Python + trimesh | GLB |
| DAE | `.dae` | Python + trimesh | GLB |
| FBX | `.fbx` | FBX2glTF | GLB |

### Format Feature Matrix

| Feature | GLB/GLTF | STL | OBJ | PLY | SPLAT | FBX (converted) | CAD |
|---------|----------|-----|-----|-----|-------|-----|-----|
| Mesh | Yes | Yes | Yes | Yes | No | Yes | Yes |
| Point Cloud | No | No | No | Yes | Yes | No | No |
| Materials | PBR | Basic | MTL | Basic | No | Basic | No |
| Textures | Embedded | No | External | No | No | No | No |
| Colors | Vertex | Face | No | Vertex | Point | No | Face (STEP) |
| Animation | Yes | No | No | No | No | Yes | No |

---

## Usage

### Syntax Guide

#### 1. Live Preview Embed

Render 3D models inline wherever you write wikilinks. Works in both Reading and Live Preview modes.

```markdown
![[model.glb]]              # default size
![[model.glb|400x300]]      # custom width x height (pixels)
![[bunny.stl]]              # any supported format
```

#### 2. Single Model Code Block (`3d`)

**Simple path** — just the file name after the fence:

````markdown
```3d model.glb
```
````

**JSON config** — full control over camera, lights, and scene:

````markdown
```3d
{
  "models": [
    { "path": "model.glb" },
    { "path": "wireframe.stl", "color": "#ff0000", "wireframe": true }
  ],
  "camera": {
    "position": [5, 5, 5],
    "lookAt": [0, 0, 0],
    "fov": 30,
    "mode": "perspective"
  },
  "lights": [
    { "type": "hemisphere", "color": "#ffffff", "intensity": 1, "groundColor": "#444444" },
    { "type": "directional", "color": "#ffffff", "intensity": 0.8, "position": [10, 20, 10] }
  ],
  "scene": {
    "background": "#1e1e22",
    "autoRotate": true,
    "autoRotateSpeed": 0.5,
    "groundShadow": true,
    "grid": true,
    "axis": true
  },
  "stl": { "color": "#cccccc", "wireframe": false },
  "width": "100%",
  "height": 500
}
```
````

**`models` array** (required):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | string | — | Vault-relative path to model file |
| `color` | string | — | Override material color (hex) |
| `wireframe` | boolean | `false` | Render as wireframe |

**`camera` object**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `position` | `[x, y, z]` | auto | Camera world position |
| `lookAt` | `[x, y, z]` | origin | Camera target point |
| `fov` | number | `45` | Field of view in degrees |
| `mode` | string | `"perspective"` | `"perspective"` or `"orthographic"` |
| `zoom` | number | — | Orthographic zoom level |
| `near` | number | — | Near clipping plane |
| `far` | number | — | Far clipping plane |

**`lights` array** — each item:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | `"directional"` `"ambient"` `"point"` `"spot"` `"hemisphere"` `"attachToCam"` |
| `color` | string | `"#ffffff"` | Light color |
| `intensity` | number | `1` | Light intensity |
| `position` | `[x, y, z]` | — | Light position (directional/point/spot) |
| `target` | `[x, y, z]` | — | Spotlight target |
| `castShadow` | boolean | `false` | Enable shadow casting |
| `angle` | number | — | Spot light cone angle (radians) |
| `penumbra` | number | — | Spot light penumbra ratio |
| `decay` | number | — | Light falloff exponent |
| `groundColor` | string | — | Ground color (hemisphere light) |

**`scene` object**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `background` | string | `"#1e1e22"` | Background color (hex) |
| `transparent` | boolean | `false` | Transparent background |
| `autoRotate` | boolean | `false` | Enable turntable rotation |
| `autoRotateSpeed` | number | `0.5` | Rotation speed (0.1–2.0) |
| `groundShadow` | boolean | `false` | Show ground shadow plane |
| `grid` | boolean | `false` | Show floor grid |
| `axis` | boolean | `false` | Show XYZ axis indicator |

**`stl` object** — defaults for STL files:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `color` | string | `"#cccccc"` | Default mesh color |
| `wireframe` | boolean | `false` | Wireframe rendering |

**Top-level**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | number/string | `"100%"` | Canvas width (px or CSS) |
| `height` | number/string | `"400"` | Canvas height (px or CSS) |

#### 3. Grid Code Block (`3dgrid`)

Render multiple models in a single viewport with preset layouts.

````markdown
```3dgrid
{
  "models": [
    { "path": "v1.step" },
    { "path": "v2.step" },
    { "path": "v3.step" }
  ],
  "preset": "compare",
  "camera": { "fov": 30 },
  "scene": { "background": "#111" }
}
```
````

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `models` | array | — | Model list (same `ModelConfig` as `3d` block) |
| `preset` | string | `"gallery"` | Layout preset name (see table below) |
| `params` | object | — | Preset-specific parameters (spacing, camera distance, etc.) |
| `sections` | array | — | Section definitions for `"compose"` preset |
| `direction` | string | `"horizontal"` | Compose layout direction: `"horizontal"` or `"vertical"` |
| `columns` | number | auto | Number of grid columns |
| `rowHeight` | number/string | `"auto"` | Row height in pixels |
| `gapX` | number | — | Horizontal gap between cells (px) |
| `gapY` | number | — | Vertical gap between cells (px) |
| `camera` | object | — | Shared camera config (same as `3d` block) |
| `lights` | array | — | Shared lights config (same as `3d` block) |
| `scene` | object | — | Shared scene config (same as `3d` block) |

**Grid presets**:

| Preset | Description |
|--------|-------------|
| `compare` | Side-by-side A/B comparison |
| `showcase` | Multi-angle single model view |
| `explode` | Ring arrangement for assembly breakdown |
| `timeline` | Horizontal strip for version history |
| `gallery` | All models in one scene (default) |
| `compose` | Custom multi-section layout using `sections` |

#### 4. Direct File View

Click any supported model file in Obsidian's file explorer to open it in a dedicated viewer tab. No syntax needed.

#### Supported Extensions

| Category | Extensions |
|----------|------------|
| Direct render | `.glb` `.gltf` `.stl` `.obj` `.ply` `.splat` |
| Conversion | `.step` `.stp` `.iges` `.igs` `.brep` `.sldprt` `.3mf` `.dae` `.fbx` |

### Keyboard Shortcuts (in preview)

| Key | Action |
|-----|--------|
| `R` | Reset view |
| `W` | Toggle wireframe |
| `G` | Toggle orientation gizmo |
| `B` | Toggle bounding box |
| `Space` | Play/pause animation |
| `Esc` | Exit annotation mode |

### 3D Annotations

Add labeled bookmarks directly on model surfaces. Annotations persist per model file.

**Direct View & Workbench** (edit mode):

1. Click the **tag icon** in the toolbar (or "Annotate" button in the workbench panel)
2. A blue overlay indicates annotation mode is active
3. Click anywhere on the model surface to place a pin
4. Enter a label and pick a color in the popup editor
5. Click an existing pin to edit its label/color or delete it
6. Click a pin label in the workbench panel to animate the camera to that position
7. Press `Esc` to exit annotation mode

**Depth-aware occlusion**: Pins behind geometry display blurred and dimmed. When the camera stops moving for ~250ms, fully occluded pins are automatically hidden, leaving only visible bookmarks.

**Code blocks & Live Preview**: Saved annotations display as read-only overlays with the same occlusion behavior.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Language | auto | UI language (English / Simplified Chinese / auto-detect) |
| Canvas height | 400 | Preview height in pixels |
| Auto-rotate | off | Start with turntable animation |
| Auto-rotate speed | 0.5 | Rotation speed (0.1-2.0) |
| Render quality | high | Quality preset (low/medium/high) |
| Render scale | 1.0 | Resolution multiplier (0.25-2.0) |
| Snapshot folder | Media/3D Previews | Export folder |
| Report folder | Analysis/3D Reports | Knowledge notes folder |
| Log level | info | Console log verbosity |

### Converter Settings

| Setting | Description |
|---------|-------------|
| Enable CAD converter | Enable STEP/IGES/BREP via CadQuery |
| Enable SLDPRT converter | Enable SolidWorks via FreeCAD |
| Enable mesh converter | Enable 3MF/DAE via trimesh |
| Enable OBJ2GLTF converter | Optional OBJ normalization through obj2gltf |
| Enable FBX2glTF converter | Enable FBX conversion through FBX2glTF |
| Python command | Override Python path |
| FreeCADCmd path | Override FreeCADCmd path |

---

## External Dependencies

Only needed for CAD, FBX, and mesh conversion. Direct formats work without any external tools.

### Python + CadQuery (STEP, IGES, BREP)

```bash
# Install
pip install cadquery trimesh

# Verify
python -c "import cadquery; print('OK')"
```

### FreeCAD (SLDPRT)

Download from [freecad.org/downloads](https://www.freecad.org/downloads.php).

Auto-discovery paths:
- Windows: `%LOCALAPPDATA%\Programs\FreeCAD*\bin\FreeCADCmd.exe`
- macOS: `/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd`
- Linux: `/usr/bin/freecadcmd`

### Python + trimesh (3MF, DAE)

```bash
pip install trimesh
```

**Auto-discovery**: Same Python as CadQuery (see above).

**Override**: Environment variable `AI3D_ASSIMP_CMD`.

### obj2gltf (OBJ, optional)

The plugin already has a built-in OBJ loader. obj2gltf is an optional alternative that can produce higher-fidelity GLB output.

**Install**:

```bash
npm install -g obj2gltf
```

**Auto-discovery**: The plugin looks for `obj2gltf.cmd` (Windows) or `obj2gltf` (Unix) on PATH.

**Enable**: Settings > Enable OBJ2GLTF converter, or set "obj2gltf path".

### FBX2glTF (FBX)

FBX files are converted to GLB through the local FBX2glTF binary. The older community FBX loader is not bundled because its current release targets Babylon.js 8, while this plugin uses Babylon.js 9.

**Install**:

Download from [github.com/godotengine/FBX2glTF](https://github.com/godotengine/FBX2glTF) and place the binary in a known location.

**Auto-discovery** (Windows):

```
C:\Program Files\FBX2glTF\FBX2glTF-windows-x64.exe
C:\Program Files\FBX2glTF\FBX2glTF.exe
```

**Enable**: Settings > Enable FBX2glTF converter, or set "FBX2glTF path".

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `AI3D_FREECAD_CMD` | Python command for CadQuery |
| `AI3D_FREECMDCMD` | FreeCADCmd path |
| `AI3D_ASSIMP_CMD` | Python command for trimesh |
| `AI3D_OBJ2GLTF_CMD` | obj2gltf command path |
| `AI3D_FBX2GLTF_CMD` | FBX2glTF command path |

---

## Technical Details

### Architecture

```
src/
├── main.ts                    # Plugin lifecycle, commands
├── domain/
│   ├── models.ts              # Shared interfaces
│   └── constants.ts           # Default settings, extensions
├── store/
│   ├── create-store.ts        # Custom store primitive
│   └── plugin-store.ts        # Obsidian saveData bridge
├── render/babylon/
│   ├── scene.ts               # BabylonModelPreview class
│   ├── grid.ts                # GridRenderer class
│   ├── annotations.ts         # AnnotationManager (pin overlay + occlusion)
│   ├── picking.ts             # Click-to-pick with highlight
│   ├── loaders/
│   │   ├── stl-loader.ts      # Custom binary STL parser
│   │   ├── ply-loader.ts      # Custom ASCII/binary PLY parser
│   │   └── register.ts        # Babylon SceneLoader plugins
│   └── presets/               # Grid layout presets
├── io/
│   ├── formats/
│   │   └── registry.ts        # Format capability registry
│   ├── conversion/
│   │   ├── manager.ts         # Conversion orchestration
│   │   └── adapters/          # Converter implementations
│   └── model-pipeline.ts      # Format routing logic
└── view/
    ├── workbench/             # Main workbench UI
    ├── inline/                # Code blocks, live preview
    └── direct-view.ts         # Direct file opening
```

### Model Import Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  1. Format Detection                                        │
│     └─ getFormatCapability(ext) → { family, strategy }      │
│                                                             │
│  2. Route Decision                                          │
│     ├─ strategy: "direct" → prepareDirectLoad()             │
│     └─ strategy: "convert" → convertForPreview()            │
│                                                             │
│  3. Data Loading                                            │
│     ├─ readBinaryPath() → ArrayBuffer                       │
│     └─ [if converted] → read converted .glb                 │
│                                                             │
│  4. Babylon Rendering                                       │
│     ├─ GLB/GLTF/OBJ/SPLAT → SceneLoader.ImportMeshAsync()  │
│     ├─ STL → loadSTLBuffer() (direct parse)                 │
│     └─ PLY → loadPLYBuffer() (direct parse)                 │
└─────────────────────────────────────────────────────────────┘
```

### Why Direct Buffer Loading for STL/PLY

Babylon.js v9 SceneLoader has a bug where custom plugins receive data URL strings instead of ArrayBuffer when loading via `SceneLoader.ImportMeshAsync()`. Built-in loaders (GLTF, OBJ, SPLAT) are unaffected.

**Workaround**: STL and PLY parsers are called directly with the raw ArrayBuffer, bypassing SceneLoader entirely.

### Conversion Caching

- **Location**: Same directory as source file
- **Format**: `{filename}.ai3d-converted.glb`
- **Validation**: Checks converter identity, cache key, file existence
- **Invalidation**: Automatic when converter settings change
- **Manual clear**: Command palette > "Clear Conversion Cache"

---

## Known Limitations

| Issue | Affected Formats | Workaround |
|-------|-----------------|------------|
| External converter required | FBX | Install and enable FBX2glTF |
| Binary-only STL | STL | Convert ASCII STL to binary |
| External tools required | STEP/IGES/BREP/SLDPRT | Install Python + CadQuery or FreeCAD |
| Texture path resolution | OBJ | Place textures in same directory as OBJ |
| Conversion timeout | SLDPRT | 10-minute timeout for complex assemblies |

---

## Deployment

### Prerequisites

- Node.js >= 18
- npm >= 9
- Obsidian >= 1.5.0

### Build Commands

```bash
npm install           # Install dependencies
npm run dev           # Development build with watch
npm run build         # Production build
npm run typecheck     # TypeScript type check
```

### Build Output

```
ai-3d-model-workbench/
├── main.js           # 1.7 MB (minified, Babylon.js core)
├── manifest.json     # Plugin manifest
├── styles.css        # Plugin styles
└── src/              # Source code
```

### Platform Support

| Platform | Status |
|----------|--------|
| Windows | Full support |
| macOS | Full support |
| Linux | Full support |
| Obsidian Mobile | Supported (reduced resolution) |

### Bundle Size Optimization

Babylon.js core is ~98% of the bundle size. The project uses:

- Subpath imports (`@babylonjs/core/Engines/engine.js`) instead of barrel imports
- Tree-shaking to remove unused features
- esbuild for fast, optimized bundling

Without subpath imports, the bundle would be ~7 MB instead of 1.7 MB.

---

## License

MIT
