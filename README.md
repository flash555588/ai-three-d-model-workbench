# AI 3D Model Workbench

> An Obsidian plugin for viewing 3D assets, annotating key parts, and turning models into linked knowledge notes. Common mesh formats render directly; CAD, FBX, and interchange formats can be converted to GLB through local tools.

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
- **Desktop support**: Obsidian Desktop on Windows, macOS, and Linux
- **Mobile support**: Direct preview on Obsidian Mobile with adaptive hardware scaling

---

## Quick Start

1. Build the plugin:

```bash
npm install
npm run build
```

2. Open your local Obsidian vault folder on your computer.

3. Create this folder inside the vault:

```text
<your-vault>/.obsidian/plugins/ai-3d-model-workbench/
```

4. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.

5. In Obsidian, open `Settings > Community Plugins` and enable `AI 3D Model Workbench`.

6. Put a supported model file into the same vault, for example `model.glb`.

7. In any note inside that vault, embed it like this:

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

---

## Installation

Use [Quick Start](#quick-start) if you only want the fastest setup.

### Requirements

- Obsidian 1.5.0 or later
- Obsidian Desktop on Windows, macOS, or Linux for local tool-based conversion
- A local Obsidian vault folder on your computer
- This plugin folder inside the vault:

```text
<vault>/.obsidian/plugins/ai-3d-model-workbench/
```

All install methods place the same three files in that folder:

| File | Size | Description |
|------|------|-------------|
| `main.js` | ~1.7 MB | Plugin runtime (Babylon.js core) |
| `manifest.json` | ~1 KB | Obsidian plugin manifest |
| `styles.css` | ~10 KB | Plugin styles |

Direct rendering works on desktop and mobile. Local converter tools for CAD, FBX, 3MF, and DAE require desktop OS access.

### Option A: Build from Source

1. Clone the repository and build the plugin:

```bash
git clone https://github.com/flash555588/ai-3d-model-workbench.git
cd ai-3d-model-workbench
npm install
npm run build
```

2. Create `<vault>/.obsidian/plugins/ai-3d-model-workbench/` if it does not exist.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. In Obsidian, enable `AI 3D Model Workbench` in `Settings > Community Plugins`.

### Option B: Download a Release

1. Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/flash555588/ai-3d-model-workbench/releases).
2. Create `<vault>/.obsidian/plugins/ai-3d-model-workbench/` if it does not exist.
3. Put the three files in that folder.
4. In Obsidian, enable `AI 3D Model Workbench` in `Settings > Community Plugins`.

### Option C: Symlink for Development

1. Make sure `<vault>/.obsidian/plugins/` already exists.
2. Create a symlink named `ai-3d-model-workbench` that points to this repository.

Windows (PowerShell):

```powershell
New-Item -ItemType SymbolicLink `
  -Path "C:\path\to\your-vault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"
```

macOS / Linux:

```bash
ln -s /path/to/ai-3d-model-workbench \
  /path/to/your-vault/.obsidian/plugins/ai-3d-model-workbench
```

3. In this repository, run `npm install` once if needed.
4. Run `npm run dev` while developing.
5. In Obsidian, enable `AI 3D Model Workbench` in `Settings > Community Plugins`.

### After Install

1. Put a supported model file into the same vault, for example `model.glb`.
2. In any note inside that vault, embed it like this:

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

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

#### 1. Inline Embed

Write a wikilink anywhere in your note. Works in Reading and Live Preview.

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

#### 2. `3d` Code Block

**Quick** — file path only:

````markdown
```3d model.glb
```
````

**Full config** — camera, lights, scene, multi-model:

````markdown
```3d
{
  "models": [
    { "path": "model.glb" },
    { "path": "part.stl", "color": "#ff0000", "wireframe": true }
  ],
  "camera": { "fov": 30, "position": [5, 5, 5] },
  "lights": [
    { "type": "hemisphere", "color": "#fff", "intensity": 1 },
    { "type": "directional", "position": [10, 20, 10] }
  ],
  "scene": { "autoRotate": true, "grid": true },
  "width": "100%",
  "height": 500
}
```
````

| Section | Key fields |
|---------|------------|
| `models[]` | `path` (required), `color`, `wireframe` |
| `camera` | `fov`, `position`, `lookAt`, `mode` (`"perspective"` / `"orthographic"`) |
| `lights[]` | `type` (`"hemisphere"` `"directional"` `"point"` `"spot"` `"ambient"` `"attachToCam"`), `color`, `intensity`, `position` |
| `scene` | `background`, `autoRotate`, `autoRotateSpeed`, `grid`, `axis`, `groundShadow`, `transparent` |
| `stl` | `color`, `wireframe` (defaults for STL files) |
| top-level | `width`, `height` |

#### 3. `3dgrid` Code Block

Render multiple models in one viewport using layout presets.

````markdown
```3dgrid
{
  "models": [
    { "path": "v1.step" },
    { "path": "v2.step" },
    { "path": "v3.step" }
  ],
  "preset": "compare"
}
```
````

| Preset | Layout |
|--------|--------|
| `compare` | Side-by-side A/B |
| `showcase` | Multi-angle single model |
| `explode` | Ring arrangement |
| `timeline` | Horizontal strip |
| `gallery` | All in one scene (default) |
| `compose` | Custom sections |

`3dgrid` accepts the same `camera`, `lights`, `scene` fields as `3d`, plus: `preset`, `params`, `columns`, `rowHeight`, `gapX`, `gapY`, `sections`, `direction`.

#### 4. Direct File View

Click any `.glb`/`.gltf`/`.stl`/`.obj`/`.ply`/`.splat` file in the file explorer.

#### Supported Extensions

| Type | Formats |
|------|---------|
| Direct | `.glb` `.gltf` `.stl` `.obj` `.ply` `.splat` |
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
| Snapshot naming | model-name | File naming mode for exported PNG snapshots |
| Report folder | Analysis/3D Reports | Knowledge notes folder |
| Log level | warn | Console log verbosity |

### Converter Settings

| Setting | Description |
|---------|-------------|
| Enable CAD converter | Enable STEP/IGES/BREP via CadQuery |
| Enable SLDPRT converter | Enable SolidWorks via FreeCAD |
| Enable mesh converter | Enable 3MF/DAE via trimesh |
| Enable OBJ2GLTF converter | Optional OBJ normalization through obj2gltf |
| Enable FBX2glTF converter | Enable FBX conversion through FBX2glTF |
| Python command path (for CAD conversion) | Override the Python executable used for STEP/IGES/BREP conversion |
| FreeCADCmd path (for SLDPRT conversion) | Override the FreeCAD executable used for `.sldprt` conversion |
| obj2gltf command path | Override the obj2gltf CLI path |
| FBX2glTF command path | Override the FBX2glTF CLI path |
| Python command path (for 3MF/DAE conversion) | Override the Python executable used for 3MF/DAE conversion |
| Converter command diagnostics | Show which executable path the plugin will actually use and run lightweight dependency self-checks |

### Portability and diagnostics

The rendering layer is cross-platform: direct formats like GLB, OBJ, STL, PLY, SPLAT, and already-converted `.ai3d-converted.glb` assets can render anywhere Obsidian Desktop can provide WebGL.

The conversion layer is less portable because it depends on local tools and Python environments that vary by machine. Use the converter diagnostics panel in plugin settings as the first check when a CAD or mesh format fails. It verifies both the executable path the plugin resolved and whether the selected Python environment can import the required packages.

On macOS in particular, the system Python at `/usr/bin/python3` often exists but does not include CAD packages. If diagnostics show that path and the self-check fails, install a separate Python environment and point the plugin setting to that interpreter explicitly.

---

## External Dependencies

Only needed for CAD, FBX, and mesh conversion. Direct formats work without any external tools.

### Python + CadQuery (STEP, IGES, BREP)

```bash
# Install
pip install cadquery trimesh
```

Verify with the Python command your OS uses:

- Windows: `py -c "import cadquery; print('OK')"`
- macOS / Linux: `python3 -c "import cadquery; print('OK')"`

If diagnostics resolve to `/usr/bin/python3` on macOS and the import check fails, install a separate Python (for example Homebrew Python), install `cadquery` and `trimesh` there, then set that interpreter path in plugin settings.

### FreeCAD (SLDPRT)

Install FreeCAD for your platform:

- Windows: install from [freecad.org/downloads](https://www.freecad.org/downloads.php)
- macOS: install the app bundle or use `brew install --cask freecad`
- Linux: install your distro's FreeCAD package and make sure `freecadcmd` is available

Auto-discovery paths:
- Windows: `%LOCALAPPDATA%\Programs\FreeCAD*\bin\FreeCADCmd.exe`
- macOS: `/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd`, `/usr/local/bin/FreeCADCmd`, `/opt/homebrew/bin/FreeCADCmd`
- Linux: `/usr/bin/freecadcmd`

### Python + trimesh (3MF, DAE)

```bash
pip install trimesh numpy networkx pycollada
```

**Auto-discovery**: Same Python as CadQuery (see above).

**Override**: Environment variable `AI3D_ASSIMP_CMD`.

### obj2gltf (OBJ, optional)

The plugin already has a built-in OBJ loader. obj2gltf is an optional alternative that can produce higher-fidelity GLB output.

**Install**:

```bash
npm install -g obj2gltf
```

**Auto-discovery**: The plugin looks for `obj2gltf.cmd` on Windows, and `obj2gltf` in standard macOS/Linux locations such as `/usr/local/bin/obj2gltf` and `/opt/homebrew/bin/obj2gltf`.

**Enable**: Settings > Enable OBJ2GLTF converter, or set "obj2gltf path".

### FBX2glTF (FBX)

FBX files are converted to GLB through the local FBX2glTF binary. The older community FBX loader is not bundled because its current release targets Babylon.js 8, while this plugin uses Babylon.js 9.

**Install**:

Download or build [FBX2glTF](https://github.com/godotengine/FBX2glTF) for your platform and place the binary in a known location.

**Auto-discovery**:

```text
C:\Program Files\FBX2glTF\FBX2glTF-windows-x64.exe
C:\Program Files\FBX2glTF\FBX2glTF.exe
/usr/local/bin/FBX2glTF
/opt/homebrew/bin/FBX2glTF
/usr/local/bin/fbx2gltf
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
