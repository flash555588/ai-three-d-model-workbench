# AI 3D 模型工作台

> 一个 Obsidian 插件，可在 Babylon.js 视口中渲染 3D 模型，并将其与知识笔记关联。

[English](README.md) | **简体中文**

<img width="2132" height="1502" alt="preview" src="https://github.com/user-attachments/assets/05c1bcaf-bef5-4e45-aeff-eb0076df3c67" />

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [安装方法](#安装方法)
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

- **17 种格式**开箱即用（6 种直接渲染 + 11 种通过转换）
- **Babylon.js 9.6** 引擎，WebGL 2 渲染
- **三种嵌入方式**：实时预览、代码块、直接文件查看
- **网格系统**：在单个视口中渲染多个模型，支持预设布局
- **3D 标注**：点击模型表面添加带标签和颜色的书签，支持深度遮挡
- **知识笔记**：从已加载的模型生成结构化 Markdown
- **快照功能**：复制、保存或下载渲染预览为 PNG
- **国际化**：英文和简体中文，自动检测系统语言
- **移动端支持**：Obsidian Mobile 自适应硬件缩放

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 构建插件
npm run build

# 3. 复制到 Obsidian 库
cp main.js manifest.json styles.css \
  /path/to/vault/.obsidian/plugins/ai-3d-model-workbench/

# 4. 在 Obsidian 设置 > 社区插件中启用
```

然后在任意笔记中：

```markdown
![[model.glb]]           # 在实时预览中内联渲染
![[model.glb|400x300]]   # 自定义尺寸
```

---

## 安装方法

### 方式 A：从源码构建（推荐）

```bash
git clone https://github.com/flash555588/ai-3d-model-workbench.git
cd ai-3d-model-workbench
npm install
npm run build
```

将三个输出文件复制到你的库：

| 文件 | 大小 | 说明 |
|------|------|------|
| `main.js` | ~1.7 MB | 插件运行时（Babylon.js 核心） |
| `manifest.json` | ~1 KB | Obsidian 插件清单 |
| `styles.css` | ~5 KB | 插件样式 |

**目标目录**：`<vault>/.obsidian/plugins/ai-3d-model-workbench/`

### 方式 B：符号链接（开发用）

```bash
# Windows (PowerShell)
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\Documents\MyVault\.obsidian\plugins\ai-3d-model-workbench" `
  -Target "C:\path\to\ai-3d-model-workbench"

# macOS / Linux
ln -s /path/to/ai-3d-model-workbench \
  ~/Documents/MyVault/.obsidian/plugins/ai-3d-model-workbench
```

然后运行 `npm run dev` 进入监听模式进行开发。

### 方式 C：手动下载

1. 从 [Releases](https://github.com/flash555588/ai-3d-model-workbench/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 创建文件夹 `<vault>/.obsidian/plugins/ai-3d-model-workbench/`
3. 将文件放入该文件夹
4. 在 Obsidian 设置 > 社区插件中启用

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
| FBX | `.fbx` | Autodesk FBX，通过社区加载器 |

### CAD 转换（需要外部工具）

| 格式 | 扩展名 | 转换器 | 输出 |
|------|--------|--------|------|
| STEP | `.step` `.stp` | Python + CadQuery/OCCT | GLB |
| IGES | `.iges` `.igs` | Python + CadQuery/OCCT | GLB |
| BREP | `.brep` | Python + CadQuery/OCCT | GLB |
| SLDPRT | `.sldprt` | FreeCAD | GLB |
| 3MF | `.3mf` | Python + trimesh | GLB |
| DAE | `.dae` | Python + trimesh | GLB |

### 格式特性矩阵

| 特性 | GLB/GLTF | STL | OBJ | PLY | SPLAT | FBX | CAD |
|------|----------|-----|-----|-----|-------|-----|-----|
| 网格 | 是 | 是 | 是 | 是 | 否 | 是 | 是 |
| 点云 | 否 | 否 | 否 | 是 | 是 | 否 | 否 |
| 材质 | PBR | 基础 | MTL | 基础 | 否 | 基础 | 否 |
| 纹理 | 嵌入式 | 否 | 外部 | 否 | 否 | 否 | 否 |
| 颜色 | 顶点 | 面 | 否 | 顶点 | 点 | 否 | 面(STEP) |
| 动画 | 是 | 否 | 否 | 否 | 否 | 是 | 否 |

---

## 使用方法

### 嵌入方式

**1. 实时预览**（最简单）：

```markdown
![[model.glb]]
![[model.glb|400x300]]
![[bunny.stl]]
```

**2. 代码块**（自定义配置）：

````markdown
```3d model.glb
```
````

````markdown
```3d
{
  "models": [{ "path": "model.glb" }],
  "camera": { "fov": 30 },
  "scene": { "autoRotate": true }
}
```
````

**3. 网格块**（多模型）：

````markdown
```3dgrid
{
  "models": [
    { "path": "v1.step" },
    { "path": "v2.step" }
  ],
  "preset": "compare"
}
```
````

**4. 直接查看**：在文件资源管理器中点击任意 `.glb`/`.gltf`/`.stl` 文件。

### 网格预设

| 预设 | 说明 |
|------|------|
| `compare` | 并排 A/B 对比 |
| `showcase` | 单模型多角度查看 |
| `explode` | 环形排列，用于装配分解 |
| `timeline` | 水平条带，用于版本历史 |
| `gallery` | 所有模型在同一场景 |
| `compose` | 自定义多段布局 |

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
| 报告文件夹 | Analysis/3D Reports | 知识笔记文件夹 |
| 日志级别 | info | 控制台日志详细程度 |

### 转换器设置

| 设置项 | 说明 |
|--------|------|
| 启用 CAD 转换器 | 通过 CadQuery 启用 STEP/IGES/BREP |
| 启用 SLDPRT 转换器 | 通过 FreeCAD 启用 SolidWorks |
| 启用网格转换器 | 通过 trimesh 启用 3MF/DAE |
| Python 命令 | 覆盖 Python 路径 |
| FreeCADCmd 路径 | 覆盖 FreeCADCmd 路径 |

---

## 外部依赖

仅 CAD 和网格转换需要外部工具。直接格式无需任何外部工具。

### Python + CadQuery（STEP、IGES、BREP）

```bash
# 安装
pip install cadquery trimesh

# 验证
python -c "import cadquery; print('OK')"
```

### FreeCAD（SLDPRT）

从 [freecad.org/downloads](https://www.freecad.org/downloads.php) 下载。

自动发现路径：
- Windows：`%LOCALAPPDATA%\Programs\FreeCAD*\bin\FreeCADCmd.exe`
- macOS：`/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd`
- Linux：`/usr/bin/freecadcmd`

### Python + trimesh（3MF、DAE）

```bash
pip install trimesh
```

### 环境变量

| 变量 | 用途 |
|------|------|
| `AI3D_FREECAD_CMD` | CadQuery 的 Python 命令 |
| `AI3D_FREECMDCMD` | FreeCADCmd 路径 |
| `AI3D_ASSIMP_CMD` | trimesh 的 Python 命令 |

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
| Babylon v9 data-URL bug | FBX（社区加载器） | 启用 FBX2glTF 转换器 |
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
