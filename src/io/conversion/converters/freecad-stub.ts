import type { ConversionRequest, ConversionResult, ModelConverter } from "../types";

/**
 * Placeholder converter for the future FreeCAD conversion channel.
 * Phase 3 keeps it disabled by default and returns an actionable error when invoked.
 */
export class FreecadStubConverter implements ModelConverter {
  readonly id = "freecad";
  readonly sourceExts = ["step", "stp", "iges", "igs", "brep", "x_t", "x_b", "catpart"] as const;
  readonly targetExt = "glb" as const;

  async getCacheKey(): Promise<string> {
    return `${this.id}:stub`;
  }

  async convert(req: ConversionRequest): Promise<ConversionResult> {
    throw new Error(
      `Converter '${this.id}' is not implemented yet for .${req.sourceExt} -> .${req.targetExt}. ` +
      "Please enable a real converter adapter in a later phase.",
    );
  }
}
