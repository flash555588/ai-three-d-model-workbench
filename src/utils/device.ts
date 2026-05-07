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
 * Babylon renders at: canvasWidth / hardwareScalingLevel.
 * We set it to baseScale / devicePixelRatio so:
 *   Desktop (base=1): renders at native device pixel resolution (crisp).
 *   Mobile  (base=2): renders at half device pixel resolution (fast).
 */
export function hardwareScale(): number {
  const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1;
  const base = isMobile() ? 2 : 1;
  return base / dpr;
}
