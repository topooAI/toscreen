import type { ZoomRegion } from "../types";

export type ThumbnailSegment = {
  id: string;
  startMs: number;
  endMs: number;
  zoom?: ZoomRegion;
  images: string[];
};

export function buildThumbnailSegments(
  sourceStartMs: number,
  durationMs: number,
  zoomRegions: ZoomRegion[] = [],
): ThumbnailSegment[] {
  const sourceEndMs = sourceStartMs + durationMs;
  const segments: ThumbnailSegment[] = [];
  let cursor = sourceStartMs;

  const overlappingZooms = [...zoomRegions]
    .map((region) => ({
      region,
      startMs: Math.max(sourceStartMs, region.startMs),
      endMs: Math.min(sourceEndMs, region.endMs),
    }))
    .filter(({ startMs, endMs }) => endMs > startMs)
    .sort((a, b) => a.startMs - b.startMs);

  overlappingZooms.forEach(({ region, startMs, endMs }) => {
    if (cursor < startMs) {
      segments.push({
        id: `default-${cursor}-${startMs}`,
        startMs: cursor,
        endMs: startMs,
        images: [],
      });
    }

    const zoomStart = Math.max(cursor, startMs);
    if (endMs > zoomStart) {
      segments.push({
        id: `${region.id}-${zoomStart}-${endMs}`,
        startMs: zoomStart,
        endMs,
        zoom: region,
        images: [],
      });
      cursor = endMs;
    }
  });

  if (cursor < sourceEndMs) {
    segments.push({
      id: `default-${cursor}-${sourceEndMs}`,
      startMs: cursor,
      endMs: sourceEndMs,
      images: [],
    });
  }

  return segments;
}

export function getZoomBoundaryPercents(
  sourceStartMs: number,
  durationMs: number,
  zoomRegions: ZoomRegion[] = [],
) {
  const sourceEndMs = sourceStartMs + durationMs;
  const boundaries = new Set<number>();

  zoomRegions.forEach((region) => {
    const start = Math.max(sourceStartMs, region.startMs);
    const end = Math.min(sourceEndMs, region.endMs);
    if (end <= start) return;

    [start, end].forEach((timeMs) => {
      const localMs = timeMs - sourceStartMs;
      if (localMs <= 0 || localMs >= durationMs) return;
      boundaries.add(Math.round((localMs / durationMs) * 10000) / 100);
    });
  });

  return Array.from(boundaries).sort((a, b) => a - b);
}
