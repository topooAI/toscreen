interface ResolveTimelineSeekOptions {
  clientX: number;
  timelineLeftPx: number;
  trackStartPx: number;
  rangeStartMs: number;
  durationMs: number;
  pixelsToValue: (pixels: number) => number;
  mapEffectiveToSource?: (ms: number) => number;
  isTrimTrackVisible?: boolean;
}

export interface TimelineSeekResolution {
  rawX: number;
  trackX: number;
  effectiveMs: number;
  sourceMs: number;
  isBreathingArea: boolean;
}

const finiteNumberOr = (value: number, fallback: number) => (
  Number.isFinite(value) ? value : fallback
);

export function resolveTimelineSeekFromClientX({
  clientX,
  timelineLeftPx,
  trackStartPx,
  rangeStartMs,
  durationMs,
  pixelsToValue,
  mapEffectiveToSource,
  isTrimTrackVisible = false,
}: ResolveTimelineSeekOptions): TimelineSeekResolution {
  const rawX = finiteNumberOr(clientX - timelineLeftPx, 0);
  const safeTrackStartPx = Math.max(0, finiteNumberOr(trackStartPx, 0));
  const safeDurationMs = Math.max(0, finiteNumberOr(durationMs, 0));

  if (rawX < safeTrackStartPx) {
    return {
      rawX,
      trackX: rawX - safeTrackStartPx,
      effectiveMs: 0,
      sourceMs: 0,
      isBreathingArea: true,
    };
  }

  const trackX = rawX - safeTrackStartPx;
  const relativeMs = finiteNumberOr(pixelsToValue(trackX), 0);
  const unclampedEffectiveMs = finiteNumberOr(rangeStartMs, 0) + relativeMs;
  const effectiveMs = Math.max(0, Math.min(safeDurationMs, unclampedEffectiveMs));
  const mappedSourceMs = (isTrimTrackVisible || !mapEffectiveToSource)
    ? effectiveMs
    : mapEffectiveToSource(effectiveMs);
  const sourceMs = Math.max(0, finiteNumberOr(mappedSourceMs, effectiveMs));

  return {
    rawX,
    trackX,
    effectiveMs,
    sourceMs,
    isBreathingArea: false,
  };
}
