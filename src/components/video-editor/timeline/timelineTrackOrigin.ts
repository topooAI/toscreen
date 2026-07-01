export const TIMELINE_SIDEBAR_WIDTH_PX = 140;
export const TIMELINE_BREATHING_GAP_PX = 16;
export const FALLBACK_TRACK_START_PX = TIMELINE_SIDEBAR_WIDTH_PX + TIMELINE_BREATHING_GAP_PX;

interface ResolveTrackStartOptions {
  timelineLeftPx?: number;
  trackLeftPx?: number;
  fallbackPx?: number;
}

const finiteNumberOrNull = (value: number | undefined): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

export function resolveTrackStartPx({
  timelineLeftPx,
  trackLeftPx,
  fallbackPx = FALLBACK_TRACK_START_PX,
}: ResolveTrackStartOptions): number {
  const safeFallbackPx = Math.max(0, finiteNumberOrNull(fallbackPx) ?? FALLBACK_TRACK_START_PX);
  const safeTimelineLeftPx = finiteNumberOrNull(timelineLeftPx);
  const safeTrackLeftPx = finiteNumberOrNull(trackLeftPx);

  if (safeTimelineLeftPx === null || safeTrackLeftPx === null) {
    return safeFallbackPx;
  }

  return Math.max(0, safeTrackLeftPx - safeTimelineLeftPx);
}
