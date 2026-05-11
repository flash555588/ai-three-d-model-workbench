export const en = {
  // Section headers
  "settings.title": "AI 3d model workbench",
  "settings.folders": "Folders",
  "settings.behavior": "Behavior",
  "settings.converters": "Converters",
  "settings.paths": "Converter paths",
  "settings.diagnostics": "Converter command diagnostics",
  "settings.performance": "Performance & display",

  // Folders
  "settings.sourceModelFolder": "Source model folder",
  "settings.sourceModelFolder.desc": "Vault folder where source model files are stored.",
  "settings.reportFolder": "Report folder",
  "settings.reportFolder.desc": "Vault folder where generated knowledge notes are saved.",
  "settings.snapshotFolder": "Snapshot folder",
  "settings.snapshotFolder.desc": "Vault folder where exported snapshots are saved.",

  // Behavior
  "settings.autoGenerateKnowledgeNotes": "Auto-generate knowledge notes",
  "settings.autoGenerateKnowledgeNotes.desc": "Reserved for a future automation flow. For now, generate notes manually from the command or the workbench button.",
  "settings.autoRotateDefault": "Auto-rotate by default",
  "settings.autoRotateDefault.desc": "Start model previews with auto-rotation enabled.",
  "settings.snapshotNaming": "Snapshot naming",
  "settings.snapshotNaming.desc": "How exported snapshot files are named.",
  "settings.snapshotNaming.modelName": "Model name + timestamp",
  "settings.snapshotNaming.timestamp": "Timestamp only",
  "settings.logLevel": "Log level",
  "settings.logLevel.desc": "Controls plugin runtime log verbosity in the developer console.",
  "settings.language": "Language",
  "settings.language.desc": "Display language for plugin settings. Takes effect immediately.",

  // Converters
  "settings.enableCad": "Enable cad conversion for step, iges, and brep files",
  "settings.enableCad.desc": "Enable cad conversion for step, iges, and brep formats. Requires cadquery and trimesh in your python environment.",
  "settings.enableObj2gltf": "Enable obj2gltf converter (experimental)",
  "settings.enableObj2gltf.desc": "Keep obj direct loading as the default. Enable this only if you want an optional local normalization route through obj2gltf.",
  "settings.preferObj2gltf": "Prefer obj2gltf for obj",
  "settings.preferObj2gltf.desc": "Recommended default is off. Turn this on only when you want normalized output files or direct obj loading is not good enough.",
  "settings.enableFbx2gltf": "Enable FBX2glTF converter",
  "settings.enableFbx2gltf.desc": "Enable conversion for fbx files via FBX2glTF. Requires the FBX2glTF binary installed locally.",
  "settings.enableMesh": "Enable mesh conversion for 3mf and dae files",
  "settings.enableMesh.desc": "Enable conversion for 3mf and dae formats via python trimesh. Requires trimesh, numpy, networkx, and pycollada in your python environment.",
  "settings.enableSldprt": "Enable sldprt conversion for SolidWorks files",
  "settings.enableSldprt.desc": "Enable conversion for SolidWorks sldprt files via FreeCAD. Requires FreeCAD installed locally.",

  // Converter paths
  "settings.pythonCmd": "Path to the python command for cad conversion",
  "settings.pythonCmd.desc": "Optional path to the python command used for cad conversion. Windows usually uses py. macOS and Linux usually use python3. Overrides auto-discovery when set.",
  "settings.freecadCmd": "Path to the FreeCAD command for sldprt conversion",
  "settings.freecadCmd.desc": "Optional path to the FreeCAD command used for SolidWorks file conversion. Windows usually uses FreeCADCmd.exe, macOS usually uses FreeCADCmd, and Linux usually uses freecadcmd. Overrides auto-discovery when set.",
  "settings.obj2gltfCmd": "Path to the obj2gltf command",
  "settings.obj2gltfCmd.desc": "Optional path to the obj2gltf command. Windows usually uses obj2gltf.cmd, and macOS and Linux usually use obj2gltf. Overrides auto-discovery when set.",
  "settings.fbx2gltfCmd": "FBX2glTF command path",
  "settings.fbx2gltfCmd.desc": "Optional path to the FBX2glTF command. Windows usually uses FBX2glTF.exe, and macOS and Linux usually use FBX2glTF. Overrides auto-discovery when set.",
  "settings.assimpCmd": "Path to the python command for 3mf and dae conversion",
  "settings.assimpCmd.desc": "Optional path to the python command used for 3mf and dae conversion. Windows usually uses py. macOS and Linux usually use python3. Overrides auto-discovery when set.",

  // Diagnostics
  "settings.diagnostics.desc": "Shows the exact executable path the plugin would use right now. This is the same discovery chain used by runtime conversion and cache identity.",
  "settings.diagnostics.checkNow": "Check now",
  "settings.diagnostics.checking": "Checking...",
  "settings.diagnostics.refreshed": "Converter command diagnostics refreshed.",
  "settings.diagnostics.checkingAvailability": "Checking converter command availability...",

  // Performance
  "settings.canvasHeight": "Default canvas height",
  "settings.canvasHeight.desc": "Default height (px) for inline model previews. Range: 200–800.",
  "settings.autoRotateSpeed": "Auto-rotate speed",
  "settings.autoRotateSpeed.desc": "Rotation speed when auto-rotate is enabled. Range: 0.1–2.0.",
  "settings.renderQuality": "Render quality",
  "settings.renderQuality.desc": "Higher quality uses more GPU resources. Affects anti-aliasing and resolution.",
  "settings.renderScale": "Resolution scale",
  "settings.renderScale.desc": "Render resolution multiplier. 1.0 = native, 0.5 = half, 2.0 = double (supersampling). Range: 0.25–2.0.",
} as const;

export type TranslationKey = keyof typeof en;
