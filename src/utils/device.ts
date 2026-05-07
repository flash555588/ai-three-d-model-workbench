/** Detect mobile/touch devices for performance tuning. */
export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints ?? 0) > 1
  );
}

/**
 * Hardware scaling level for Babylon Engine.
 * Lower value = higher resolution. 1 = CSS pixel resolution.
 * Mobile: 2 (half resolution) for performance.
 */
export function hardwareScale(): number {
  return isMobile() ? 2 : 1;
}
