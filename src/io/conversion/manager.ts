import { normalizeModelExt } from "../formats/registry";
import type { ConversionRequest, ConversionResult, ModelConverter } from "./types";
import { createLogger } from "../../utils/log";

const log = createLogger("conversion-manager");

export class ConversionManager {
  private readonly converters = new Map<string, ModelConverter>();

  private getConverter(ext: string): ModelConverter | undefined {
    return this.converters.get(normalizeModelExt(ext));
  }

  registerConverter(converter: ModelConverter): void {
    log.info("register converter", { converterId: converter.id, sourceExts: [...converter.sourceExts] });
    for (const ext of converter.sourceExts) {
      this.converters.set(normalizeModelExt(ext), converter);
    }
  }

  canConvert(ext: string): boolean {
    const normalized = normalizeModelExt(ext);
    const ok = this.converters.has(normalized);
    log.debug("can convert", { ext: normalized, ok });
    return ok;
  }

  async getConverterCacheIdentity(ext: string): Promise<{ converterId: string; cacheKey: string } | undefined> {
    const converter = this.getConverter(ext);
    if (!converter) {
      return undefined;
    }

    return {
      converterId: converter.id,
      cacheKey: await converter.getCacheKey(),
    };
  }

  async convert(req: ConversionRequest): Promise<ConversionResult> {
    const ext = normalizeModelExt(req.sourceExt);
    const converter = this.getConverter(ext);
    if (!converter) {
      log.error("converter missing", { ext, targetExt: req.targetExt });
      throw new Error(`No converter registered for .${ext}`);
    }
    log.info("dispatch conversion", { converterId: converter.id, ext, targetExt: req.targetExt });
    return converter.convert({ ...req, sourceExt: ext });
  }
}
