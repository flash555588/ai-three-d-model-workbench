import type { PluginSettings } from "../../domain/models";

export function listPreferredConversionExts(
  settings: Pick<PluginSettings, "preferObj2gltfForObj" | "preferFbx2gltfForFbx">,
): string[] {
  const exts: string[] = [];

  if (settings.preferObj2gltfForObj) {
    exts.push("obj");
  }

  if (settings.preferFbx2gltfForFbx) {
    exts.push("fbx");
  }

  return exts;
}