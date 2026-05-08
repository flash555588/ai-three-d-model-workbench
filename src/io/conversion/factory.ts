import { ConversionManager } from "./manager";
import { FreecadConverter } from "./adapters/freecad-converter";
import { Obj2GltfConverter } from "./adapters/obj2gltf-converter";
import { Fbx2GltfConverter } from "./adapters/fbx2gltf-converter";
import { AssimpConverter } from "./adapters/assimp-converter";
import { SldprtConverter } from "./adapters/sldprt-converter";
import { createLogger } from "../../utils/log";

const log = createLogger("conversion-factory");

export interface ConversionFactoryOptions {
  enabledConverterIds?: readonly string[];
  freecadCommand?: string;
  obj2gltfCommand?: string;
  fbx2gltfCommand?: string;
  assimpCommand?: string;
  freecadcmdCommand?: string;
}

export function createConversionManager(options?: ConversionFactoryOptions): ConversionManager {
  const manager = new ConversionManager();

  // Built-ins are opt-in so Phase 3 keeps runtime behavior unchanged.
  const enabled = new Set(options?.enabledConverterIds ?? []);
  log.debug("create conversion manager", { enabledConverterIds: [...enabled] });
  const builtins = [
    new FreecadConverter(options?.freecadCommand),
    new Obj2GltfConverter(options?.obj2gltfCommand),
    new Fbx2GltfConverter(options?.fbx2gltfCommand),
    new AssimpConverter(options?.assimpCommand),
    new SldprtConverter(options?.freecadcmdCommand),
  ];

  for (const converter of builtins) {
    if (enabled.has(converter.id)) {
      manager.registerConverter(converter);
      log.info("enabled converter", { converterId: converter.id });
    } else {
      log.debug("converter disabled", { converterId: converter.id });
    }
  }

  return manager;
}
