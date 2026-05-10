import type { TranslationKey } from "./en";

export const zhCN: Record<TranslationKey, string> = {
  // 区块标题
  "settings.title": "AI 3D 模型工作台",
  "settings.folders": "文件夹",
  "settings.behavior": "行为",
  "settings.converters": "转换器",
  "settings.paths": "转换器路径",
  "settings.diagnostics": "转换器命令诊断",
  "settings.performance": "性能与显示",

  // 文件夹
  "settings.sourceModelFolder": "源模型文件夹",
  "settings.sourceModelFolder.desc": "存放源 3D 模型的库文件夹。",
  "settings.reportFolder": "报告文件夹",
  "settings.reportFolder.desc": "保存生成的知识笔记的库文件夹。",
  "settings.snapshotFolder": "快照文件夹",
  "settings.snapshotFolder.desc": "保存导出快照的库文件夹。",

  // 行为
  "settings.autoGenerateKnowledgeNotes": "自动生成知识笔记",
  "settings.autoGenerateKnowledgeNotes.desc": "预留给后续自动化流程。当前请通过命令或工作台按钮手动生成知识笔记。",
  "settings.autoRotateDefault": "默认自动旋转",
  "settings.autoRotateDefault.desc": "启动 3D 预览时默认开启自动旋转。",
  "settings.snapshotNaming": "快照命名",
  "settings.snapshotNaming.desc": "导出快照文件的命名方式。",
  "settings.snapshotNaming.modelName": "模型名 + 时间戳",
  "settings.snapshotNaming.timestamp": "仅时间戳",
  "settings.logLevel": "日志级别",
  "settings.logLevel.desc": "控制插件在开发者控制台中的日志详细程度。",
  "settings.language": "语言",
  "settings.language.desc": "插件设置界面的显示语言。立即生效。",

  // 转换器
  "settings.enableCad": "启用 CAD 转换器 (STEP/IGES/BREP)",
  "settings.enableCad.desc": "启用 STEP/IGES/BREP 格式的 CAD 转换路线，通过 Python CadQuery (OpenCASCADE)。需要：pip install cadquery trimesh",
  "settings.enableObj2gltf": "启用 obj2gltf 转换器（实验性）",
  "settings.enableObj2gltf.desc": "默认使用 OBJ 直接加载。仅在需要本地标准化 GLB 输出时启用。",
  "settings.preferObj2gltf": "OBJ 优先使用 obj2gltf",
  "settings.preferObj2gltf.desc": "默认关闭。仅在需要标准化 GLB 输出或直接 OBJ 加载效果不佳时开启。",
  "settings.enableFbx2gltf": "启用 FBX2glTF 转换器",
  "settings.enableFbx2gltf.desc": "启用 FBX 文件通过 FBX2glTF 转换。需要本地安装 FBX2glTF 二进制文件。",
  "settings.enableMesh": "启用网格转换器 (3MF/DAE)",
  "settings.enableMesh.desc": "启用 3MF 和 DAE (Collada) 格式的转换路线，通过 Python trimesh。需要安装 Python 和 trimesh (pip install trimesh numpy networkx pycollada)。",
  "settings.enableSldprt": "启用 SLDPRT 转换器 (SolidWorks)",
  "settings.enableSldprt.desc": "启用 SolidWorks .sldprt 文件通过 FreeCAD 转换。需要安装 FreeCAD (https://www.freecad.org/downloads.php)。",

  // 转换器路径
  "settings.pythonCmd": "Python 命令路径（CAD 用）",
  "settings.pythonCmd.desc": "可选的 Python 可执行文件路径，用于 CAD 转换。设置后覆盖自动发现和 AI3D_FREECAD_CMD。",
  "settings.freecadCmd": "FreeCADCmd 路径（SLDPRT 用）",
  "settings.freecadCmd.desc": "可选的 FreeCADCmd.exe 路径，用于 SolidWorks 文件转换。设置后覆盖自动发现和 AI3D_FREECMDCMD。",
  "settings.obj2gltfCmd": "obj2gltf 命令路径",
  "settings.obj2gltfCmd.desc": "可选的 obj2gltf CLI 路径。设置后覆盖自动发现和 AI3D_OBJ2GLTF_CMD。",
  "settings.fbx2gltfCmd": "FBX2glTF 命令路径",
  "settings.fbx2gltfCmd.desc": "可选的 FBX2glTF CLI 路径。设置后覆盖自动发现和 AI3D_FBX2GLTF_CMD。",
  "settings.assimpCmd": "Python 命令路径（3MF/DAE 用）",
  "settings.assimpCmd.desc": "可选的 Python 可执行文件路径。设置后覆盖自动发现和 AI3D_ASSIMP_CMD。",

  // 诊断
  "settings.diagnostics.desc": "显示插件当前实际使用的可执行文件路径。与运行时转换和缓存标识使用的发现链相同。",
  "settings.diagnostics.checkNow": "立即检查",
  "settings.diagnostics.checking": "检查中...",
  "settings.diagnostics.refreshed": "AI 3D 转换器命令诊断已刷新。",
  "settings.diagnostics.checkingAvailability": "正在检查转换器命令可用性...",

  // 性能
  "settings.canvasHeight": "默认画布高度",
  "settings.canvasHeight.desc": "内联 3D 预览的默认高度（像素）。范围：200–800。",
  "settings.autoRotateSpeed": "自动旋转速度",
  "settings.autoRotateSpeed.desc": "启用自动旋转时的旋转速度。范围：0.1–2.0。",
  "settings.renderQuality": "渲染质量",
  "settings.renderQuality.desc": "更高质量使用更多 GPU 资源。影响抗锯齿和分辨率。",
  "settings.renderScale": "渲染缩放",
  "settings.renderScale.desc": "渲染分辨率倍数。1.0 = 原始，0.5 = 一半，2.0 = 双倍（超采样）。范围：0.25–2.0。",
};
