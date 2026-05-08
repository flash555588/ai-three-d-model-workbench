import type { LoadStrategy } from "../formats/types";
import type { PreparedModel } from "../model-pipeline";

export interface PreviewSource {
  path: string;
  ext: string;
  strategy: LoadStrategy;
  sourcePath: string;
  sourceExt: string;
  warnings: string[];
}

export function toPreviewSource(model: PreparedModel): PreviewSource {
  return {
    path: model.effectivePath,
    ext: model.effectiveExt,
    strategy: model.strategy,
    sourcePath: model.sourcePath,
    sourceExt: model.sourceExt,
    warnings: model.warnings,
  };
}
