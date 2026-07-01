import type { TrimRegion } from "../types";
import { normalizeTrimIntervals } from "./timelineTimeMap";

export interface MainClipSegment {
  id: string;
  sourceStartMs: number;
  sourceEndMs: number;
  effectiveStartMs: number;
  effectiveEndMs: number;
}

export function buildMainClipSegments(
  trimRegions: TrimRegion[],
  sourceTotalMs: number,
  mapSourceToEffective: (sourceTimeMs: number) => number,
): MainClipSegment[] {
  const sourceEndMs = Math.max(0, Number.isFinite(sourceTotalMs) ? sourceTotalMs : 0);
  if (sourceEndMs <= 0) return [];

  const segments: MainClipSegment[] = [];
  let currentSourceStartMs = 0;

  for (const trim of normalizeTrimIntervals(trimRegions, sourceEndMs)) {
    if (trim.startMs > currentSourceStartMs) {
      const index = segments.length;
      segments.push({
        id: `main-clip-${index}`,
        sourceStartMs: currentSourceStartMs,
        sourceEndMs: trim.startMs,
        effectiveStartMs: mapSourceToEffective(currentSourceStartMs),
        effectiveEndMs: mapSourceToEffective(trim.startMs),
      });
    }
    currentSourceStartMs = Math.max(currentSourceStartMs, trim.endMs);
  }

  if (currentSourceStartMs < sourceEndMs) {
    segments.push({
      id: "main-clip-final",
      sourceStartMs: currentSourceStartMs,
      sourceEndMs,
      effectiveStartMs: mapSourceToEffective(currentSourceStartMs),
      effectiveEndMs: mapSourceToEffective(sourceEndMs),
    });
  }

  return segments.filter((segment) => segment.effectiveEndMs > segment.effectiveStartMs);
}
