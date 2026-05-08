import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, extname, isAbsolute, join } from "node:path";
import type { PluginSettings } from "../../domain/models";

export type ConverterCommandId = "freecad" | "obj2gltf" | "fbx2gltf";
export type ConverterCommandSettingKey = "freecadCommand" | "obj2gltfCommand" | "fbx2gltfCommand";
export type ConverterCommandSource = "settings" | "env" | "candidate" | "path";

type ConverterCommandSettings = Pick<PluginSettings, ConverterCommandSettingKey>;

export interface ConverterCommandSpec {
  id: ConverterCommandId;
  label: string;
  settingsKey: ConverterCommandSettingKey;
  envVar: string;
  fallbackCommand: string;
  knownCandidates: readonly string[];
}

export interface ConverterCommandStatus {
  id: ConverterCommandId;
  label: string;
  envVar: string;
  settingsKey: ConverterCommandSettingKey;
  configuredCommand?: string;
  command: string;
  resolvedPath?: string;
  available: boolean;
  source: ConverterCommandSource;
  detail: string;
  checkedCandidates: readonly string[];
}

const WINDOWS_PATHEXT_FALLBACK = [".exe", ".cmd", ".bat", ".com"];

const CONVERTER_COMMAND_SPECS: readonly ConverterCommandSpec[] = [
  {
    id: "freecad",
    label: "FreeCADCmd",
    settingsKey: "freecadCommand",
    envVar: "AI3D_FREECAD_CMD",
    fallbackCommand: process.platform === "win32" ? "FreeCADCmd.exe" : "freecadcmd",
    knownCandidates: process.platform === "win32"
      ? [
        "C:/Program Files/FreeCAD 0.22/bin/FreeCADCmd.exe",
        "C:/Program Files/FreeCAD 0.21/bin/FreeCADCmd.exe",
        "C:/Program Files/FreeCAD/bin/FreeCADCmd.exe",
      ]
      : [
        "/usr/bin/freecadcmd",
        "/usr/local/bin/freecadcmd",
        "/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd",
      ],
  },
  {
    id: "obj2gltf",
    label: "obj2gltf",
    settingsKey: "obj2gltfCommand",
    envVar: "AI3D_OBJ2GLTF_CMD",
    fallbackCommand: process.platform === "win32" ? "obj2gltf.cmd" : "obj2gltf",
    knownCandidates: process.platform === "win32"
      ? ["C:/Users/Public/AppData/Roaming/npm/obj2gltf.cmd"]
      : [],
  },
  {
    id: "fbx2gltf",
    label: "FBX2glTF",
    settingsKey: "fbx2gltfCommand",
    envVar: "AI3D_FBX2GLTF_CMD",
    fallbackCommand: process.platform === "win32" ? "FBX2glTF.exe" : "FBX2glTF",
    knownCandidates: process.platform === "win32"
      ? [
        "C:/Program Files/FBX2glTF/FBX2glTF-windows-x64.exe",
        "C:/Program Files/FBX2glTF/FBX2glTF.exe",
      ]
      : [],
  },
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeCommandValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasPathHint(command: string): boolean {
  return isAbsolute(command) || /[\\/]/.test(command) || command.startsWith(".");
}

function getWindowsPathExtensions(command: string): string[] {
  if (extname(command)) {
    return [""];
  }

  const fromEnv = process.env.PATHEXT
    ?.split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return fromEnv?.length ? fromEnv : WINDOWS_PATHEXT_FALLBACK;
}

async function resolveCommandOnPath(command: string): Promise<string | undefined> {
  const pathValue = process.env.PATH;
  if (!pathValue) {
    return undefined;
  }

  const pathEntries = pathValue.split(delimiter).map((entry) => entry.trim()).filter(Boolean);
  const suffixes = process.platform === "win32" ? getWindowsPathExtensions(command) : [""];

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
  if (hasPathHint(command)) {
    const available = await fileExists(command);
    return {
      id: spec.id,
      label: spec.label,
      envVar: spec.envVar,
      settingsKey: spec.settingsKey,
      configuredCommand,
      command,
      resolvedPath: available ? command : undefined,
      available,
      source,
      detail: available
        ? `Using ${describeConverterCommandSource(source)} path.`
        : `Configured path was not found on disk.`,
      checkedCandidates: [command],
    };
  }

  const resolvedPath = await resolveCommandOnPath(command);
  return {
    id: spec.id,
    label: spec.label,
    envVar: spec.envVar,
    settingsKey: spec.settingsKey,
    configuredCommand,
    command,
    resolvedPath,
    available: !!resolvedPath,
    source,
    detail: resolvedPath
      ? `Resolved from ${describeConverterCommandSource(source)} via PATH lookup.`
      : `Command name was not found on PATH.`,
    checkedCandidates: [command],
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

  const envCommand = normalizeCommandValue(process.env[spec.envVar]);
  if (envCommand) {
    return inspectCommandReference(spec, envCommand, "env");
  }

  for (const candidate of spec.knownCandidates) {
    if (await fileExists(candidate)) {
      return {
        id: spec.id,
        label: spec.label,
        envVar: spec.envVar,
        settingsKey: spec.settingsKey,
        command: candidate,
        resolvedPath: candidate,
        available: true,
        source: "candidate",
        detail: "Detected at a known install location.",
        checkedCandidates: [candidate],
      };
    }
  }

  const fallbackStatus = await inspectCommandReference(spec, spec.fallbackCommand, "path");
  if (fallbackStatus.available) {
    return fallbackStatus;
  }

  return {
    ...fallbackStatus,
    detail: spec.knownCandidates.length
      ? `Not found on PATH. Checked known locations: ${spec.knownCandidates.join("; ")}`
      : fallbackStatus.detail,
    checkedCandidates: [...spec.knownCandidates, ...fallbackStatus.checkedCandidates],
  };
}

export async function inspectAllConverterCommands(settings: ConverterCommandSettings): Promise<ConverterCommandStatus[]> {
  return Promise.all(
    CONVERTER_COMMAND_SPECS.map((spec) => inspectConverterCommand(spec.id, settings[spec.settingsKey])),
  );
}

export async function resolveConverterCommand(id: ConverterCommandId, configuredCommand?: string): Promise<string> {
  const status = await inspectConverterCommand(id, configuredCommand);
  return status.resolvedPath ?? status.command;
}