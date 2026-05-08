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

function quotePyPath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
    execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      const stdoutText = (stdout ?? "").toString().trim();
      const stderrText = (stderr ?? "").toString().trim();
      const parts = [
        `FreeCAD command failed: ${error.message}`,
        stdoutText ? `stdout: ${stdoutText}` : "",
        stderrText ? `stderr: ${stderrText}` : "",
      ].filter(Boolean);

      reject(new Error(parts.join(" | ")));
    });
  });
}

function buildFreecadScript(sourcePath: string, outputPath: string): string {
  const src = quotePyPath(sourcePath);
  const out = quotePyPath(outputPath);

  return [
    "import FreeCAD",
    "import ImportGui",
    "",
    `src = r'${src}'`,
    `out = r'${out}'`,
    "doc = FreeCAD.newDocument('AI3D_Convert')",
    "ImportGui.insert(src, doc.Name)",
    "objs = [o for o in doc.Objects if hasattr(o, 'Shape') or hasattr(o, 'Mesh') ]",
    "if not objs:",
    "    raise RuntimeError('No exportable objects found after import.')",
    "ImportGui.export(objs, out)",
    "FreeCAD.closeDocument(doc.Name)",
  ].join("\n");
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return Uint8Array.from(buf).buffer;
}

export class FreecadConverter implements ModelConverter {
  readonly id = "freecad";
  readonly sourceExts = ["step", "stp", "iges", "igs", "brep", "x_t", "x_b", "catpart"] as const;
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
    await writeFile(scriptPath, buildFreecadScript(req.sourcePath, outputPath), "utf8");

    log.info("run FreeCAD conversion", {
      sourcePath: req.sourcePath,
      outputPath,
      command,
    });

    try {
      await execFileAsync(command, ["-c", scriptPath], DEFAULT_TIMEOUT_MS);
    } catch (error) {
      throw new Error(
        `FreeCAD conversion failed for '${req.sourcePath}'. ` +
        `Set FreeCAD command path in plugin settings or AI3D_FREECAD_CMD if FreeCADCmd is not discoverable. ` +
        `${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      void rm(scriptPath, { force: true });
    }

    if (!(await fileExists(outputPath))) {
      throw new Error(
        `FreeCAD conversion finished but output was not found: '${outputPath}'. ` +
        "Check FreeCAD import/export support for this CAD format.",
      );
    }

    const outputBuffer = await readFile(outputPath);
    if (toArrayBuffer(outputBuffer).byteLength === 0) {
      throw new Error(`FreeCAD output file is empty: '${outputPath}'.`);
    }

    return {
      outputPath,
      outputExt: "glb",
      fromCache: false,
      warnings: ["Converted by local FreeCAD CLI bridge."],
    };
  }
}
