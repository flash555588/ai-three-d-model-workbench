# AI 3D 模型工作台

> 一个 Obsidian 插件，可在 Babylon.js 视口中查看 3D 资产、标注关键部位，并将模型整理为可链接的知识笔记。

[English](README.md) | **简体中文**

<img width="2132" height="1502" alt="preview" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />

---

## 目录

- [功能特性](#功能特性)
- [快速入门](#快速入门)
- [安装](#安装)
- [格式支持](#格式支持)
- [使用方法](#使用方法)
- [设置选项](#设置选项)
- [外部依赖](#外部依赖)
- [技术细节](#技术细节)
- [已知限制](#已知限制)
- [部署指南](#部署指南)
- [许可证](#许可证)

---

## 功能特性

- **直接预览** GLB/GLTF、STL、OBJ、PLY、SPLAT
- **可选转换** CAD、FBX、3MF、DAE 等资产到 GLB
- **Babylon.js 9.6** 引擎，WebGL 2 渲染
- **三种嵌入方式**：实时预览、代码块、直接文件查看
- **网格系统**：在单个视口中渲染多个模型，支持预设布局
- **3D 标注**：点击模型表面添加带标签和颜色的书签，支持深度遮挡
- **知识笔记**：从已加载的模型生成结构化 Markdown
- **快照功能**：复制、保存或下载渲染预览为 PNG
- **国际化**：英文和简体中文，自动检测系统语言
- **桌面端支持**：Windows、macOS、Linux 上的 Obsidian Desktop
- **移动端支持**：Obsidian Mobile 直接预览，自适应硬件缩放

---

## 快速入门

1. 构建插件：

```bash
npm install
npm run build
```

2. 打开你电脑上的本地 Obsidian vault 文件夹。

3. 在该 vault 里创建这个文件夹：

```text
<your-vault>/.obsidian/plugins/ai-3d-model-workbench/
```

4. 把 `main.js`、`manifest.json`、`styles.css` 复制到这个文件夹里。

5. 在 Obsidian 中打开“设置 > 社区插件”，启用 `AI 3D Model Workbench`。

6. 把一个受支持的模型文件放进同一个 vault，例如 `model.glb`。

7. 在该 vault 的任意笔记中这样嵌入：

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

---

## 安装

如果你只想最快跑起来，直接看上面的 [快速入门](#快速入门)。

### 前提

- Obsidian 1.5.0 或更高版本
- 需要 Windows、macOS 或 Linux 上的 Obsidian Desktop 才能使用本地转换工具
- 你电脑上的本地 Obsidian vault 文件夹
- vault 里的插件目录：

```text
<vault>/.obsidian/plugins/ai-3d-model-workbench/
```

无论用哪种方式安装，最终都要把下面这三个文件放进这个目录：

| 文件 | 大小 | 说明 |
|------|------|------|
| `main.js` | ~1.7 MB | 插件运行时（Babylon.js 核心） |
| `manifest.json` | ~1 KB | Obsidian 插件清单 |
| `styles.css` | ~5 KB | 插件样式 |

直接渲染在桌面端和移动端都可用。CAD、FBX、3MF、DAE 的本地转换工具只适用于桌面系统。

### 方式 A：从源码构建

1. 克隆仓库并构建插件：

```bash
git clone https://github.com/flash555588/ai-3d-model-workbench.git
cd ai-3d-model-workbench
npm install
npm run build
```

2. 如果 `<vault>/.obsidian/plugins/ai-3d-model-workbench/` 还不存在，先创建它。
3. 把 `main.js`、`manifest.json`、`styles.css` 复制到这个文件夹里。
4. 在 Obsidian 的“设置 > 社区插件”中启用 `AI 3D Model Workbench`。

### 方式 B：下载发布版

1. 从 [Releases](https://github.com/flash555588/ai-3d-model-workbench/releases) 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 如果 `<vault>/.obsidian/plugins/ai-3d-model-workbench/` 还不存在，先创建它。
3. 把这三个文件放进这个文件夹里。
4. 在 Obsidian 的“设置 > 社区插件”中启用 `AI 3D Model Workbench`。

### 方式 C：开发用符号链接

1. 先确认 `<vault>/.obsidian/plugins/` 已经存在。
2. 创建一个名为 `ai-3d-model-workbench` 的符号链接，指向当前仓库。

Windows（PowerShell）：

```powershell
New-Item -ItemType SymbolicLink `
  -Path "C:\path\to\your-vault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"
```

macOS / Linux：

```bash
ln -s /path/to/ai-3d-model-workbench \
  /path/to/your-vault/.obsidian/plugins/ai-3d-model-workbench
```

3. 如果还没装依赖，先在当前仓库运行一次 `npm install`。
4. 开发时运行 `npm run dev`。
5. 在 Obsidian 的“设置 > 社区插件”中启用 `AI 3D Model Workbench`。

### 安装后

1. 先把一个受支持的模型文件放进同一个 vault，例如 `model.glb`。
2. 然后在该 vault 的任意笔记中这样嵌入：

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

---

## 格式支持

### 直接渲染（无需外部工具）

| 格式 | 扩展名 | 特性 |
|------|--------|------|
| GLB / GLTF | `.glb` `.gltf` | PBR 材质、动画、纹理、场景层级 |
| STL | `.stl` | 二进制格式、逐面颜色（VisCAM/SolidView） |
| OBJ | `.obj` | MTL 材质、库内相对路径纹理解析 |
| PLY | `.ply` | ASCII/二进制、顶点颜色、点云支持 |
| SPLAT | `.splat` | 高斯溅射点云 |

### 转换（需要外部工具）

| 格式 | 扩展名 | 转换器 | 输出 |
|------|--------|--------|------|
| STEP | `.step` `.stp` | Python + CadQuery/OCCT | GLB |
| IGES | `.iges` `.igs` | Python + CadQuery/OCCT | GLB |
| BREP | `.brep` | Python + CadQuery/OCCT | GLB |
| SLDPRT | `.sldprt` | FreeCAD | GLB |
| 3MF | `.3mf` | Python + trimesh | GLB |
| DAE | `.dae` | Python + trimesh | GLB |
| FBX | `.fbx` | FBX2glTF | GLB |

### 格式特性矩阵

| 特性 | GLB/GLTF | STL | OBJ | PLY | SPLAT | FBX（转换后） | CAD |
|------|----------|-----|-----|-----|-------|-----|-----|
| 网格 | 是 | 是 | 是 | 是 | 否 | 是 | 是 |
| 点云 | 否 | 否 | 否 | 是 | 是 | 否 | 否 |
| 材质 | PBR | 基础 | MTL | 基础 | 否 | 基础 | 否 |
| 纹理 | 嵌入式 | 否 | 外部 | 否 | 否 | 否 | 否 |
| 颜色 | 顶点 | 面 | 否 | 顶点 | 点 | 否 | 面(STEP) |
| 动画 | 是 | 否 | 否 | 否 | 否 | 是 | 否 |

---

## 使用方法

### 语法指南

#### 1. 内联嵌入

在笔记中写 Wikilink 即可。阅读模式和实时预览均支持。

```markdown
![[model.glb]]
![[model.glb|400x300]]
```

#### 2. `3d` 代码块

**简单写法** — 只写文件路径：

````markdown
```3d model.glb
```
````

**完整配置** — 相机、灯光、场景、多模型：

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

| 配置项 | 常用字段 |
|--------|----------|
| `models[]` | `path`（必填）、`color`、`wireframe` |
| `camera` | `fov`、`position`、`lookAt`、`mode`（`"perspective"` / `"orthographic"`） |
| `lights[]` | `type`（`"hemisphere"` `"directional"` `"point"` `"spot"` `"ambient"` `"attachToCam"`）、`color`、`intensity`、`position` |
| `scene` | `background`、`autoRotate`、`autoRotateSpeed`、`grid`、`axis`、`groundShadow`、`transparent` |
| `stl` | `color`、`wireframe`（STL 文件默认值） |
| 顶层 | `width`、`height` |

#### 3. `3dgrid` 代码块

在一个视口中用预设布局渲染多个模型。

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

| 预设 | 布局 |
|------|------|
| `compare` | 并排 A/B 对比 |
| `showcase` | 单模型多角度 |
| `explode` | 环形排列 |
| `timeline` | 水平条带 |
| `gallery` | 全部同场景（默认） |
| `compose` | 自定义分区 |

`3dgrid` 支持与 `3d` 相同的 `camera`、`lights`、`scene`，另有：`preset`、`params`、`columns`、`rowHeight`、`gapX`、`gapY`、`sections`、`direction`。

#### 4. 直接打开

在文件资源管理器中点击 `.glb`/`.gltf`/`.stl`/`.obj`/`.ply`/`.splat` 文件即可。

#### 支持的格式

| 类型 | 格式 |
|------|------|
| 直接渲染 | `.glb` `.gltf` `.stl` `.obj` `.ply` `.splat` |
| 需转换 | `.step` `.stp` `.iges` `.igs` `.brep` `.sldprt` `.3mf` `.dae` `.fbx` |

### 键盘快捷键（预览中）

| 按键 | 功能 |
|------|------|
| `R` | 重置视图 |
| `W` | 切换线框模式 |
| `G` | 切换方向指示器 |
| `B` | 切换包围盒 |
| `空格` | 播放/暂停动画 |
| `Esc` | 退出标注模式 |

### 3D 标注

在模型表面添加带标签的书签。标注按模型文件持久化保存。

**直接查看 & 工作台**（编辑模式）：

1. 点击工具栏的 **标签图标**（或工作台面板中的"标注"按钮）
2. 蓝色半透明遮罩表示标注模式已激活
3. 点击模型表面放置标注点
4. 在弹出编辑器中输入标签并选择颜色
5. 点击已有标注可编辑标签/颜色或删除
6. 点击工作台面板中的标签文字，相机自动平滑旋转到该位置
7. 按 `Esc` 退出标注模式

**深度遮挡**：被模型遮挡的标注显示为半透明模糊状态。相机静止约 250ms 后，完全被遮挡的标注自动隐藏，仅保留可见书签。

**代码块 & 实时预览**：已保存的标注以只读方式显示，具有相同的遮挡效果。

---

## 设置选项

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 语言 | 自动 | 界面语言（英文 / 简体中文 / 自动检测） |
| 画布高度 | 400 | 预览高度（像素） |
| 自动旋转 | 关 | 启动时启用旋转动画 |
| 自动旋转速度 | 0.5 | 旋转速度（0.1-2.0） |
| 渲染质量 | 高 | 质量预设（低/中/高） |
| 渲染缩放 | 1.0 | 分辨率倍数（0.25-2.0） |
| 快照文件夹 | Media/3D Previews | 导出文件夹 |
| 快照命名 | model-name | 导出 PNG 快照时的文件命名方式 |
| 报告文件夹 | Analysis/3D Reports | 知识笔记文件夹 |
| 日志级别 | warn | 控制台日志详细程度 |

### 转换器设置

| 设置项 | 说明 |
|--------|------|
| 启用 CAD 转换器 | 通过 CadQuery 启用 STEP/IGES/BREP |
| 启用 SLDPRT 转换器 | 通过 FreeCAD 启用 SolidWorks |
| 启用网格转换器 | 通过 trimesh 启用 3MF/DAE |
| 启用 OBJ2GLTF 转换器 | 可选，通过 obj2gltf 标准化 OBJ |
| 启用 FBX2glTF 转换器 | 通过 FBX2glTF 启用 FBX 转换 |
| Python 命令路径（CAD 用） | 覆盖 STEP/IGES/BREP 转换使用的 Python 可执行文件 |
| FreeCADCmd 路径（SLDPRT 用） | 覆盖 `.sldprt` 转换使用的 FreeCAD 可执行文件 |
| obj2gltf 命令路径 | 覆盖 obj2gltf CLI 路径 |
| FBX2glTF 命令路径 | 覆盖 FBX2glTF CLI 路径 |
| Python 命令路径（3MF/DAE 用） | 覆盖 3MF/DAE 转换使用的 Python 可执行文件 |
| 转换器命令诊断 | 显示插件当前实际会使用的可执行文件路径，并运行轻量依赖自检 |

### 可移植性与诊断

渲染层本身具备较好的跨平台可移植性：GLB、OBJ、STL、PLY、SPLAT 以及已经生成好的 `.ai3d-converted.glb`，只要 Obsidian Desktop 能提供 WebGL 就可以显示。

转换层的可移植性较弱，因为它依赖每台机器本地安装的工具和 Python 环境。当 CAD 或网格格式加载失败时，优先看插件设置里的转换器诊断面板。它会同时检查插件最终解析到的可执行文件路径，以及当前 Python 环境能否导入所需依赖。

尤其在 macOS 上，系统自带的 `/usr/bin/python3` 往往存在，但并不包含 CAD 依赖。如果诊断面板显示使用的是这个路径且自检失败，应安装一个独立的 Python 环境，并在插件设置里显式填入那个解释器路径。

---

## 外部依赖

仅 CAD、FBX 和网格转换需要外部工具。直接格式无需任何外部工具。

### Python + CadQuery（STEP、IGES、BREP）

```bash
# 安装
pip install cadquery trimesh
```

按你的系统使用对应的 Python 命令验证：

- Windows：`py -c "import cadquery; print('OK')"`
- macOS / Linux：`python3 -c "import cadquery; print('OK')"`

如果诊断面板在 macOS 上解析到 `/usr/bin/python3` 且导入检查失败，请安装独立 Python（例如 Homebrew Python），在那个环境里安装 `cadquery` 和 `trimesh`，然后把该解释器路径填入插件设置。

### FreeCAD（SLDPRT）

按平台安装 FreeCAD：

- Windows：从 [freecad.org/downloads](https://www.freecad.org/downloads.php) 安装
- macOS：安装官方 app，或使用 `brew install --cask freecad`
- Linux：安装发行版提供的 FreeCAD 包，并确保 `freecadcmd` 可用

自动发现路径：
- Windows：`%LOCALAPPDATA%\Programs\FreeCAD*\bin\FreeCADCmd.exe`
- macOS：`/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd`、`/usr/local/bin/FreeCADCmd`、`/opt/homebrew/bin/FreeCADCmd`
- Linux：`/usr/bin/freecadcmd`

### Python + trimesh（3MF、DAE）

```bash
pip install trimesh numpy networkx pycollada
```

**自动发现**：使用与 CadQuery 相同的 Python 发现逻辑。

**覆盖方式**：环境变量 `AI3D_ASSIMP_CMD`。

### obj2gltf（OBJ，可选）

插件已经内置 OBJ 加载器。obj2gltf 是可选替代方案，可用于生成更标准的 GLB 输出。

**安装**：

```bash
npm install -g obj2gltf
```

**自动发现**：Windows 下查找 `obj2gltf.cmd`，macOS 和 Linux 下查找标准位置中的 `obj2gltf`，例如 `/usr/local/bin/obj2gltf`、`/opt/homebrew/bin/obj2gltf`。

**启用**：设置 > 启用 OBJ2GLTF 转换器，或设置 obj2gltf 命令路径。

### FBX2glTF（FBX）

FBX 文件通过本地 FBX2glTF 二进制转换为 GLB。旧的社区 FBX 加载器没有打包进插件，因为它当前版本面向 Babylon.js 8，而本插件使用 Babylon.js 9。

**安装**：

下载或自行构建适用于你平台的 [FBX2glTF](https://github.com/godotengine/FBX2glTF)，并将二进制文件放到可发现的位置。

**自动发现路径**：

```text
C:\Program Files\FBX2glTF\FBX2glTF-windows-x64.exe
C:\Program Files\FBX2glTF\FBX2glTF.exe
/usr/local/bin/FBX2glTF
/opt/homebrew/bin/FBX2glTF
/usr/local/bin/fbx2gltf
```

**启用**：设置 > 启用 FBX2glTF 转换器，或设置 FBX2glTF 命令路径。

### 环境变量

| 变量 | 用途 |
|------|------|
| `AI3D_FREECAD_CMD` | CadQuery 的 Python 命令 |
| `AI3D_FREECMDCMD` | FreeCADCmd 路径 |
| `AI3D_ASSIMP_CMD` | trimesh 的 Python 命令 |
| `AI3D_OBJ2GLTF_CMD` | obj2gltf 命令路径 |
| `AI3D_FBX2GLTF_CMD` | FBX2glTF 命令路径 |

---

## 技术细节

### 架构

```
src/
├── main.ts                    # 插件生命周期、命令
├── domain/
│   ├── models.ts              # 共享接口
│   └── constants.ts           # 默认设置、扩展名
├── store/
│   ├── create-store.ts        # 自定义 store 原语
│   └── plugin-store.ts        # Obsidian saveData 桥接
├── render/babylon/
│   ├── scene.ts               # BabylonModelPreview 类
│   ├── grid.ts                # GridRenderer 类
│   ├── loaders/
│   │   ├── stl-loader.ts      # 自定义二进制 STL 解析器
│   │   ├── ply-loader.ts      # 自定义 ASCII/二进制 PLY 解析器
│   │   └── register.ts        # Babylon SceneLoader 插件
│   └── presets/               # 网格布局预设
├── io/
│   ├── formats/
│   │   └── registry.ts        # 格式能力注册表
│   ├── conversion/
│   │   ├── manager.ts         # 转换编排
│   │   └── adapters/          # 转换器实现
│   └── model-pipeline.ts      # 格式路由逻辑
└── view/
    ├── workbench/             # 主工作台 UI
    ├── inline/                # 代码块、实时预览
    └── direct-view.ts         # 直接文件打开
```

### 模型导入管线

```
┌─────────────────────────────────────────────────────────────┐
│  1. 格式检测                                                │
│     └─ getFormatCapability(ext) → { family, strategy }      │
│                                                             │
│  2. 路由决策                                                │
│     ├─ strategy: "direct" → prepareDirectLoad()             │
│     └─ strategy: "convert" → convertForPreview()            │
│                                                             │
│  3. 数据加载                                                │
│     ├─ readBinaryPath() → ArrayBuffer                       │
│     └─ [如已转换] → 读取转换后的 .glb                       │
│                                                             │
│  4. Babylon 渲染                                            │
│     ├─ GLB/GLTF/OBJ/SPLAT → SceneLoader.ImportMeshAsync()  │
│     ├─ STL → loadSTLBuffer()（直接解析）                    │
│     └─ PLY → loadPLYBuffer()（直接解析）                    │
└─────────────────────────────────────────────────────────────┘
```

### 为什么 STL/PLY 使用直接缓冲区加载

Babylon.js v9 的 SceneLoader 存在一个 bug：自定义插件在通过 `SceneLoader.ImportMeshAsync()` 加载时，接收到的是 data URL 字符串而非 ArrayBuffer。内置加载器（GLTF、OBJ、SPLAT）不受影响。

**解决方案**：STL 和 PLY 解析器直接使用原始 ArrayBuffer 调用，完全绕过 SceneLoader。

### 转换缓存

- **位置**：与源文件相同目录
- **格式**：`{filename}.ai3d-converted.glb`
- **验证**：检查转换器身份、缓存键、文件存在性
- **失效**：转换器设置更改时自动失效
- **手动清除**：命令面板 > "Clear Conversion Cache"

---

## 已知限制

| 问题 | 受影响格式 | 解决方法 |
|------|-----------|---------|
| 需要外部转换器 | FBX | 安装并启用 FBX2glTF |
| 仅支持二进制 STL | STL | 将 ASCII STL 转换为二进制 |
| 需要外部工具 | STEP/IGES/BREP/SLDPRT | 安装 Python + CadQuery 或 FreeCAD |
| 纹理路径解析 | OBJ | 将纹理放在 OBJ 同一目录 |
| 转换超时 | SLDPRT | 复杂装配体有 10 分钟超时 |

---

## 部署指南

### 前置要求

- Node.js >= 18
- npm >= 9
- Obsidian >= 1.5.0

### 构建命令

```bash
npm install           # 安装依赖
npm run dev           # 开发构建（监听模式）
npm run build         # 生产构建
npm run typecheck     # TypeScript 类型检查
```

### 构建输出

```
ai-3d-model-workbench/
├── main.js           # 1.7 MB（压缩后，Babylon.js 核心）
├── manifest.json     # 插件清单
├── styles.css        # 插件样式
└── src/              # 源代码
```

### 平台支持

| 平台 | 状态 |
|------|------|
| Windows | 完全支持 |
| macOS | 完全支持 |
| Linux | 完全支持 |
| Obsidian Mobile | 支持（降低分辨率） |

### 包体积优化

Babylon.js 核心占包体积的 ~98%。项目使用：

- 子路径导入（`@babylonjs/core/Engines/engine.js`）而非桶导入
- Tree-shaking 移除未使用的功能
- esbuild 进行快速、优化的打包

如果不使用子路径导入，包体积将从 1.7 MB 膨胀到 ~7 MB。

---

## 许可证

MIT
