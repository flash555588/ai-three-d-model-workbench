# AI 3D Model Workbench

An Obsidian plugin that renders 3D models in a Babylon.js viewport and connects them to your knowledge notes. Supports common mesh formats out of the box, with optional CAD and FBX conversion for engineering files.

## Features

### Format Support

**Direct rendering** (no external tools required):

| Format | Description |
|--------|------------|
| GLB / GLTF | Industry-standard 3D format, full material and animation support |
| STL | Binary and ASCII STL, with per-face color extraction (VisCAM/SolidView) |
| OBJ | Wavefront OBJ with MTL material and vault-relative texture resolution |
| PLY | Stanford PLY, vertex colors, triangulated mesh and point cloud |
| SPLAT | Gaussian Splatting point clouds |

**Conversion** (requires external tools, configurable in settings):

| Format | Tool | Notes |
|--------|------|-------|
| STEP / STP | Python + CadQuery/OCCT | Per-face color via XDE |
| IGES / IGS | Python + CadQuery/OCCT | Geometry only |
| BREP | Python + CadQuery/OCCT | Native OpenCASCADE format |
| SLDPRT | FreeCAD | SolidWorks parts |
| 3MF / DAE | Python + trimesh | Mesh conversion via Assimp |
| FBX | FBX2glTF | Autodesk FBX converted to GLB |

### Rendering

- **Babylon.js 9.6** engine with WebGL 2
- Click-to-highlight picking with per-material cloning
- Explosion view (world-space displacement)
- Orientation gizmo, bounding box overlay
- Configurable camera (perspective/orthographic, FOV, named presets)
- Configurable lights (hemisphere, point, spot, directional)
- Resolution scale and quality presets (low/medium/high)
- Mobile-aware hardware scaling

### Grid System

Render multiple models in a single viewport using `3dgrid` code blocks:

- **compare** — side-by-side A/B layout
- **showcase** — multi-angle single model
- **explode** — ring arrangement
- **timeline** — horizontal strip
- **gallery** — all models in one scene, single camera
- **compose** — combine multiple presets into custom layouts

One engine, one WebGL context regardless of grid size. Per-cell viewports with LayerMask isolation.

### Embedding

- **Code blocks**: ` ```3d model.glb` or ` ```3dgrid ... ` with JSON config
- **Live Preview**: `![[model.glb]]` renders inline in the editor (supports size syntax `![[model.glb|400x300]]`)
- **Direct view**: Open `.glb`, `.gltf`, `.stl` files directly in a viewer tab

### Knowledge Notes

Generate structured Markdown notes from loaded models:

- Frontmatter with format, source path, mesh/triangle/material counts
- Geometry summary table
- Configurable output folder
- Duplicate detection via vault adapter

### Snapshots

- Copy snapshot to clipboard
- Export snapshot to vault (configurable folder and naming)
- Download snapshot as PNG

## Installation

### From Obsidian Community Plugins

Not yet published. See manual installation below.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `ai-3d-model-workbench` in your vault's `.obsidian/plugins/`
3. Place the three files in that folder
4. Enable the plugin in Obsidian Settings > Community Plugins

### Build from Source

```bash
npm install
npm run build
```

The output `main.js` (~1.7 MB, dominated by Babylon.js core) goes into `.obsidian/plugins/ai-3d-model-workbench/`.

## Settings

| Setting | Default | Description |
|---------|---------|------------|
| Canvas height | 400 | Default preview height in pixels |
| Auto-rotate | off | Start models with turntable animation |
| Auto-rotate speed | 0.5 | Turntable speed |
| Render quality | high | Resolution quality preset |
| Render scale | 1.0 | Resolution multiplier (0.25-2.0) |
| Snapshot folder | Media/3D Previews | Vault folder for exported snapshots |
| Snapshot naming | model-name | File naming strategy |
| Report folder | Analysis/3D Reports | Vault folder for knowledge notes |
| Enabled converters | freecad, sldprt | Which conversion tools are active |
| Converter commands | (auto-discover) | Override path to Python/FreeCADCmd/obj2gltf/FBX2glTF |

## External Dependencies

CAD and mesh conversion require external tools. The plugin auto-discovers them on PATH; override in settings if needed.

| Converter | Requirement | Install |
|-----------|------------|---------|
| freecad (STEP/IGES/BREP) | Python 3 + cadquery + trimesh | `pip install cadquery trimesh` |
| sldprt (SolidWorks) | FreeCAD with Python bindings | [freecad.org/downloads](https://www.freecad.org/downloads.php) |
| assimp (3MF/DAE) | Python 3 + trimesh | `pip install trimesh` |
| obj2gltf (OBJ) | Node.js + obj2gltf | `npm install -g obj2gltf` |
| fbx2gltf (FBX) | FBX2glTF binary | [github.com/godotengine/FBX2glTF](https://github.com/godotengine/FBX2glTF) |

## Usage

### Quick Start

1. Drop a `.glb`, `.stl`, or `.obj` file into your vault
2. In any note, type `![[your-model.glb]]` — the model renders inline in Live Preview
3. Use the toolbar buttons to copy/download snapshots, or generate a knowledge note

### Three Ways to Embed

**1. Live Preview embed** — simplest, for single files:

```markdown
![[model.glb]]
![[model.glb|400x300]]   ← custom size
![[bunny.stl]]            ← STL files work too
```

**2. 3d code block** — for custom camera, lights, or scene config:

````markdown
```3d model.glb
```
````

Or with full config:

````markdown
```3d
{
  "models": [{ "path": "model.glb" }],
  "camera": { "fov": 30 },
  "scene": { "autoRotate": true, "grid": true }
}
```
````

**3. 3dgrid code block** — for multi-model comparison:

````markdown
```3dgrid
{
  "models": [
    { "path": "design_v1.step" },
    { "path": "design_v2.step" }
  ],
  "preset": "compare"
}
```
````

**4. Direct file view** — click any `.glb`/`.gltf`/`.stl` file in the file explorer to open it in a full viewer tab.

### Working with CAD Files (STEP, IGES, BREP, SLDPRT)

CAD files require external conversion tools. See [Third-Party Software Setup](#third-party-software-setup) below.

Once configured, use CAD files the same way as mesh files:

```markdown
![[engine_block.step]]
![[housing.iges]]
![[bracket.sldprt]]
```

The plugin automatically converts the file to GLB on first load, caches the result, and renders it. Subsequent loads use the cache.

### Grid Presets

| Preset | Use case | Example |
|--------|----------|---------|
| `compare` | Side-by-side A/B comparison | Before/after designs |
| `showcase` | Multi-angle view of one model | Product photography |
| `explode` | Ring arrangement | Assembly breakdown |
| `timeline` | Horizontal strip | Version history |
| `gallery` | All models, single camera | Parts catalog |
| `compose` | Custom multi-section layout | Mixed presentation |

### Knowledge Notes

Click the "Generate Note" button in the workbench to create a structured Markdown note:

- Frontmatter: format, source path, file size, mesh/triangle/material counts
- Geometry summary table
- Configurable output folder (`Analysis/3D Reports` by default)
- Duplicate detection: won't overwrite existing notes

### Snapshots

Three snapshot options appear below every preview:

- **Copy** — copy PNG to clipboard (paste into any app)
- **Save** — export to vault folder (`Media/3D Previews` by default)
- **Download** — download as PNG file

### STL Color Support

Binary STL files with per-face colors (VisCAM/SolidView format) are automatically detected and rendered. The 15-bit RGB encoding in the 2-byte attribute field is decoded per-face.

### OBJ with Textures

OBJ files with MTL material libraries are supported. Texture paths are resolved relative to the OBJ file location within the vault. The plugin searches multiple candidates (full path, same-directory filename, basename variants) to find textures.

## Third-Party Software Setup

The plugin works immediately with GLB, GLTF, STL, OBJ, PLY, and SPLAT files. For CAD formats, FBX, and enhanced conversion, install optional tools below.

### Python + CadQuery (STEP, IGES, BREP)

**What it does**: Reads STEP/STP, IGES/IGS, and BREP files using OpenCASCADE, extracts per-face colors (STEP only), and exports to GLB.

**Install**:

```bash
# Windows (using py launcher)
py -m pip install cadquery trimesh

# macOS / Linux
pip3 install cadquery trimesh
```

**Verify**:

```bash
py -c "import cadquery; print('CadQuery OK')"
py -c "import trimesh; print('trimesh OK')"
```

**Auto-discovery**: The plugin looks for `py` (Windows) or `python3` (macOS/Linux) on PATH. On Apple Silicon, it also checks `/opt/homebrew/bin/python3`.

**Override**: Set the Python command in Settings > "Python command (CadQuery)" or environment variable `AI3D_FREECAD_CMD`.

### FreeCAD (SLDPRT)

**What it does**: Imports SolidWorks `.sldprt` files via FreeCAD, exports to STEP as intermediate, then triangulates to GLB via OpenCASCADE.

**Install**:

Download and install FreeCAD from [freecad.org/downloads](https://www.freecad.org/downloads.php). The plugin uses `FreeCADCmd.exe` (console mode, no GUI required).

**Auto-discovery** (Windows):

```
%LOCALAPPDATA%\Programs\FreeCAD 1.1\bin\FreeCADCmd.exe
%LOCALAPPDATA%\Programs\FreeCAD 1.0\bin\FreeCADCmd.exe
%LOCALAPPDATA%\Programs\FreeCAD 0.21\bin\FreeCADCmd.exe
C:\Program Files\FreeCAD\bin\FreeCADCmd.exe
```

**Auto-discovery** (macOS):

```
/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd
/opt/homebrew/bin/freecadcmd
```

**Auto-discovery** (Linux):

```
/usr/bin/freecadcmd
/usr/local/bin/freecadcmd
/snap/freecad/current/usr/bin/freecadcmd
```

**Override**: Set the FreeCADCmd path in Settings > "FreeCADCmd path (for SLDPRT)" or environment variable `AI3D_FREECMDCMD`.

**Timeout**: SLDPRT import can be slow for complex assemblies. The converter has a 10-minute timeout.

### Python + trimesh (3MF, DAE)

**What it does**: Converts 3MF and COLLADA (DAE) files to GLB using trimesh + Assimp.

**Install**:

```bash
py -m pip install trimesh    # Windows
pip3 install trimesh          # macOS / Linux
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

All converter commands can be overridden via environment variables:

| Variable | Converter |
|----------|-----------|
| `AI3D_FREECAD_CMD` | Python (CadQuery/OCCT) |
| `AI3D_FREECMDCMD` | FreeCADCmd (SLDPRT) |
| `AI3D_ASSIMP_CMD` | Python (trimesh) |
| `AI3D_OBJ2GLTF_CMD` | obj2gltf |
| `AI3D_FBX2GLTF_CMD` | FBX2glTF |

## Demo

See [`docs/demo.md`](docs/demo.md) for a complete walkthrough with examples for every feature.

## Architecture

```
src/
  main.ts                          Plugin lifecycle, commands, state
  domain/models.ts                 Shared interfaces
  domain/constants.ts              Default settings, supported extensions
  store/                           Custom store + Obsidian saveData bridge
  render/babylon/                  Babylon.js scene, grid, presets, loaders
    loaders/                       Custom STL, PLY parsers + Babylon SceneLoader plugins
    presets/                       compare, showcase, explode, timeline, gallery, compose
  io/formats/                      Format registry, routing preferences
  io/conversion/                   Conversion manager, adapters (Python/CLI bridges)
    adapters/                      freecad, sldprt, assimp, obj2gltf, fbx2gltf
  view/workbench/                  Two-zone layout (stable preview + replaceable panels)
  view/inline/                     Code blocks, live preview, helper buttons
  view/direct-view.ts              Direct file opening (.glb/.gltf/.stl)
  settings.ts                      PluginSettingTab
  utils/                           Path resolution, formatting, device detection
```

## Supported Platforms

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Obsidian Mobile (reduced resolution via hardware scaling)
- **Minimum Obsidian version**: 1.5.0

## License

MIT
