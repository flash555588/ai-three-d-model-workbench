export const en = {
  // Section headers
  "settings.title": "AI 3D model workbench",
  "settings.folders": "Folders",
  "settings.behavior": "Behavior",
  "settings.converters": "Converters",
  "settings.paths": "Converter Paths",
  "settings.diagnostics": "Converter command diagnostics",
  "settings.performance": "Performance & Display",

  // Folders
  "settings.sourceModelFolder": "Source model folder",
  "settings.sourceModelFolder.desc": "Vault folder where source 3D models are stored.",
  "settings.reportFolder": "Report folder",
  "settings.reportFolder.desc": "Vault folder where generated knowledge notes are saved.",
  "settings.snapshotFolder": "Snapshot folder",
  "settings.snapshotFolder.desc": "Vault folder where exported snapshots are saved.",

  // Behavior
  "settings.autoGenerateKnowledgeNotes": "Auto-generate knowledge notes",
  "settings.autoGenerateKnowledgeNotes.desc": "Automatically create a knowledge note when saving a model profile.",
  "settings.autoRotateDefault": "Auto-rotate by default",
  "settings.autoRotateDefault.desc": "Start 3D previews with auto-rotation enabled.",
  "settings.snapshotNaming": "Snapshot naming",
  "settings.snapshotNaming.desc": "How exported snapshot files are named.",
  "settings.snapshotNaming.modelName": "Model name + timestamp",
  "settings.snapshotNaming.timestamp": "Timestamp only",
  "settings.logLevel": "Log level",
  "settings.logLevel.desc": "Controls plugin runtime log verbosity in the developer console.",
  "settings.language": "Language",
  "settings.language.desc": "Display language for plugin settings. Takes effect immediately.",

  // Converters
  "settings.enableCad": "Enable CAD converter (STEP / IGES / BREP)",
  "settings.enableCad.desc": "Enable CAD conversion route for STEP/IGES/BREP formats via Python CadQuery (OpenCASCADE). Requires: pip install cadquery trimesh.",
  "settings.enableObj2gltf": "Enable obj2gltf converter (experimental)",
  "settings.enableObj2gltf.desc": "Keep OBJ direct loading as default. Enable this only if you want an optional local normalization route through obj2gltf.",
  "settings.preferObj2gltf": "Prefer obj2gltf for OBJ",
  "settings.preferObj2gltf.desc": "Recommended default is off. Turn this on only when you want normalized GLB outputs or direct OBJ loading is not good enough.",
  "settings.enableFbx2gltf": "Enable FBX2glTF converter",
  "settings.enableFbx2gltf.desc": "Enable conversion route for FBX files via FBX2glTF. Requires the FBX2glTF binary installed locally.",
  "settings.enableMesh": "Enable mesh converter (3MF/DAE)",
  "settings.enableMesh.desc": "Enable conversion route for 3MF and DAE (Collada) formats via Python trimesh. Requires Python with trimesh installed (pip install trimesh numpy networkx pycollada).",
  "settings.enableSldprt": "Enable SLDPRT converter (SolidWorks)",
  "settings.enableSldprt.desc": "Enable conversion route for SolidWorks .sldprt files via FreeCAD. Requires FreeCAD installed (https://www.freecad.org/downloads.php).",

  // Converter paths
  "settings.pythonCmd": "Python command path (for CAD conversion)",
  "settings.pythonCmd.desc": "Optional path to Python executable for CAD conversion. Overrides auto-discovery and AI3D_FREECAD_CMD when set.",
  "settings.freecadCmd": "FreeCADCmd path (for SLDPRT conversion)",
  "settings.freecadCmd.desc": "Optional path to FreeCADCmd.exe for SolidWorks file conversion. Overrides auto-discovery and AI3D_FREECMDCMD when set.",
  "settings.obj2gltfCmd": "obj2gltf command path",
  "settings.obj2gltfCmd.desc": "Optional path to obj2gltf CLI. Overrides auto-discovery and AI3D_OBJ2GLTF_CMD when set.",
  "settings.fbx2gltfCmd": "FBX2glTF command path",
  "settings.fbx2gltfCmd.desc": "Optional path to FBX2glTF CLI. Overrides auto-discovery and AI3D_FBX2GLTF_CMD when set.",
  "settings.assimpCmd": "Python command path (for 3MF/DAE conversion)",
  "settings.assimpCmd.desc": "Optional path to Python executable. Overrides auto-discovery and AI3D_ASSIMP_CMD when set.",

  // Diagnostics
  "settings.diagnostics.desc": "Shows the exact executable path the plugin would use right now. This is the same discovery chain used by runtime conversion and cache identity.",
  "settings.diagnostics.checkNow": "Check now",
  "settings.diagnostics.checking": "Checking...",
  "settings.diagnostics.refreshed": "AI 3D converter command diagnostics refreshed.",
  "settings.diagnostics.checkingAvailability": "Checking converter command availability...",

  // Performance
  "settings.canvasHeight": "Default canvas height",
  "settings.canvasHeight.desc": "Default height (px) for inline 3D previews. Range: 200–800.",
  "settings.autoRotateSpeed": "Auto-rotate speed",
  "settings.autoRotateSpeed.desc": "Rotation speed when auto-rotate is enabled. Range: 0.1–2.0.",
  "settings.renderQuality": "Render quality",
  "settings.renderQuality.desc": "Higher quality uses more GPU resources. Affects anti-aliasing and resolution.",
  "settings.renderScale": "Resolution scale",
  "settings.renderScale.desc": "Render resolution multiplier. 1.0 = native, 0.5 = half, 2.0 = double (supersampling). Range: 0.25–2.0.",
} as const;

export type TranslationKey = keyof typeof en;
