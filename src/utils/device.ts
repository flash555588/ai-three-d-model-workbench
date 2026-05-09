import { Platform } from "obsidian";

/** Detect mobile/touch devices for performance tuning. */
export function isMobile(): boolean {
  return Platform.isMobile;
}

/**
 * Hardware scaling factor for Babylon Engine.
 * Higher value = lower resolution = better performance.
 * Desktop: 1 (native), Mobile: 2 (half resolution each axis).
 */
export function hardwareScale(): number {
  return isMobile() ? 2 : 1;
}
