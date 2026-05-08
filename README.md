# AI 3D Model Workbench

An Obsidian plugin that renders 3D models in a Babylon.js viewport and connects them to your knowledge notes. Supports 17 formats out of the box, with automatic CAD-to-mesh conversion for engineering files.


<img width="2132" height="1502" alt="image" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />


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

The plugin works immediately with GLB, GLTF, STL, OBJ, PLY, SPLAT, and FBX files. For CAD formats and enhanced conversion, install optional tools below.

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

### FBX2glTF (FBX, optional)

The plugin has a built-in FBX loader. FBX2glTF is an optional alternative for better material support.

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

## Model Import Pipeline

### Overview

The plugin implements a multi-stage pipeline to load 3D models from Obsidian's vault into Babylon.js for rendering. The pipeline handles format detection, routing, data loading, and rendering with format-specific optimizations.

### Architecture Principles

**1. Format Registry Pattern**

All supported formats are registered in a central registry (`src/io/formats/registry.ts`) with metadata:

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

This allows the pipeline to make routing decisions without hardcoded conditionals.

**2. Two-Tier Loading Strategy**

The plugin uses a two-tier strategy to balance performance and compatibility:

- **Direct formats**: Loaded directly into Babylon.js via built-in or custom loaders. No external tools required.
- **Conversion formats**: Converted to GLB via external tools before rendering. Requires Python/CLI tools.

**3. Data URL vs Direct Buffer**

Babylon.js SceneLoader accepts data URLs for loading models. However, custom SceneLoader plugins (STL, PLY) have a known issue in Babylon v9 where data URLs are not properly converted to ArrayBuffer before being passed to the plugin's `importMeshAsync` method.

**Solution**: For custom loaders (STL, PLY), the plugin bypasses SceneLoader entirely and calls the parser directly with the raw ArrayBuffer.

```
SceneLoader.ImportMeshAsync() flow:
┌─────────────────────────────────────────────────────────────┐
│  data:application/octet-stream;base64,...                    │
│       │                                                      │
│       ▼                                                      │
│  Babylon SceneLoader                                         │
│       │                                                      │
│       ├─ Built-in loaders (GLTF, OBJ, SPLAT):               │
│       │   └─ Correctly decodes data URL → ArrayBuffer        │
│       │                                                      │
│       └─ Custom plugins (STL, PLY):                          │
│           └─ May receive data URL string instead of buffer   │
│              (Babylon v9 bug)                                 │
└─────────────────────────────────────────────────────────────┘

Direct buffer loading (workaround):
┌─────────────────────────────────────────────────────────────┐
│  readBinaryPath() → ArrayBuffer                              │
│       │                                                      │
│       ▼                                                      │
│  loadSTLBuffer(scene, data)  or  loadPLYBuffer(scene, data)  │
│       │                                                      │
│       ▼                                                      │
│  Direct binary parsing → Babylon Mesh                        │
└─────────────────────────────────────────────────────────────┘
```

**4. Obsidian Vault Integration**

The plugin integrates with Obsidian's vault system for file access:

- **readBinaryPath()**: Reads files as ArrayBuffer via Obsidian's `vault.adapter.readBinary()`
- **resolveVaultPath()**: Resolves wiki-link style paths (`[[model.glb]]`) to vault-relative paths
- **resolveVaultAbsolutePath()**: Converts vault-relative paths to filesystem absolute paths (required for conversion)

**5. State Management**

The plugin uses a custom store primitive (`src/store/create-store.ts`) with:

- **getState()**: Read current state
- **setState()**: Update state (triggers subscribers)
- **subscribe()**: React to state changes
- **Obsidian bridge**: Persists state via `loadData()`/`saveData()` with 500ms debounce

### Loading Strategy

The plugin uses a two-tier loading strategy to handle different format families:

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

### Direct Formats

Direct formats are loaded directly into Babylon.js without external tools:

| Format | Loader | Notes |
|--------|--------|-------|
| GLB / GLTF | Babylon built-in `GLTFFileLoader` | Full material, animation, PBR support |
| STL | Custom `stl-loader.ts` | Binary-only, per-face color (VisCAM/SolidView) |
| OBJ | Babylon built-in `OBJFileLoader` | MTL support, vault-relative texture resolution |
| PLY | Custom `ply-loader.ts` | ASCII/binary, vertex colors, point cloud |
| SPLAT | Babylon built-in `SPLATFileLoader` | Gaussian Splatting point clouds |
| FBX | Community `babylonjs-fbx-loader` | Via SceneLoader plugin |

### Conversion Formats

Conversion formats require external tools and are converted to GLB before rendering:

| Format | Converter | Intermediate | Output |
|--------|-----------|--------------|--------|
| STEP / STP | CadQuery + OCCT | Direct triangulation | GLB |
| IGES / IGS | CadQuery + OCCT | Direct triangulation | GLB |
| BREP | CadQuery + OCCT | Direct triangulation | GLB |
| SLDPRT | FreeCAD | STEP → GLB | GLB |
| 3MF | trimesh + Assimp | Direct mesh | GLB |
| DAE | trimesh + Assimp | Direct mesh | GLB |

### Format Parsing Details

#### STL (Stereolithography)

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

**Parsing Steps**:
1. Validate buffer size (≥84 bytes)
2. Detect ASCII STL (starts with "solid") and reject
3. Read triangle count from offset 80
4. Validate buffer size (≥84 + count×50 bytes)
5. Pre-scan for per-face colors (VisCAM/SolidView 15-bit RGB in attribute bytes)
6. Extract positions, recompute normals (cross product), extract colors
7. Create Babylon `VertexData` and apply to mesh

**Color Encoding** (VisCAM/SolidView):
- Bit 15: Color flag (1 = has color)
- Bits 10-14: Blue (5-bit)
- Bits 5-9: Green (5-bit)
- Bits 0-4: Red (5-bit)

#### PLY (Stanford Triangle Format)

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

**Parsing Steps**:
1. Decode header as ASCII text
2. Parse format, elements, and properties
3. Detect binary vs ASCII format
4. For binary: read vertices and faces using `DataView` with correct endianness
5. For ASCII: parse line-by-line
6. Triangulate faces (fan method for polygons)
7. Compute normals from face geometry
8. Apply vertex colors if present

**Supported Property Types**: uchar, char, ushort, short, uint, int, float, double

#### OBJ (Wavefront OBJ)

**Loading Flow**:
1. Parse OBJ text to find `mtllib` reference
2. Load MTL file from vault (relative to OBJ location)
3. Resolve texture paths:
   - Full relative path
   - Same-directory filename
   - OBJ-name with image extensions
   - Original texture basename with different extensions
4. Override Babylon's `_loadMTL` to use vault content
5. Call `SceneLoader.ImportMeshAsync()` with MTL content

**Texture Resolution Priority**:
1. Full relative path from MTL
2. Same-directory exact filename
3. OBJ basename + common image extensions (jpg, png, bmp, tga, webp)
4. Texture basename + alternative extensions

#### GLB/GLTF (GL Transmission Format)

**Features Supported**:
- PBR materials (metallic-roughness workflow)
- Animations (skeletal, morph targets)
- Multiple meshes and materials
- Texture embedding (GLB) or external references (GLTF)
- Scene hierarchy and transforms

**Loading**: Uses Babylon's built-in `GLTFFileLoader` with full feature support.

#### SPLAT (Gaussian Splatting)

**Format**: Binary point cloud with per-point properties:
- Position (xyz)
- Color (rgb)
- Opacity
- Covariance (scale + rotation)

**Loading**: Uses Babylon's built-in `SPLATFileLoader` for Gaussian Splatting rendering.

#### FBX (Autodesk FBX)

**Loading**: Uses community `babylonjs-fbx-loader` package.

**Limitations**:
- Subject to Babylon v9 SceneLoader data-URL issue
- Complex FBX features (constraints, deformers) may not be fully supported
- Large FBX files may cause memory issues

**Workaround**: Enable FBX2glTF converter in settings for better compatibility.

### Complete Format Support Matrix

| Format | Extension | Family | Strategy | Loader | Materials | Colors | Animation | Point Cloud | External Tool |
|--------|-----------|--------|----------|--------|-----------|--------|-----------|-------------|---------------|
| GLB | .glb | mesh | direct | Babylon GLTF | PBR | Vertex | Yes | No | No |
| GLTF | .gltf | mesh | direct | Babylon GLTF | PBR | Vertex | Yes | No | No |
| STL | .stl | mesh | direct | Custom | Basic | Per-face | No | No | No |
| OBJ | .obj | mesh | direct | Babylon OBJ | MTL | No | No | No | No |
| PLY | .ply | mesh | direct | Custom | Basic | Vertex | No | Yes | No |
| SPLAT | .splat | point-cloud | direct | Babylon SPLAT | No | Per-point | No | Yes | No |
| FBX | .fbx | mesh | direct | Community | Basic | No | Yes | No | No |
| STEP | .step | cad | convert | CadQuery | No | Per-face | No | No | Python + CadQuery |
| STP | .stp | cad | convert | CadQuery | No | Per-face | No | No | Python + CadQuery |
| IGES | .iges | cad | convert | CadQuery | No | No | No | No | Python + CadQuery |
| IGS | .igs | cad | convert | CadQuery | No | No | No | No | Python + CadQuery |
| BREP | .brep | cad | convert | CadQuery | No | No | No | No | Python + CadQuery |
| SLDPRT | .sldprt | cad | convert | FreeCAD | No | No | No | No | FreeCAD |
| 3MF | .3mf | mesh | convert | trimesh | Basic | No | No | No | Python + trimesh |
| DAE | .dae | mesh | convert | trimesh | Basic | No | No | No | Python + trimesh |

**Legend**:
- **PBR**: Physically-Based Rendering materials (metallic-roughness workflow)
- **Basic**: Standard diffuse material
- **Vertex**: Per-vertex color support
- **Per-face**: Per-face/triangle color support
- **Per-point**: Per-point color and opacity

### Format Feature Details

| Feature | GLB/GLTF | STL | OBJ | PLY | SPLAT | FBX | CAD (STEP etc.) |
|---------|----------|-----|-----|-----|-------|-----|-----------------|
| Mesh rendering | Yes | Yes | Yes | Yes | No | Yes | Yes (converted) |
| Point cloud | No | No | No | Yes | Yes | No | No |
| Materials | Full PBR | Basic | MTL | Basic | No | Basic | No |
| Textures | Embedded | No | External | No | No | No | No |
| Vertex colors | Yes | No | No | Yes | No | No | No |
| Face colors | No | Yes | No | No | No | No | Yes (STEP) |
| Animations | Yes | No | No | No | No | Yes | No |
| Scene hierarchy | Yes | No | No | No | No | Yes | No |
| Binary format | GLB | Yes | No | Yes | Yes | Yes | N/A |
| ASCII format | GLTF | Yes | Yes | Yes | No | No | N/A |

### Path Resolution

Model paths are resolved in this order:

1. **Link-style paths**: `metadataCache.getFirstLinkpathDest()` for Obsidian wiki-link syntax
2. **Vault-relative paths**: Direct path resolution from vault root
3. **Absolute paths**: Used for conversion output files

### Data Flow

```
User Input (```3d model.glb``` or ![[model.glb]])
    │
    ├─ resolveVaultPath() → vault-relative path
    │
    ├─ getFormatCapability() → format metadata
    │
    ├─ [Conversion formats only]
    │   ├─ resolveVaultAbsolutePath() → filesystem path
    │   ├─ convertForPreview() → run converter
    │   └─ read converted .ai3d-converted.glb
    │
    ├─ readBinaryPath() → ArrayBuffer
    │
    └─ BabylonModelPreview.loadModel(data, ext)
        ├─ STL/PLY: direct buffer parsing
        └─ Others: SceneLoader.ImportMeshAsync()
```

### Caching

Conversion results are cached to avoid redundant processing:

- **Cache location**: Same directory as source file, named `{filename}.ai3d-converted.glb`
- **Cache validation**: Checks converter identity, cache key, and file existence
- **Cache invalidation**: Automatic when converter settings change
- **Manual clear**: Command palette > "Clear Conversion Cache"

## Known Limitations

### Babylon.js v9 SceneLoader Data-URL Issue

Custom Babylon.js SceneLoader plugins (STL, PLY) do not receive raw `ArrayBuffer` data when loaded through `SceneLoader.ImportMeshAsync` with data URLs. The plugin works around this by using direct buffer parsing for these formats:

| Format | Loading Strategy | Status |
|--------|-----------------|--------|
| GLB / GLTF | Babylon built-in SceneLoader | Works correctly |
| STL | Direct `ArrayBuffer` parsing (bypasses SceneLoader) | Works correctly |
| PLY | Direct `ArrayBuffer` parsing (bypasses SceneLoader) | Works correctly |
| OBJ | Babylon built-in SceneLoader + MTL override | Works correctly |
| SPLAT | Babylon built-in SceneLoader | Works correctly |
| FBX | Community `babylonjs-fbx-loader` SceneLoader plugin | Subject to data-URL limitation |

**FBX workaround**: If FBX files fail to render, enable the FBX2glTF converter in settings (Settings > Enable FBX2glTF converter) to convert FBX to GLB before rendering.

### STL Format

- Only binary STL is supported. ASCII STL files are detected and rejected with an error message.
- Per-face colors use the VisCAM/SolidView 15-bit RGB encoding in the 2-byte attribute field.

### OBJ Format

- MTL texture paths are resolved relative to the OBJ file location within the vault.
- If textures are not found, the corresponding material lines are stripped to prevent red-black checkerboard placeholders.

### CAD Conversion

- STEP/IGES/BREP/SLDPRT formats require external tools (Python + CadQuery, or FreeCAD).
- Conversion results are cached in the source directory as `.ai3d-converted.glb` files.
- SLDPRT conversion has a 10-minute timeout for complex assemblies.

## Supported Platforms

- **Desktop**: Windows, macOS, Linux
- **Mobile**: Obsidian Mobile (reduced resolution via hardware scaling)
- **Minimum Obsidian version**: 1.5.0

## License

MIT
