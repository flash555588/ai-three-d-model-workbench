import { F_OK, X_OK, access, execFile } from "../../utils/node-shim";
import { getRuntimeProcess } from "../../utils/node-shim";
import { pathDelimiter as delimiter, pathExtname as extname, pathIsAbsolute as isAbsolute, pathJoin as join } from "../../utils/node-shim";
import type { PluginSettings } from "../../domain/models";

const proc = getRuntimeProcess();

export type ConverterCommandId = "freecad" | "obj2gltf" | "fbx2gltf" | "assimp" | "freecadcmd";
export type ConverterCommandSettingKey = "freecadCommand" | "obj2gltfCommand" | "fbx2gltfCommand" | "assimpCommand" | "freecadcmdCommand";
export type ConverterCommandSource = "settings" | "env" | "candidate" | "path";

type ConverterCommandSettings = Pick<PluginSettings, ConverterCommandSettingKey>;

export interface ConverterCommandSpec {
  id: ConverterCommandId;
  label: string;
  settingsKey: ConverterCommandSettingKey;
  envVar: string;
  fallbackCommands: readonly string[];
  knownCandidates: readonly string[];
}

export interface ConverterCommandStatus {
  id: ConverterCommandId;
  label: string;
  envVar: string;
  settingsKey: ConverterCommandSettingKey;
  configuredCommand?: string;
  command: string;
  executable: string;
  args: readonly string[];
  resolvedPath?: string;
  available: boolean;
  source: ConverterCommandSource;
  detail: string;
  checkedCandidates: readonly string[];
  dependencyChecks?: readonly ConverterDependencyCheck[];
}

export interface ConverterDependencyCheck {
  kind: "cad-python" | "mesh-python";
  ok: boolean;
  detail: string;
}

const WINDOWS_PATHEXT_FALLBACK = [".exe", ".cmd", ".bat", ".com"];

/**
 * Resolve FreeCAD command candidates dynamically using environment variables.
 * Skips user-specific hardcoded paths — only uses platform-standard locations.
 */
function resolvePosixCommandCandidates(...commands: string[]): readonly string[] {
  const baseDirs = proc?.platform === "darwin"
    ? ["/opt/homebrew/bin", "/usr/local/bin", "/opt/local/bin", "/usr/bin"]
    : ["/usr/bin", "/usr/local/bin", "/opt/homebrew/bin", "/opt/local/bin"];

  return Array.from(new Set(baseDirs.flatMap((dir) => commands.map((command) => `${dir}/${command}`))));
}

function resolveFreeCadCandidates(): readonly string[] {
  if (proc?.platform === "darwin") {
    return [
      "/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd",
      "/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd",
      "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd",
      ...resolvePosixCommandCandidates("FreeCADCmd", "freecadcmd"),
    ];
  }

  if (proc?.platform !== "win32") {
    return [
      "/usr/bin/freecadcmd",
      "/usr/local/bin/freecadcmd",
      "/opt/homebrew/bin/freecadcmd",
      "/snap/freecad/current/usr/bin/freecadcmd",
    ];
  }

  const candidates: string[] = [];
  const localAppData = proc?.env?.LOCALAPPDATA;
  const programFiles = proc?.env?.ProgramFiles;
  const programFilesX86 = proc?.env?.["ProgramFiles(x86)"];

  // User-level install: %LOCALAPPDATA%\Programs\FreeCAD*\bin\FreeCADCmd.exe
  if (localAppData) {
    for (const ver of ["1.1", "1.0", "0.21", "0.20"]) {
      candidates.push(`${localAppData}/Programs/FreeCAD ${ver}/bin/FreeCADCmd.exe`);
    }
  }
  // System-level install: %ProgramFiles%\FreeCAD*\bin\FreeCADCmd.exe
  if (programFiles) {
    for (const ver of ["1.1", "1.0", "0.21", "0.20"]) {
      candidates.push(`${programFiles}/FreeCAD ${ver}/bin/FreeCADCmd.exe`);
    }
  }
  if (programFilesX86) {
    candidates.push(`${programFilesX86}/FreeCAD/bin/FreeCADCmd.exe`);
  }
  return candidates;
}

const CONVERTER_COMMAND_SPECS: readonly ConverterCommandSpec[] = [
  {
    id: "freecad",
    label: "Python (CadQuery/OCCT)",
    settingsKey: "freecadCommand",
    envVar: "AI3D_FREECAD_CMD",
    fallbackCommands: proc?.platform === "win32" ? ["py"] : ["python3", "python"],
    // Python is discoverable via `py` launcher (Windows) or `python3` (Linux/macOS).
    // No user-specific paths — use settings/env if Python is not on PATH.
    knownCandidates: proc?.platform === "win32"
      ? ["py"]
      : ["/usr/bin/python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3", "/opt/local/bin/python3"],
  },
  {
    id: "obj2gltf",
    label: "obj2gltf",
    settingsKey: "obj2gltfCommand",
    envVar: "AI3D_OBJ2GLTF_CMD",
    fallbackCommands: proc?.platform === "win32" ? ["obj2gltf.cmd"] : ["obj2gltf"],
    knownCandidates: proc?.platform === "win32"
      ? ["C:/Users/Public/AppData/Roaming/npm/obj2gltf.cmd"]
      : resolvePosixCommandCandidates("obj2gltf"),
  },
  {
    id: "fbx2gltf",
    label: "FBX2glTF",
    settingsKey: "fbx2gltfCommand",
    envVar: "AI3D_FBX2GLTF_CMD",
    fallbackCommands: proc?.platform === "win32" ? ["FBX2glTF.exe"] : ["FBX2glTF", "fbx2gltf"],
    knownCandidates: proc?.platform === "win32"
      ? [
        "C:/Program Files/FBX2glTF/FBX2glTF-windows-x64.exe",
        "C:/Program Files/FBX2glTF/FBX2glTF.exe",
      ]
      : resolvePosixCommandCandidates("FBX2glTF", "fbx2gltf"),
  },
  {
    id: "assimp",
    label: "Python (trimesh)",
    settingsKey: "assimpCommand",
    envVar: "AI3D_ASSIMP_CMD",
    fallbackCommands: proc?.platform === "win32" ? ["py"] : ["python3", "python"],
    knownCandidates: proc?.platform === "win32"
      ? ["py"]
      : ["/usr/bin/python3", "/usr/local/bin/python3", "/opt/homebrew/bin/python3", "/opt/local/bin/python3"],
  },
  {
    id: "freecadcmd",
    label: "FreeCAD (SLDPRT)",
    settingsKey: "freecadcmdCommand",
    envVar: "AI3D_FREECMDCMD",
    fallbackCommands: proc?.platform === "win32" ? ["FreeCADCmd.exe"] : ["freecadcmd", "FreeCADCmd"],
    knownCandidates: resolveFreeCadCandidates(),
  },
];

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, proc?.platform === "win32" ? F_OK : X_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeCommandValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function splitCommandLine(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaping = false;

  for (const ch of command) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "\\") {
      escaping = true;
      continue;
    }

    if (quote === "\"") {
      if (ch === "\"") {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (escaping) {
    current += "\\";
  }

  if (quote) {
    return [command];
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function parseCommandValue(command: string): { executable: string; args: string[] } {
  const parts = splitCommandLine(command).filter(Boolean);
  if (parts.length === 0) {
    return { executable: command, args: [] };
  }

  return {
    executable: parts[0],
    args: parts.slice(1),
  };
}

function hasPathHint(command: string): boolean {
  return isAbsolute(command) || /[\\/]/.test(command) || command.startsWith(".");
}

function getWindowsPathExtensions(command: string): string[] {
  if (extname(command)) {
    return [""];
  }

  const fromEnv = proc?.env?.PATHEXT
    ?.split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return fromEnv?.length ? fromEnv : WINDOWS_PATHEXT_FALLBACK;
}

async function resolveCommandOnPath(command: string): Promise<string | undefined> {
  const pathValue = proc?.env?.PATH;
  if (!pathValue) {
    return undefined;
  }

  const pathEntries = pathValue.split(delimiter).map((entry) => entry.trim()).filter(Boolean);
  const suffixes = proc?.platform === "win32" ? getWindowsPathExtensions(command) : [""];

  for (const entry of pathEntries) {
    for (const suffix of suffixes) {
      const candidate = join(entry, suffix ? `${command}${suffix}` : command);
      if (await isExecutable(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function execFileAsync(command: string, args: string[], timeoutMs = 15_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message).toString().trim() || error.message));
          return;
        }

        resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
      },
    );
  });
}

function compactProcessError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine.length > 180 ? `${oneLine.slice(0, 177)}...` : oneLine;
}

async function inspectDependencyChecks(status: ConverterCommandStatus): Promise<readonly ConverterDependencyCheck[]> {
  if (!status.available) {
    return [];
  }

  const command = status.resolvedPath ?? status.executable;
  const args = [...status.args];

  if (status.id === "freecad") {
    try {
      await execFileAsync(command, [...args, "-c", "import cadquery, trimesh; print('ok')"]);
      return [{ kind: "cad-python", ok: true, detail: "" }];
    } catch (err) {
      return [{ kind: "cad-python", ok: false, detail: compactProcessError(err) }];
    }
  }

  if (status.id === "assimp") {
    try {
      await execFileAsync(command, [...args, "-c", "import trimesh, numpy, networkx, collada; print('ok')"]);
      return [{ kind: "mesh-python", ok: true, detail: "" }];
    } catch (err) {
      return [{ kind: "mesh-python", ok: false, detail: compactProcessError(err) }];
    }
  }

  return [];
}

function getSpec(id: ConverterCommandId): ConverterCommandSpec {
  const spec = CONVERTER_COMMAND_SPECS.find((entry) => entry.id === id);
  if (!spec) {
    throw new Error(`Unknown converter command id: ${id}`);
  }
  return spec;
}

async function inspectCommandReference(
  spec: ConverterCommandSpec,
  command: string,
  source: ConverterCommandSource,
  configuredCommand?: string,
): Promise<ConverterCommandStatus> {
  const parsed = parseCommandValue(command);

  if (hasPathHint(parsed.executable)) {
    const available = await isExecutable(parsed.executable);
    return {
      id: spec.id,
      label: spec.label,
      envVar: spec.envVar,
      settingsKey: spec.settingsKey,
      configuredCommand,
      command,
      executable: parsed.executable,
      args: parsed.args,
      resolvedPath: available ? parsed.executable : undefined,
      available,
      source,
      detail: available
        ? `Using ${describeConverterCommandSource(source)} path.`
        : `Configured path was not found or is not executable.`,
      checkedCandidates: [parsed.executable],
    };
  }

  const resolvedPath = await resolveCommandOnPath(parsed.executable);
  return {
    id: spec.id,
    label: spec.label,
    envVar: spec.envVar,
    settingsKey: spec.settingsKey,
    configuredCommand,
    command,
    executable: parsed.executable,
    args: parsed.args,
    resolvedPath,
    available: !!resolvedPath,
    source,
    detail: resolvedPath
      ? `Resolved from ${describeConverterCommandSource(source)} via PATH lookup.`
      : `Command name was not found on PATH.`,
    checkedCandidates: [parsed.executable],
  };
}

export function listConverterCommandSpecs(): readonly ConverterCommandSpec[] {
  return CONVERTER_COMMAND_SPECS;
}

export function describeConverterCommandSource(source: ConverterCommandSource): string {
  switch (source) {
    case "settings":
      return "plugin settings";
    case "env":
      return "environment variable";
    case "candidate":
      return "known install location";
    case "path":
      return "PATH fallback";
  }
}

export async function inspectConverterCommand(
  id: ConverterCommandId,
  configuredCommand?: string,
): Promise<ConverterCommandStatus> {
  const spec = getSpec(id);
  const configured = normalizeCommandValue(configuredCommand);
  if (configured) {
    return inspectCommandReference(spec, configured, "settings", configured);
  }

  const envCommand = normalizeCommandValue(proc?.env?.[spec.envVar]);
  if (envCommand) {
    return inspectCommandReference(spec, envCommand, "env");
  }

  for (const candidate of spec.knownCandidates) {
    if (await isExecutable(candidate)) {
      return {
        id: spec.id,
        label: spec.label,
        envVar: spec.envVar,
        settingsKey: spec.settingsKey,
        command: candidate,
        executable: candidate,
        args: [],
        resolvedPath: candidate,
        available: true,
        source: "candidate",
        detail: "Detected at a known install location.",
        checkedCandidates: [candidate],
      };
    }
  }

  const fallbackStatuses: ConverterCommandStatus[] = [];
  for (const fallbackCommand of spec.fallbackCommands) {
    const fallbackStatus = await inspectCommandReference(spec, fallbackCommand, "path");
    fallbackStatuses.push(fallbackStatus);
    if (fallbackStatus.available) {
      return fallbackStatus;
    }
  }

  const checkedFallbackCandidates = fallbackStatuses.flatMap((status) => status.checkedCandidates);
  return {
    ...fallbackStatuses[0],
    detail: spec.knownCandidates.length
      ? `Not found on PATH. Checked known locations: ${spec.knownCandidates.join("; ")}`
      : "Command name was not found on PATH.",
    checkedCandidates: [...spec.knownCandidates, ...checkedFallbackCandidates],
  };
}

export async function inspectAllConverterCommands(settings: ConverterCommandSettings): Promise<ConverterCommandStatus[]> {
  const statuses = await Promise.all(
    CONVERTER_COMMAND_SPECS.map((spec) => inspectConverterCommand(spec.id, settings[spec.settingsKey])),
  );

  return Promise.all(
    statuses.map(async (status) => ({
      ...status,
      dependencyChecks: await inspectDependencyChecks(status),
    })),
  );
}

export async function resolveConverterCommand(id: ConverterCommandId, configuredCommand?: string): Promise<string> {
  const invocation = await resolveConverterInvocation(id, configuredCommand);
  return invocation.command;
}

export interface ResolvedConverterInvocation {
  command: string;
  args: readonly string[];
}

export async function resolveConverterInvocation(
  id: ConverterCommandId,
  configuredCommand?: string,
): Promise<ResolvedConverterInvocation> {
  const status = await inspectConverterCommand(id, configuredCommand);
  return {
    command: status.resolvedPath ?? status.executable,
    args: [...status.args],
  };
}
