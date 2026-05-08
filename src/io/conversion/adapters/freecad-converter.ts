import type { ConversionRequest, ConversionResult, ModelConverter } from "../types";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, dirname, basename, extname, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { createLogger } from "../../../utils/log";
import { resolveConverterCommand } from "../command-discovery";

const log = createLogger("freecad-converter");

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Normalize a path for embedding in a Python raw string (r"...").
 *  Python handles forward slashes on all platforms, so we only convert
 *  backslashes to forward slashes. No double-escaping is needed because
 *  the result is wrapped in a raw string literal. */
function pyPath(s: string): string {
  if (s.includes('"')) {
    throw new Error(`File path contains double-quote character, not supported for Python conversion: ${s}`);
  }
  return s.replace(/\\/g, "/");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function execFileAsync(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      const stdoutText = (stdout ?? "").toString().trim();
      const stderrText = (stderr ?? "").toString().trim();
      const parts = [
        `CAD conversion failed: ${error.message}`,
        stdoutText ? `stdout: ${stdoutText}` : "",
        stderrText ? `stderr: ${stderrText}` : "",
      ].filter(Boolean);

      reject(new Error(parts.join(" | ")));
    });
  });
}

function buildCadScript(sourcePath: string, outputPath: string, sourceExt: string): string {
  const src = pyPath(sourcePath);
  const out = pyPath(outputPath);
  const ext = sourceExt.toLowerCase().replace(/^\./, "");
  const isStep = ext === "step" || ext === "stp";
  const isIges = ext === "iges" || ext === "igs";
  // brep is handled separately

  // Common imports
  const lines: string[] = [
    "import cadquery as cq",
    "import trimesh",
    "import trimesh.visual",
    "import numpy as np",
    "import sys",
    "import os",
    "",
    `src = r"${src}"`,
    `out = r"${out}"`,
    "",
  ];

  // Format-specific imports
  if (isStep) {
    lines.push(
      "from OCP.STEPCAFControl import STEPCAFControl_Reader",
      "from OCP.STEPControl import STEPControl_Reader",
      "from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorType, XCAFDoc_ShapeTool",
      "from OCP.TDocStd import TDocStd_Document",
      "from OCP.TCollection import TCollection_ExtendedString",
      "from OCP.Quantity import Quantity_Color",
      "from OCP.TDF import TDF_ChildIterator",
    );
  } else if (isIges) {
    lines.push(
      "from OCP.IGESControl import IGESControl_Reader",
    );
  }
  // brep: no special reader import needed (uses BRepTools from OCP.TopoDS/BRep)

  lines.push(
    "from OCP.TopoDS import TopoDS",
    "from OCP.TopAbs import TopAbs_FACE",
    "from OCP.TopExp import TopExp_Explorer",
    "from OCP.BRep import BRep_Tool",
    "from OCP.BRepMesh import BRepMesh_IncrementalMesh",
    "from OCP.TopLoc import TopLoc_Location",
    "from OCP.IFSelect import IFSelect_RetDone",
  );

  if (!isStep) {
    // BREP and IGES don't use XDE for colors
    lines.push("from OCP.BRepTools import BRepTools");
  }

  lines.push(
    "",
    "DEFAULT_COLOR = [180, 180, 180, 255]",
    "",
    "def triangulate_face(face, linear=0.1, angular=0.5):",
    "    BRepMesh_IncrementalMesh(face, linear, False, angular, True)",
    "    loc = TopLoc_Location()",
    "    tri = BRep_Tool.Triangulation_s(face, loc)",
    "    if tri is None:",
    "        return None, None",
    "    n = tri.NbNodes()",
    "    verts = []",
    "    for i in range(1, n + 1):",
    "        p = tri.Node(i)",
    "        if not loc.IsIdentity():",
    "            p = p.Transformed(loc.Transformation())",
    "        verts.append([p.X(), p.Y(), p.Z()])",
    "    ntri = tri.NbTriangles()",
    "    faces = []",
    "    for i in range(1, ntri + 1):",
    "        t = tri.Triangle(i)",
    "        n1, n2, n3 = t.Get()",
    "        faces.append([n1 - 1, n2 - 1, n3 - 1])",
    "    return verts, faces",
  );

  // XDE color extraction only for STEP
  if (isStep) {
    lines.push(
      "",
      "def build_xde_color_lookup(step_path):",
      '    """Load XDE with STEPCAFControl, extract per-face colors via surface signature."""',
      "    lookup = {}",
      "    try:",
      "        reader = STEPCAFControl_Reader()",
      "        reader.SetColorMode(True)",
      "        reader.SetNameMode(True)",
      "        status = reader.ReadFile(step_path)",
      "        if status != IFSelect_RetDone:",
      "            return lookup",
      "        doc = TDocStd_Document(TCollection_ExtendedString('XmlOcaf'))",
      "        reader.Transfer(doc)",
      "        shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())",
      "        color_tool = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())",
      "",
      "        def walk(label):",
      "            if XCAFDoc_ShapeTool.IsShape_s(label):",
      "                s = XCAFDoc_ShapeTool.GetShape_s(label)",
      "                if s is not None and s.ShapeType() == TopAbs_FACE:",
      "                    c = Quantity_Color()",
      "                    if color_tool.GetColor(s, XCAFDoc_ColorType.XCAFDoc_ColorSurf, c):",
      "                        face = TopoDS.Face_s(s)",
      "                        try:",
      "                            adaptor = BRepAdaptor_Surface(face)",
      "                            u_r = (adaptor.FirstUParameter(), adaptor.LastUParameter())",
      "                            v_r = (adaptor.FirstVParameter(), adaptor.LastVParameter())",
      "                            key = (adaptor.GetType(), tuple(round(x, 4) for x in u_r), tuple(round(x, 4) for x in v_r))",
      "                            color = (c.Red(), c.Green(), c.Blue())",
      "                            if key not in lookup:",
      "                                lookup[key] = color",
      "                        except Exception:",
      "                            pass",
      "            children = TDF_ChildIterator(label)",
      "            while children.More():",
      "                walk(children.Value())",
      "                children.Next()",
      "",
      "        walk(doc.Main())",
      "    except Exception as e:",
      '        print(f"XDE color extraction failed: {e}", file=sys.stderr)',
      "    return lookup",
      "",
      "def get_face_color(face, color_lookup):",
      '    """Match a geometry face to an XDE face via surface signature, return color."""',
      "    from OCP.BRepAdaptor import BRepAdaptor_Surface",
      "    try:",
      "        adaptor = BRepAdaptor_Surface(face)",
      "        u_r = (adaptor.FirstUParameter(), adaptor.LastUParameter())",
      "        v_r = (adaptor.FirstVParameter(), adaptor.LastVParameter())",
      "        key = (adaptor.GetType(), tuple(round(x, 4) for x in u_r), tuple(round(x, 4) for x in v_r))",
      "        return color_lookup.get(key)",
      "    except Exception:",
      "        return None",
    );
  }

  // Load geometry — format-specific
  lines.push("");

  if (isStep) {
    lines.push(
      "# STEP: build XDE color lookup + load geometry",
      "color_lookup = build_xde_color_lookup(src)",
      'print(f"XDE color lookup: {len(color_lookup)} surface signatures")',
      "",
      "sr = STEPControl_Reader()",
      "status = sr.ReadFile(src)",
      "if status != IFSelect_RetDone:",
      '    print(f"Failed to read STEP file: {src}", file=sys.stderr)',
      "    sys.exit(1)",
      "sr.TransferRoots()",
      "shape = sr.OneShape()",
    );
  } else if (isIges) {
    lines.push(
      "# IGES: load geometry (no XDE color support for IGES)",
      "ir = IGESControl_Reader()",
      "status = ir.ReadFile(src)",
      "if status != IFSelect_RetDone:",
      '    print(f"Failed to read IGES file: {src}", file=sys.stderr)',
      "    sys.exit(1)",
      "ir.TransferRoots()",
      "shape = ir.OneShape()",
    );
  } else {
    // brep
    lines.push(
      "# BREP: load geometry from native OpenCascade format",
      "from OCP.TopoDS import TopoDS_Shape",
      "from OCP.BRep import BRep_Builder",
      "shape = TopoDS_Shape()",
      "builder = BRep_Builder()",
      "success = BRepTools.Read_s(shape, src, builder)",
      "if not success:",
      '    print(f"Failed to read BREP file: {src}", file=sys.stderr)',
      "    sys.exit(1)",
    );
  }

  // Triangulate + color (same for all formats)
  lines.push(
    "",
    "all_verts = []",
    "all_faces = []",
    "all_colors = []",
    "matched_count = 0",
    "total_faces = 0",
    "",
    "exp = TopExp_Explorer(shape, TopAbs_FACE)",
    "while exp.More():",
    "    face = TopoDS.Face_s(exp.Current())",
    "    total_faces += 1",
    "    verts, faces = triangulate_face(face)",
    "    if verts and faces:",
    "        offset = len(all_verts)",
    "        all_verts.extend(verts)",
    "        for tri in faces:",
    "            all_faces.append([tri[0] + offset, tri[1] + offset, tri[2] + offset])",
  );

  if (isStep) {
    lines.push(
      "        color = get_face_color(face, color_lookup)",
      "        if color:",
      "            matched_count += 1",
      "            r, g, b = color",
      "            rgba = [int(r * 255), int(g * 255), int(b * 255), 255]",
      "        else:",
      "            rgba = DEFAULT_COLOR",
    );
  } else {
    lines.push(
      "        rgba = DEFAULT_COLOR",
    );
  }

  lines.push(
    "        n = len(verts)",
    "        all_colors.extend([rgba] * n)",
    "    exp.Next()",
    "",
    'print(f"Triangulated: {total_faces} faces, {len(all_verts)} verts, {matched_count} colored ({matched_count*100//max(total_faces,1)}%)")',
    "",
    "if not all_verts or not all_faces:",
    "    # Fallback: use CadQuery import (works for STEP/IGES, not BREP)",
  );

  if (isStep) {
    lines.push("    cq_shape = cq.importers.importStep(src)");
  } else if (isIges) {
    lines.push("    cq_shape = cq.importers.importStep(src)  # CadQuery reads IGES via importStep");
  } else {
    lines.push("    cq_shape = cq.importers.importStep(src)  # CadQuery BREP import");
  }

  lines.push(
    "    cq.exporters.export(cq_shape, out, exportType='STL')",
    "    mesh = trimesh.load(out)",
    "    data = mesh.export(file_type='glb')",
    "    if isinstance(data, str):",
    "        with open(data, 'rb') as f:",
    "            data = f.read()",
    "    with open(out, 'wb') as f:",
    "        f.write(data)",
    '    print(f"Fallback CadQuery STL->GLB: {out} ({len(data)} bytes)")',
    "    sys.exit(0)",
    "",
    "verts_arr = np.array(all_verts, dtype=float)",
    "faces_arr = np.array(all_faces, dtype=int)",
    "colors_arr = np.array(all_colors, dtype=np.uint8)",
    "",
    "mesh = trimesh.Trimesh(",
    "    vertices=verts_arr,",
    "    faces=faces_arr,",
    "    visual=trimesh.visual.ColorVisuals(vertex_colors=colors_arr),",
    "    process=True,",
    ")",
    "mesh.fix_normals()",
    "scene = trimesh.Scene([mesh])",
    "",
    "result = scene.export(file_type='glb')",
    "if isinstance(result, bytes):",
    "    data = result",
    "elif isinstance(result, str):",
    "    with open(result, 'rb') as f:",
    "        data = f.read()",
    "else:",
    "    data = bytes(result)",
    "",
    "with open(out, 'wb') as f:",
    "    f.write(data)",
    "",
    "print(f'Converted {src} -> {out} ({len(data)} bytes, {matched_count}/{total_faces} colored faces)')",
  );

  return lines.join("\n");
}

export class FreecadConverter implements ModelConverter {
  readonly id = "freecad";
  readonly sourceExts = ["step", "stp", "iges", "igs", "brep"] as const;
  readonly targetExt = "glb" as const;

  constructor(private configuredCommand?: string) {}

  async getCacheKey(): Promise<string> {
    return `${this.id}:${await resolveConverterCommand(this.id, this.configuredCommand)}`;
  }

  async convert(req: ConversionRequest): Promise<ConversionResult> {
    if (!isAbsolute(req.sourcePath)) {
      throw new Error(
        `Converter '${this.id}' requires an absolute source path, got '${req.sourcePath}'. ` +
        "Pass a file-system path to the conversion pipeline when invoking CAD conversion.",
      );
    }

    const command = await resolveConverterCommand(this.id, this.configuredCommand);
    const sourceDir = dirname(req.sourcePath);
    const name = basename(req.sourcePath, extname(req.sourcePath));
    const outputPath = join(sourceDir, `${name}.ai3d-converted.glb`);
    const scriptDir = join(tmpdir(), "ai3d-freecad");
    const scriptPath = join(scriptDir, `${name}-${Date.now()}.py`);

    await mkdir(scriptDir, { recursive: true });
    await writeFile(scriptPath, buildCadScript(req.sourcePath, outputPath, req.sourceExt), "utf8");

    log.info("run CAD conversion (CadQuery/OCCT)", {
      sourcePath: req.sourcePath,
      outputPath,
      command,
    });

    try {
      await execFileAsync(command, [scriptPath], DEFAULT_TIMEOUT_MS);
    } catch (error) {
      throw new Error(
        `CAD conversion failed for '${req.sourcePath}'. ` +
        `Ensure Python with cadquery is installed: pip install cadquery trimesh. ` +
        `Set Python command path in plugin settings or AI3D_FREECAD_CMD if Python is not discoverable. ` +
        `${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      void rm(scriptPath, { force: true });
    }

    if (!(await fileExists(outputPath))) {
      throw new Error(
        `CAD conversion finished but output was not found: '${outputPath}'. ` +
        "Check that CadQuery supports this CAD format.",
      );
    }

    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.byteLength === 0) {
      throw new Error(`CAD conversion output is empty: '${outputPath}'.`);
    }

    return {
      outputPath,
      outputExt: "glb",
      fromCache: false,
      warnings: ["Converted by local Python/CadQuery(OCCT) bridge."],
    };
  }
}
