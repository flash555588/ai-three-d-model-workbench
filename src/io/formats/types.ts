export type ModelFamily = "mesh" | "cad" | "point-cloud";

export type LoadStrategy = "direct" | "convert";

export type DirectLoaderKind = "babylon" | "custom-stl" | "custom-ply";

export interface FormatCapability {
  ext: string;
  family: ModelFamily;
  strategy: LoadStrategy;
  directLoader?: DirectLoaderKind;
  converterId?: string;
  outputFormat?: "glb";
  enabled: boolean;
}
