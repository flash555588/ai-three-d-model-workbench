import type { FormatCapability } from "../formats/types";
import type { ConversionManager } from "./manager";
import { CONVERTED_ASSET_CACHE_VERSION, type ConvertedAssetCache } from "../cache/converted-asset-cache";
import { createLogger } from "../../utils/log";
import { F_OK, access } from "../../utils/node-shim";
import { pathIsAbsolute as isAbsolute } from "../../utils/node-shim";

const log = createLogger("conversion-service");

export interface ConversionRouteInput {
  sourcePath: string;
  sourceExt: string;
  capability: FormatCapability;
  conversionManager: ConversionManager;
  convertedAssetCache?: ConvertedAssetCache;
}

export interface ConversionRouteResult {
  effectivePath: string;
  effectiveExt: "glb";
  warnings: string[];
}

function isCachedRecordCompatible(
  cached: { converterId: string; converterCacheKey: string },
  expectedConverterId: string,
  currentIdentity?: { converterId: string; cacheKey: string },
): boolean {
  if (cached.converterId !== expectedConverterId) {
    return false;
  }

  if (!currentIdentity) {
    return true;
  }

  return (
    cached.converterId === currentIdentity.converterId &&
    cached.converterCacheKey === currentIdentity.cacheKey
  );
}

async function isCachedOutputAvailable(outputPath: string): Promise<boolean> {
  if (!outputPath) return false;
  try {
    await access(outputPath, F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function convertForPreview(input: ConversionRouteInput): Promise<ConversionRouteResult> {
  if (input.capability.strategy !== "convert") {
    throw new Error(`Expected convert strategy, got '${input.capability.strategy}'.`);
  }

  const converterId = input.capability.converterId;
  const targetExt = input.capability.outputFormat ?? "glb";

  if (!converterId) {
    throw new Error(`Format .${input.sourceExt} does not define a converter id.`);
  }

  log.info("prepare conversion route", {
    sourcePath: input.sourcePath,
    sourceExt: input.sourceExt,
    targetExt,
    converterId,
  });

  const currentCacheIdentity = input.conversionManager.canConvert(input.sourceExt)
    ? await input.conversionManager.getConverterCacheIdentity(input.sourceExt)
    : undefined;

  const cached = input.convertedAssetCache?.get(input.sourcePath, input.sourceExt, targetExt);
  if (cached) {
    if (!(await isCachedOutputAvailable(cached.outputPath))) {
      log.warn("conversion cache stale", {
        sourcePath: input.sourcePath,
        sourceExt: input.sourceExt,
        targetExt,
        outputPath: cached.outputPath,
      });
      input.convertedAssetCache?.delete(input.sourcePath, input.sourceExt, targetExt);
    } else if (!isCachedRecordCompatible(cached, converterId, currentCacheIdentity)) {
      log.warn("conversion cache identity mismatch", {
        sourcePath: input.sourcePath,
        sourceExt: input.sourceExt,
        targetExt,
        cachedConverterId: cached.converterId,
        cachedConverterCacheKey: cached.converterCacheKey,
        currentConverterId: currentCacheIdentity?.converterId ?? converterId,
        currentConverterCacheKey: currentCacheIdentity?.cacheKey,
      });
      input.convertedAssetCache?.delete(input.sourcePath, input.sourceExt, targetExt);
    } else {
      log.info("conversion cache hit", {
        sourcePath: input.sourcePath,
        sourceExt: input.sourceExt,
        targetExt,
        outputPath: cached.outputPath,
      });
      return {
        effectivePath: cached.outputPath,
        effectiveExt: cached.outputExt,
        warnings: [...cached.warnings, "Using cached conversion output."],
      };
    }
  }

  if (!input.conversionManager.canConvert(input.sourceExt)) {
    throw new Error(
      `Converter '${converterId}' is not registered for .${input.sourceExt}. ` +
      `Enable the matching converter in plugin settings before loading this format.`,
    );
  }

  const result = await input.conversionManager.convert({
    sourcePath: input.sourcePath,
    sourceExt: input.sourceExt,
    targetExt,
  });

  input.convertedAssetCache?.set({
    cacheVersion: CONVERTED_ASSET_CACHE_VERSION,
    converterId,
    converterCacheKey: currentCacheIdentity?.cacheKey ?? converterId,
    sourcePath: input.sourcePath,
    sourceExt: input.sourceExt,
    targetExt,
    outputPath: result.outputPath,
    outputExt: result.outputExt,
    warnings: result.warnings,
    createdAt: Date.now(),
  });

  log.info("conversion route done", {
    sourcePath: input.sourcePath,
    outputPath: result.outputPath,
    warningCount: result.warnings.length,
  });

  return {
    effectivePath: result.outputPath,
    effectiveExt: result.outputExt,
    warnings: result.warnings,
  };
}
