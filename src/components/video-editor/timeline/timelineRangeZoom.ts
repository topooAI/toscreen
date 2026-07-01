import type { Range } from "dnd-timeline";

export function clampTimelineRange(
  candidate: Range,
  minVisibleRangeMs: number,
  totalMs: number,
): Range {
  let { start, end } = candidate;

  if (start < 0) {
    const span = end - start;
    start = 0;
    end = span;
  }

  const maxSpan = Math.max(totalMs * 3, 60000);
  if (end - start > maxSpan) {
    end = start + maxSpan;
  }

  const absoluteMaxEnd = Math.max(totalMs + 60 * 60 * 1000, maxSpan);
  if (end > absoluteMaxEnd) {
    const span = end - start;
    end = absoluteMaxEnd;
    start = Math.max(0, end - span);
  }

  end = Math.max(start + minVisibleRangeMs, end);

  return { start, end };
}

export function resolveLeftAlignedTimelineRangeChange(
  previous: Range,
  updater: (previous: Range) => Range,
  minVisibleRangeMs: number,
  totalMs: number,
): Range {
  const normalized = clampTimelineRange(previous, minVisibleRangeMs, totalMs);
  let desired = updater(normalized);

  const prevSpan = normalized.end - normalized.start;
  const desiredSpan = desired.end - desired.start;
  const isZoom = Math.abs(prevSpan - desiredSpan) > 1;

  if (isZoom) {
    desired = {
      start: normalized.start,
      end: normalized.start + desiredSpan,
    };
  }

  return clampTimelineRange(desired, minVisibleRangeMs, totalMs);
}
