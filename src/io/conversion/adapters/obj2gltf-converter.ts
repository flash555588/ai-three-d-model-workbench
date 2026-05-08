import type { ConversionRequest, ConversionResult, ModelConverter } from "../types";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, basename, extname, join, isAbsolute } from "node:path";
import { execFile } from "node:child_process";
import { createLogger } from "../../../utils/log";
import { resolveConverterCommand } from "../command-discovery";

const log = createLogger("obj2gltf-converter");
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

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
        `obj2gltf command failed: ${error.message}`,
        stdoutText ? `stdout: ${stdoutText}` : "",
        stderrText ? `stderr: ${stderrText}` : "",
      ].filter(Boolean);
      reject(new Error(parts.join(" | ")));
    });
  });
}

export class Obj2GltfConverter implements ModelConverter {
  readonly id = "obj2gltf";
  readonly sourceExts = ["obj"] as const;
  readonly targetExt = "glb" as const;

  constructor(private configuredCommand?: string) {}

  async getCacheKey(): Promise<string> {
    return `${this.id}:${await resolveConverterCommand(this.id, this.configuredCommand)}`;
  }

  async convert(req: ConversionRequest): Promise<ConversionResult> {
    if (!isAbsolute(req.sourcePath)) {
      throw new Error(
        `Converter '${this.id}' requires an absolute source path, got '${req.sourcePath}'. ` +
        "Pass a file-system path to the conversion pipeline when invoking obj2gltf.",
      );
    }

    const command = await resolveConverterCommand(this.id, this.configuredCommand);
    const sourceDir = dirname(req.sourcePath);
    const name = basename(req.sourcePath, extname(req.sourcePath));
    const outputPath = join(sourceDir, `${name}.ai3d-converted.glb`);

    log.info("run obj2gltf conversion", {
      sourcePath: req.sourcePath,
      outputPath,
      command,
    });

    try {
      await execFileAsync(command, ["-i", req.sourcePath, "-o", outputPath, "-b"], DEFAULT_TIMEOUT_MS);
    } catch (error) {
      throw new Error(
        `obj2gltf conversion failed for '${req.sourcePath}'. ` +
        `Set obj2gltf command path in plugin settings or AI3D_OBJ2GLTF_CMD if obj2gltf is not discoverable. ` +
        `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!(await fileExists(outputPath))) {
      throw new Error(`obj2gltf conversion finished but output was not found: '${outputPath}'.`);
    }

    const outputBuffer = await readFile(outputPath);
    if (outputBuffer.byteLength === 0) {
      throw new Error(`obj2gltf output file is empty: '${outputPath}'.`);
    }

    return {
      outputPath,
      outputExt: "glb",
      fromCache: false,
      warnings: ["Converted by local obj2gltf CLI bridge."],
    };
  }
}
