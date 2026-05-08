# AI 3D 模型工作台

一个 Obsidian 插件，可在 Babylon.js 视口中渲染 3D 模型，并将其与知识笔记关联。开箱即支持 17 种格式，并可自动将 CAD 文件转换为网格模型。

<img width="2132" height="1502" alt="image" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />

[English](README.md)

## 功能特性

### 格式支持

**直接渲染**（无需外部工具）：

| 格式 | 说明 |
|------|------|
| GLB / GLTF | 行业标准 3D 格式，完整支持材质和动画 |
| STL | 二进制 STL，支持逐面颜色提取（VisCAM/SolidView） |
| OBJ | Wavefront OBJ，支持 MTL 材质和库内纹理路径解析 |
| PLY | Stanford PLY，支持顶点颜色、三角网格和点云 |
| SPLAT | 高斯溅射点云 |
| FBX | Autodesk FBX，通过内置加载器支持 |

**CAD 转换**（需要外部工具，可在设置中配置）：

| 格式 | 工具 | 说明 |
|------|------|------|
| STEP / STP | Python + CadQuery/OCCT | 通过 XDE 提取逐面颜色 |
| IGES / IGS | Python + CadQuery/OCCT | 仅几何体 |
| BREP | Python + CadQuery/OCCT | 原生 OpenCASCADE 格式 |
| SLDPRT | FreeCAD | SolidWorks 零件 |
| 3MF / DAE | Python + trimesh | 通过 Assimp 进行网格转换 |

### 渲染功能

- **Babylon.js 9.6** 引擎，支持 WebGL 2
- 点击高亮拾取，按材质克隆避免共享材质副作用
- 爆炸视图（世界空间位移）
- 方向指示器、包围盒叠加
- 可配置相机（透视/正交、FOV、命名预设）
- 可配置灯光（半球、点、聚光、方向）
- 分辨率缩放和质量预设（低/中/高）
- 移动端自适应硬件缩放

### 网格系统

使用 `3dgrid` 代码块在单个视口中渲染多个模型：

- **compare** — 并排 A/B 布局
- **showcase** — 单模型多角度展示
- **explode** — 环形排列
- **timeline** — 水平条带
- **gallery** — 所有模型在同一场景中，单相机
- **compose** — 组合多个预设创建自定义布局

一个引擎，一个 WebGL 上下文，与网格大小无关。每个单元格使用独立视口和 LayerMask 隔离。

### 嵌入方式

- **代码块**：` ```3d model.glb` 或 ` ```3dgrid ... ` 配合 JSON 配置
- **实时预览**：`![[model.glb]]` 在编辑器中内联渲染（支持尺寸语法 `![[model.glb|400x300]]`）
- **直接查看**：在文件资源管理器中点击 `.glb`、`.gltf`、`.stl` 文件直接在查看器标签页中打开

### 知识笔记

从已加载的模型生成结构化 Markdown 笔记：

- 包含格式、源路径、网格/三角形/材质数量的前置元数据
- 几何摘要表
- 可配置输出文件夹
- 通过库适配器进行重复检测

### 快照

- 复制快照到剪贴板
- 导出快照到库（可配置文件夹和命名）
- 下载快照为 PNG

## 安装

### 从 Obsidian 社区插件安装

尚未发布。请参阅下方手动安装。

### 手动安装

1. 从最新版本下载 `main.js`、`manifest.json` 和 `styles.css`
2. 在库的 `.obsidian/plugins/` 中创建文件夹 `ai-3d-model-workbench`
3. 将三个文件放入该文件夹
4. 在 Obsidian 设置 > 社区插件中启用插件

### 从源码构建

```bash
npm install
npm run build
```

输出 `main.js`（约 1.7 MB，Babylon.js 核心占 98%）放入 `.obsidian/plugins/ai-3d-model-workbench/`。

## 使用方法

### 快速开始

1. 将 `.glb`、`.stl` 或 `.obj` 文件放入库中
2. 在任意笔记中输入 `![[your-model.glb]]` — 模型将在实时预览中内联渲染
3. 使用工具栏按钮复制/下载快照，或生成知识笔记

### 嵌入方式

**1. 实时预览嵌入** — 最简单，适用于单个文件：

```markdown
![[model.glb]]
![[model.glb|400x300]]   ← 自定义尺寸
![[bunny.stl]]            ← STL 文件也可以
```

**2. 3d 代码块** — 用于自定义相机、灯光或场景配置：

````markdown
```3d model.glb
```
````

或使用完整配置：

````markdown
```3d
{
  "models": [{ "path": "model.glb" }],
  "camera": { "fov": 30 },
  "scene": { "autoRotate": true, "grid": true }
}
```
````

**3. 3dgrid 代码块** — 用于多模型对比：

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

**4. 直接文件查看** — 在文件资源管理器中点击任意 `.glb`/`.gltf`/`.stl` 文件，在完整查看器标签页中打开。

### 使用 CAD 文件

CAD 文件需要外部转换工具。配置完成后，使用方式与网格文件相同：

```markdown
![[engine_block.step]]
![[housing.iges]]
![[bracket.sldprt]]
```

插件会在首次加载时自动将文件转换为 GLB，缓存结果并渲染。后续加载使用缓存。

### 网格预设

| 预设 | 用途 | 示例 |
|------|------|------|
| `compare` | 并排 A/B 对比 | 设计前后对比 |
| `showcase` | 单模型多角度查看 | 产品展示 |
| `explode` | 环形排列 | 装配分解 |
| `timeline` | 水平条带 | 版本历史 |
| `gallery` | 所有模型，单相机 | 零件目录 |
| `compose` | 自定义多段布局 | 混合展示 |

### 知识笔记

点击工作台中的"生成笔记"按钮创建结构化 Markdown 笔记：

- 前置元数据：格式、源路径、文件大小、网格/三角形/材质数量
- 几何摘要表
- 可配置输出文件夹（默认 `Analysis/3D Reports`）
- 重复检测：不会覆盖现有笔记

### 快照

每个预览下方显示三个快照选项：

- **复制** — 复制 PNG 到剪贴板（可粘贴到任何应用）
- **保存** — 导出到库文件夹（默认 `Media/3D Previews`）
- **下载** — 下载为 PNG 文件

## 设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 画布高度 | 400 | 默认预览高度（像素） |
| 自动旋转 | 关 | 启动模型时启用旋转动画 |
| 自动旋转速度 | 0.5 | 旋转速度 |
| 渲染质量 | 高 | 分辨率质量预设 |
| 渲染缩放 | 1.0 | 分辨率倍数（0.25-2.0） |
| 快照文件夹 | Media/3D Previews | 导出快照的库文件夹 |
| 快照命名 | 模型名称 | 文件命名策略 |
| 报告文件夹 | Analysis/3D Reports | 知识笔记的库文件夹 |
| 启用的转换器 | freecad, sldprt | 激活哪些转换工具 |
| 转换器命令 | （自动发现） | 覆盖 Python/FreeCADCmd/obj2gltf/FBX2glTF 的路径 |

## 外部依赖

CAD 和网格转换需要外部工具。插件会自动发现 PATH 中的工具；如需覆盖，请在设置中配置。

| 转换器 | 需求 | 安装 |
|--------|------|------|
| freecad (STEP/IGES/BREP) | Python 3 + cadquery + trimesh | `pip install cadquery trimesh` |
| sldprt (SolidWorks) | FreeCAD 及 Python 绑定 | [freecad.org/downloads](https://www.freecad.org/downloads.php) |
| assimp (3MF/DAE) | Python 3 + trimesh | `pip install trimesh` |
| obj2gltf (OBJ) | Node.js + obj2gltf | `npm install -g obj2gltf` |
| fbx2gltf (FBX) | FBX2glTF 二进制文件 | [github.com/godotengine/FBX2glTF](https://github.com/godotengine/FBX2glTF) |

## 模型导入管线

### 概述

插件实现了多阶段管线，将 Obsidian 库中的 3D 模型加载到 Babylon.js 进行渲染。

```
┌─────────────────────────────────────────────────────────────────┐
│                     模型导入管线                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. 格式检测                                                    │
│     └─ normalizeModelExt() → getFormatCapability()              │
│                                                                 │
│  2. 路由决策                                                    │
│     ├─ 直接格式 → prepareDirectLoad()                           │
│     └─ 转换格式 → convertForPreview()                           │
│                                                                 │
│  3. 数据加载                                                    │
│     ├─ readBinaryPath() → ArrayBuffer                           │
│     └─ 转换：运行转换器 → 读取转换后的 GLB                      │
│                                                                 │
│  4. Babylon 渲染                                                │
│     ├─ GLB/GLTF/OBJ/SPLAT → SceneLoader.ImportMeshAsync()      │
│     ├─ STL → loadSTLBuffer()（直接解析）                        │
│     └─ PLY → loadPLYBuffer()（直接解析）                        │
└─────────────────────────────────────────────────────────────────┘
```

### 格式注册表

所有支持的格式都在中央注册表中注册，包含元数据：

```typescript
interface FormatCapability {
  ext: string;              // 文件扩展名（如 "stl"）
  family: "mesh" | "point-cloud" | "cad";  // 格式族
  strategy: "direct" | "convert";           // 加载策略
  directLoader?: string;    // Babylon 加载器标识符
  converterId?: string;     // 外部转换器标识符
  outputFormat?: string;    // 转换目标格式
  enabled: boolean;         // 运行时启用/禁用
}
```

### 加载策略

**直接格式**通过内置或自定义加载器直接加载到 Babylon.js。无需外部工具。

**转换格式**在渲染前通过外部工具转换为 GLB。需要 Python/CLI 工具。

### Data URL 与直接缓冲区

Babylon.js SceneLoader 接受 data URL 来加载模型。然而，自定义 SceneLoader 插件（STL、PLY）在 Babylon v9 中存在已知问题，data URL 在传递给插件前未正确转换为 ArrayBuffer。

**解决方案**：对于自定义加载器（STL、PLY），插件完全绕过 SceneLoader，直接使用原始 ArrayBuffer 调用解析器。

## 格式解析详情

### STL（立体光刻）

**二进制 STL 结构**：
```
偏移    大小    描述
0       80      头部（忽略）
80      4       三角形数量（uint32 小端序）
84      50*N    三角形记录：
                - 12 字节：法向量（3x float32）
                - 36 字节：3 个顶点（3x 3x float32）
                - 2 字节：属性字节数
```

**颜色编码**（VisCAM/SolidView）：
- 位 15：颜色标志（1 = 有颜色）
- 位 10-14：蓝色（5 位）
- 位 5-9：绿色（5 位）
- 位 0-4：红色（5 位）

### PLY（Stanford 三角格式）

**头部格式**：
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

**支持的属性类型**：uchar, char, ushort, short, uint, int, float, double

### OBJ（Wavefront OBJ）

**纹理解析优先级**：
1. MTL 中的完整相对路径
2. 同目录下的精确文件名
3. OBJ 基名 + 常见图片扩展名（jpg, png, bmp, tga, webp）
4. 纹理基名 + 替代扩展名

## 完整格式支持矩阵

| 格式 | 扩展名 | 族 | 策略 | 材质 | 颜色 | 动画 | 点云 |
|------|--------|-----|------|------|------|------|------|
| GLB | .glb | 网格 | 直接 | PBR | 顶点 | 是 | 否 |
| GLTF | .gltf | 网格 | 直接 | PBR | 顶点 | 是 | 否 |
| STL | .stl | 网格 | 直接 | 基础 | 逐面 | 否 | 否 |
| OBJ | .obj | 网格 | 直接 | MTL | 否 | 否 | 否 |
| PLY | .ply | 网格 | 直接 | 基础 | 顶点 | 否 | 是 |
| SPLAT | .splat | 点云 | 直接 | 否 | 逐点 | 否 | 是 |
| FBX | .fbx | 网格 | 直接 | 基础 | 否 | 是 | 否 |
| STEP | .step | CAD | 转换 | 否 | 逐面 | 否 | 否 |
| STP | .stp | CAD | 转换 | 否 | 逐面 | 否 | 否 |
| IGES | .iges | CAD | 转换 | 否 | 否 | 否 | 否 |
| IGS | .igs | CAD | 转换 | 否 | 否 | 否 | 否 |
| BREP | .brep | CAD | 转换 | 否 | 否 | 否 | 否 |
| SLDPRT | .sldprt | CAD | 转换 | 否 | 否 | 否 | 否 |
| 3MF | .3mf | 网格 | 转换 | 基础 | 否 | 否 | 否 |
| DAE | .dae | 网格 | 转换 | 基础 | 否 | 否 | 否 |

## 已知限制

### Babylon.js v9 SceneLoader Data URL 问题

自定义 Babylon.js SceneLoader 插件（STL、PLY）在通过 `SceneLoader.ImportMeshAsync` 使用 data URL 加载时，无法接收到原始 `ArrayBuffer` 数据。插件通过使用直接缓冲区解析来解决此问题。

| 格式 | 加载策略 | 状态 |
|------|---------|------|
| GLB / GLTF | Babylon 内置 SceneLoader | 正常工作 |
| STL | 直接 `ArrayBuffer` 解析 | 正常工作 |
| PLY | 直接 `ArrayBuffer` 解析 | 正常工作 |
| OBJ | Babylon 内置 SceneLoader + MTL 覆写 | 正常工作 |
| SPLAT | Babylon 内置 SceneLoader | 正常工作 |
| FBX | 社区 `babylonjs-fbx-loader` | 受 data URL 限制影响 |

**FBX 解决方法**：如果 FBX 文件无法渲染，请在设置中启用 FBX2glTF 转换器，将 FBX 转换为 GLB 后再渲染。

### 其他限制

- **STL**：仅支持二进制 STL。ASCII STL 文件会被检测并拒绝。
- **OBJ**：MTL 纹理路径相对于 OBJ 文件在库中的位置解析。
- **CAD**：STEP/IGES/BREP/SLDPRT 格式需要外部工具（Python + CadQuery 或 FreeCAD）。

## 架构

```
src/
  main.ts                          插件生命周期、命令、状态
  domain/models.ts                 共享接口
  domain/constants.ts              默认设置、支持的扩展名
  store/                           自定义 store + Obsidian saveData 桥接
  render/babylon/                  Babylon.js 场景、网格、预设、加载器
    loaders/                       自定义 STL、PLY 解析器 + Babylon SceneLoader 插件
    presets/                       compare、showcase、explode、timeline、gallery、compose
  io/formats/                      格式注册表、路由偏好
  io/conversion/                   转换管理器、适配器（Python/CLI 桥接）
    adapters/                      freecad、sldprt、assimp、obj2gltf、fbx2gltf
  view/workbench/                  双区域布局（稳定预览 + 可替换面板）
  view/inline/                     代码块、实时预览、辅助按钮
  view/direct-view.ts              直接文件打开（.glb/.gltf/.stl）
  settings.ts                      PluginSettingTab
  utils/                           路径解析、格式化、设备检测
```

## 部署

### 开发环境

**前置要求**：Node.js >= 18，npm >= 9

```bash
npm install           # 安装依赖
npm run dev           # 开发构建（监听模式）
npm run build         # 生产构建
npm run typecheck     # TypeScript 类型检查
```

### 构建输出

| 文件 | 大小 | 说明 |
|------|------|------|
| `main.js` | ~1.7 MB | 插件代码（Babylon.js 核心占 98%） |
| `manifest.json` | ~1 KB | Obsidian 插件清单 |
| `styles.css` | ~5 KB | 插件样式 |

### 在 Obsidian 中安装

**方法 1：符号链接（开发）**

```bash
# Windows（以管理员身份运行 PowerShell）
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\Documents\ObsidianVault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"

# macOS / Linux
ln -s /path/to/ai-3d-model-workbench \
  ~/Documents/ObsidianVault/.obsidian/plugins/ai-3d-model-workbench
```

**方法 2：复制（生产）**

```bash
# Windows
copy main.js manifest.json styles.css `
  "$env:USERPROFILE\Documents\ObsidianVault\.obsidian\plugins\ai-3d-model-workbench\"

# macOS / Linux
cp main.js manifest.json styles.css \
  ~/Documents/ObsidianVault/.obsidian/plugins/ai-3d-model-workbench/
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI3D_FREECAD_CMD` | CadQuery 的 Python 命令 | `py`（Windows）/ `python3`（Unix） |
| `AI3D_FREECMDCMD` | SLDPRT 的 FreeCADCmd 路径 | 自动发现 |
| `AI3D_ASSIMP_CMD` | trimesh 的 Python 命令 | `py`（Windows）/ `python3`（Unix） |
| `AI3D_OBJ2GLTF_CMD` | obj2gltf CLI 路径 | 自动发现 |
| `AI3D_FBX2GLTF_CMD` | FBX2glTF 二进制路径 | 自动发现 |

### 调试

1. 打开 Obsidian 设置 > AI 3D 模型工作台
2. 将"日志级别"设置为"调试"
3. 打开开发者控制台（Ctrl+Shift+I / Cmd+Option+I）
4. 按 `[AI3D]` 过滤查看插件日志

## 支持的平台

- **桌面端**：Windows、macOS、Linux
- **移动端**：Obsidian Mobile（通过硬件缩放降低分辨率）
- **最低 Obsidian 版本**：1.5.0

## 许可证

MIT
