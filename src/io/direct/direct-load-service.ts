import { normalizeModelExt } from "../formats/registry";
import { createLogger } from "../../utils/log";

const log = createLogger("direct-load-service");

export interface DirectLoadInput {
  path: string;
  sourceExt: string;
}

export interface DirectLoadResult {
  effectivePath: string;
  effectiveExt: string;
  warnings: string[];
}

export function prepareDirectLoad(input: DirectLoadInput): DirectLoadResult {
  const normalizedExt = normalizeModelExt(input.sourceExt);
  const warnings: string[] = [];

  if (normalizedExt !== input.sourceExt) {
    warnings.push(`Normalized extension '${input.sourceExt}' -> '${normalizedExt}'.`);
  }

  log.debug("prepare direct load", {
    path: input.path,
    sourceExt: input.sourceExt,
    normalizedExt,
    warningCount: warnings.length,
  });

  return {
    effectivePath: input.path,
    effectiveExt: normalizedExt,
    warnings,
  };
}
