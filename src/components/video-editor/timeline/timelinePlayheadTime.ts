interface ResolveTimelinePlayheadTimeOptions {
  currentTimeMs: number;
  externalVideoTimeMs?: number;
  isVideoPlaying?: boolean;
  isDragging?: boolean;
  freezeExternalTime?: boolean;
  isTrimTrackVisible?: boolean;
  mapSourceToEffective?: (ms: number) => number;
}

export interface TimelinePlayheadTimeResolution {
  displayTimeMs: number | null;
  source: "react-current-time" | "video-current-time";
}

const finiteNumberOrNull = (value: number | undefined): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

export function resolveTimelinePlayheadDisplayTime({
  currentTimeMs,
  externalVideoTimeMs,
  isVideoPlaying = false,
  isDragging = false,
  freezeExternalTime = false,
  isTrimTrackVisible = false,
  mapSourceToEffective,
}: ResolveTimelinePlayheadTimeOptions): TimelinePlayheadTimeResolution {
  const safeCurrentTimeMs = finiteNumberOrNull(currentTimeMs);
  if (safeCurrentTimeMs === null) {
    return {
      displayTimeMs: null,
      source: "react-current-time",
    };
  }

  const shouldTrustVideoTime = !freezeExternalTime && !isDragging && isVideoPlaying;
  const externalMs = finiteNumberOrNull(externalVideoTimeMs);

  if (!shouldTrustVideoTime || externalMs === null) {
    return {
      displayTimeMs: safeCurrentTimeMs,
      source: "react-current-time",
    };
  }

  const mappedExternalMs = (isTrimTrackVisible || !mapSourceToEffective)
    ? externalMs
    : mapSourceToEffective(externalMs);
  const safeMappedExternalMs = finiteNumberOrNull(mappedExternalMs);
  if (safeMappedExternalMs === null) {
    return {
      displayTimeMs: safeCurrentTimeMs,
      source: "react-current-time",
    };
  }

  return {
    displayTimeMs: safeMappedExternalMs,
    source: "video-current-time",
  };
}
