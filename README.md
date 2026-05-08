# AI 3D Model Workbench

An Obsidian plugin that renders 3D models in a Babylon.js viewport and connects them to your knowledge notes. Supports 17 formats out of the box, with automatic CAD-to-mesh conversion for engineering files.

<img width="2132" height="1502" alt="image" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />

[简体中文](README.zh-CN.md)

## Features

### Format Support

**Direct rendering** (no external tools required):

| Format | Description |
|--------|------------|
| GLB / GLTF | Industry-standard 3D format, full material and animation support |
| STL | Binary STL with per-face color extraction (VisCAM/SolidView) |
| OBJ | Wavefront OBJ with MTL material and vault-relative texture resolution |
| PLY | Stanford PLY, vertex colors, triangulated mesh and point cloud |
| SPLAT | Gaussian Splatting point clouds |
| FBX | Autodesk FBX via built-in loader |

**CAD conversion** (requires external tools, configurable in settings):

| Format | Tool | Notes |
|--------|------|-------|
| STEP / STP | Python + CadQuery/OCCT | Per-face color via XDE |
| IGES / IGS | Python + CadQuery/OCCT | Geometry only |
| BREP | Python + CadQuery/OCCT | Native OpenCASCADE format |
| SLDPRT | FreeCAD | SolidWorks parts |
| 3MF / DAE | Python + trimesh | Mesh conversion via Assimp |

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

## Usage

### Quick Start

1. Drop a `.glb`, `.stl`, or `.obj` file into your vault
2. In any note, type `![[your-model.glb]]` — the model renders inline in Live Preview
3. Use the toolbar buttons to copy/download snapshots, or generate a knowledge note

### Embedding Methods

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

### Working with CAD Files

CAD files require external conversion tools. Once configured, use CAD files the same way as mesh files:

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

## Model Import Pipeline

### Overview

The plugin implements a multi-stage pipeline to load 3D models from Obsidian's vault into Babylon.js for rendering.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Model Import Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Format Detection                                            │
│     └─ normalizeModelExt() → getFormatCapability()              │
│                                                                 │
│  2. Route Decision                                              │
│     ├─ Direct formats → prepareDirectLoad()                     │
│     └─ Conversion formats → convertForPreview()                 │
│                                                                 │
│  3. Data Loading                                                │
│     ├─ readBinaryPath() → ArrayBuffer                           │
│     └─ Conversion: run converter → read converted GLB           │
│                                                                 │
│  4. Babylon Rendering                                           │
│     ├─ GLB/GLTF/OBJ/SPLAT → SceneLoader.ImportMeshAsync()      │
│     ├─ STL → loadSTLBuffer() (direct parse)                     │
│     └─ PLY → loadPLYBuffer() (direct parse)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Format Registry

All supported formats are registered in a central registry with metadata:

```typescript
interface FormatCapability {
  ext: string;              // File extension (e.g., "stl")
  family: "mesh" | "point-cloud" | "cad";  // Format family
  strategy: "direct" | "convert";           // Loading strategy
  directLoader?: string;    // Babylon loader identifier
  converterId?: string;     // External converter identifier
  outputFormat?: string;    // Conversion target format
  enabled: boolean;         // Runtime enable/disable
}
```

### Loading Strategy

**Direct formats** are loaded directly into Babylon.js via built-in or custom loaders. No external tools required.

**Conversion formats** are converted to GLB via external tools before rendering. Requires Python/CLI tools.

### Data URL vs Direct Buffer

Babylon.js SceneLoader accepts data URLs for loading models. However, custom SceneLoader plugins (STL, PLY) have a known issue in Babylon v9 where data URLs are not properly converted to ArrayBuffer before being passed to the plugin.

**Solution**: For custom loaders (STL, PLY), the plugin bypasses SceneLoader entirely and calls the parser directly with the raw ArrayBuffer.

## Format Parsing Details

### STL (Stereolithography)

**Binary STL Structure**:
```
Offset  Size    Description
0       80      Header (ignored)
80      4       Triangle count (uint32 LE)
84      50*N    Triangle records:
                - 12 bytes: Normal vector (3x float32)
                - 36 bytes: 3 vertices (3x 3x float32)
                - 2 bytes: Attribute byte count
```

**Color Encoding** (VisCAM/SolidView):
- Bit 15: Color flag (1 = has color)
- Bits 10-14: Blue (5-bit)
- Bits 5-9: Green (5-bit)
- Bits 0-4: Red (5-bit)

### PLY (Stanford Triangle Format)

**Header Format**:
```
ply
format ascii|binary_little_endian|binary_big_endian 1.0
element vertex <count>
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face <count>
property list uchar int vertex_indices
end_header
```

**Supported Property Types**: uchar, char, ushort, short, uint, int, float, double

### OBJ (Wavefront OBJ)

**Texture Resolution Priority**:
1. Full relative path from MTL
2. Same-directory exact filename
3. OBJ basename + common image extensions (jpg, png, bmp, tga, webp)
4. Texture basename + alternative extensions

## Complete Format Support Matrix

| Format | Extension | Family | Strategy | Materials | Colors | Animation | Point Cloud |
|--------|-----------|--------|----------|-----------|--------|-----------|-------------|
| GLB | .glb | mesh | direct | PBR | Vertex | Yes | No |
| GLTF | .gltf | mesh | direct | PBR | Vertex | Yes | No |
| STL | .stl | mesh | direct | Basic | Per-face | No | No |
| OBJ | .obj | mesh | direct | MTL | No | No | No |
| PLY | .ply | mesh | direct | Basic | Vertex | No | Yes |
| SPLAT | .splat | point-cloud | direct | No | Per-point | No | Yes |
| FBX | .fbx | mesh | direct | Basic | No | Yes | No |
| STEP | .step | cad | convert | No | Per-face | No | No |
| STP | .stp | cad | convert | No | Per-face | No | No |
| IGES | .iges | cad | convert | No | No | No | No |
| IGS | .igs | cad | convert | No | No | No | No |
| BREP | .brep | cad | convert | No | No | No | No |
| SLDPRT | .sldprt | cad | convert | No | No | No | No |
| 3MF | .3mf | mesh | convert | Basic | No | No | No |
| DAE | .dae | mesh | convert | Basic | No | No | No |

## Known Limitations

### Babylon.js v9 SceneLoader Data-URL Issue

Custom Babylon.js SceneLoader plugins (STL, PLY) do not receive raw `ArrayBuffer` data when loaded through `SceneLoader.ImportMeshAsync` with data URLs. The plugin works around this by using direct buffer parsing for these formats.

| Format | Loading Strategy | Status |
|--------|-----------------|--------|
| GLB / GLTF | Babylon built-in SceneLoader | Works correctly |
| STL | Direct `ArrayBuffer` parsing | Works correctly |
| PLY | Direct `ArrayBuffer` parsing | Works correctly |
| OBJ | Babylon built-in SceneLoader + MTL override | Works correctly |
| SPLAT | Babylon built-in SceneLoader | Works correctly |
| FBX | Community `babylonjs-fbx-loader` | Subject to data-URL limitation |

**FBX workaround**: If FBX files fail to render, enable the FBX2glTF converter in settings to convert FBX to GLB before rendering.

### Other Limitations

- **STL**: Only binary STL is supported. ASCII STL files are detected and rejected.
- **OBJ**: MTL texture paths are resolved relative to the OBJ file location within the vault.
- **CAD**: STEP/IGES/BREP/SLDPRT formats require external tools (Python + CadQuery, or FreeCAD).

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

## Deployment

### Development Environment

**Prerequisites**: Node.js >= 18, npm >= 9

```bash
npm install           # Install dependencies
npm run dev           # Development build with watch mode
npm run build         # Production build
npm run typecheck     # TypeScript type checking
```

### Build Output

| File | Size | Description |
|------|------|-------------|
| `main.js` | ~1.7 MB | Plugin code (Babylon.js core is ~98% of size) |
| `manifest.json` | ~1 KB | Obsidian plugin manifest |
| `styles.css` | ~5 KB | Plugin styles |

### Installation in Obsidian

**Method 1: Symlink (Development)**

```bash
# Windows (PowerShell as Administrator)
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\Documents\ObsidianVault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"

# macOS / Linux
ln -s /path/to/ai-3d-model-workbench \
  ~/Documents/ObsidianVault/.obsidian/plugins/ai-3d-model-workbench
```

**Method 2: Copy (Production)**

```bash
# Windows
copy main.js manifest.json styles.css `
  "$env:USERPROFILE\Documents\ObsidianVault\.obsidian\plugins\ai-3d-model-workbench\"

# macOS / Linux
cp main.js manifest.json styles.css \
  ~/Documents/ObsidianVault/.obsidian/plugins/ai-3d-model-workbench/
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI3D_FREECAD_CMD` | Python command for CadQuery | `py` (Windows) / `python3` (Unix) |
| `AI3D_FREECMDCMD` | FreeCADCmd path for SLDPRT | Auto-discover |
| `AI3D_ASSIMP_CMD` | Python command for trimesh | `py` (Windows) / `python3` (Unix) |
| `AI3D_OBJ2GLTF_CMD` | obj2gltf CLI path | Auto-discover |
| `AI3D_FBX2GLTF_CMD` | FBX2glTF binary path | Auto-discover |

### Debugging

1. Open Obsidian Settings > AI 3D Model Workbench
2. Set "Log level" to "Debug"
3. Open Developer Console (Ctrl+Shift+I / Cmd+Option+I)
4. Filter by `[AI3D]` to see plugin logs

## Supported Platforms

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Obsidian Mobile (reduced resolution via hardware scaling)
- **Minimum Obsidian version**: 1.5.0

## License

MIT
