import type { ZoomRegion } from "../types";
import { smoothStep } from "./mathUtils";
import { TRANSITION_WINDOW_MS } from "./constants";

export function computeRegionStrength(region: ZoomRegion, timeMs: number) {
  if (timeMs >= region.startMs && timeMs <= region.endMs) {
    return 1;
  }
  return 0;
}

export function findDominantRegion(regions: ZoomRegion[], timeMs: number) {
  let bestRegion: ZoomRegion | null = null;
  let bestStrength = 0;

  for (const region of regions) {
    const strength = computeRegionStrength(region, timeMs);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestRegion = region;
    }
  }

  return { region: bestRegion, strength: bestStrength };
}

/**
 * Weighted blend of all active zoom regions for cinematic camera transitions.
 */
export function findInterpolatedTarget(regions: ZoomRegion[], timeMs: number) {
  let totalStrength = 0;
  let weightedFocusX = 0;
  let weightedFocusY = 0;
  let weightedDepth = 0;
  let maxStrength = 0;
  let dominantRegion: ZoomRegion | null = null;

  for (const region of regions) {
    const strength = computeRegionStrength(region, timeMs);
    if (strength > 0) {
      weightedFocusX += region.focus.cx * strength;
      weightedFocusY += region.focus.cy * strength;
      weightedDepth += region.depth * strength;
      totalStrength += strength;

      if (strength > maxStrength) {
        maxStrength = strength;
        dominantRegion = region;
      }
    }
  }

  if (totalStrength === 0) {
    return { region: null, strength: 0, focus: null, depth: null };
  }

  return {
    region: dominantRegion,
    strength: Math.min(1, totalStrength),
    focus: {
      cx: weightedFocusX / totalStrength,
      cy: weightedFocusY / totalStrength,
    },
    depth: weightedDepth / totalStrength,
  };
}

/**
 * Linearly interpolate zoom scale for non-integer depth values.
 * E.g. depth=2.3 → lerp between ZOOM_DEPTH_SCALES[2] and ZOOM_DEPTH_SCALES[3].
 */
export function interpolateZoomScale(
  depth: number,
  scaleMap: Record<number, number>
): number {
  const lo = Math.max(1, Math.floor(depth));
  const hi = Math.min(6, Math.ceil(depth));
  if (lo === hi) return scaleMap[lo] ?? 1;
  const t = depth - lo;
  return (scaleMap[lo] ?? 1) * (1 - t) + (scaleMap[hi] ?? 1) * t;
}
