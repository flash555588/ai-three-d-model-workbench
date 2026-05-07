/** Detect mobile/touch devices for performance tuning. */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints ?? 0) > 1
  );
}

/**
 * Hardware scaling factor for Babylon Engine.
 * Higher value = lower resolution = better performance.
 * Desktop: 1 (native), Mobile: 2 (half resolution each axis).
 */
export function hardwareScale(): number {
  return isMobile() ? 2 : 1;
}
