import type { CursorDataPoint, ZoomFocus, ZoomRegion } from "../types";
import { TRANSITION_WINDOW_MS } from "./constants";
import { sampleCursorTrack } from "./cursorTrack";

const CONNECTED_ZOOM_GAP_MS = 16;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOut(value: number): number {
  const progress = clamp01(value);
  return 1 - Math.pow(1 - progress, 3);
}

function getTransitionDuration(region: ZoomRegion): number {
  return Math.min(TRANSITION_WINDOW_MS, Math.max(0, (region.endMs - region.startMs) / 2));
}

export function computeRegionStrength(region: ZoomRegion, timeMs: number) {
  const tolerance = 2;
  if (timeMs < region.startMs - tolerance || timeMs > region.endMs + tolerance) return 0;

  const transitionMs = getTransitionDuration(region);
  if (transitionMs <= 0) return 1;
  if (timeMs < region.startMs + transitionMs) {
    return easeOut((timeMs - region.startMs) / transitionMs);
  }
  if (timeMs > region.endMs - transitionMs) {
    return easeOut((region.endMs - timeMs) / transitionMs);
  }
  return 1;
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

function resolveFocus(
  region: ZoomRegion,
  timeMs: number,
  cursorTrack: readonly CursorDataPoint[],
): ZoomFocus {
  // Auto-generated Focus clips are fixed camera compositions. The source flag
  // records how the clip was created; it must not turn the shot into cursor-follow mode.
  if (region.focusMode !== "auto" || region.source === "auto") return region.focus;
  const sample = sampleCursorTrack(cursorTrack, timeMs);
  return sample ? { cx: sample.x, cy: sample.y } : region.focus;
}

function isConnected(left: ZoomRegion | undefined, right: ZoomRegion | undefined): boolean {
  if (!left || !right) return false;
  const gapMs = right.startMs - left.endMs;
  return gapMs >= -2 && gapMs <= CONNECTED_ZOOM_GAP_MS;
}

export function findInterpolatedTarget(
  regions: ZoomRegion[],
  timeMs: number,
  cursorTrack: readonly CursorDataPoint[] = [],
) {
  const ordered = regions
    .filter((region) => region.kind !== 'camera' && region.endMs > region.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (!isConnected(current, next)) continue;

    const transitionStart = current.endMs;
    const transitionEnd = Math.min(next.endMs, next.startMs + TRANSITION_WINDOW_MS);
    if (timeMs < transitionStart || timeMs > transitionEnd) continue;

    const progress = easeOut(
      (timeMs - transitionStart) / Math.max(1, transitionEnd - transitionStart),
    );
    const currentFocus = resolveFocus(current, Math.min(timeMs, current.endMs), cursorTrack);
    const nextFocus = resolveFocus(next, Math.max(timeMs, next.startMs), cursorTrack);
    return {
      region: next,
      strength: 1,
      focus: {
        cx: currentFocus.cx + (nextFocus.cx - currentFocus.cx) * progress,
        cy: currentFocus.cy + (nextFocus.cy - currentFocus.cy) * progress,
      },
      depth: current.depth + (next.depth - current.depth) * progress,
    };
  }

  let activeIndex = -1;
  for (let index = 0; index < ordered.length; index += 1) {
    const region = ordered[index];
    if (timeMs >= region.startMs - 2 && timeMs <= region.endMs + 2) {
      activeIndex = index;
    }
  }

  if (activeIndex < 0) {
    return { region: null, strength: 0, focus: null, depth: null };
  }

  const region = ordered[activeIndex];
  const previous = ordered[activeIndex - 1];
  const next = ordered[activeIndex + 1];
  const transitionMs = getTransitionDuration(region);
  const previousIsConnected = isConnected(previous, region);
  const nextIsConnected = isConnected(region, next);

  let strength = 1;
  if (!previousIsConnected && transitionMs > 0 && timeMs < region.startMs + transitionMs) {
    strength = easeOut((timeMs - region.startMs) / transitionMs);
  } else if (!nextIsConnected && transitionMs > 0 && timeMs > region.endMs - transitionMs) {
    strength = easeOut((region.endMs - timeMs) / transitionMs);
  }

  return {
    region,
    strength,
    focus: resolveFocus(region, timeMs, cursorTrack),
    depth: region.depth,
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
