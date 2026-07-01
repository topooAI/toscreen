import type { Span } from "dnd-timeline";

export interface TimelineSnapItem {
  id: string;
  rowId: string;
  span: Span;
}

interface GetMagneticSnapSpanOptions {
  activeItemId: string;
  targetSpan: Span;
  items: readonly TimelineSnapItem[];
  currentTimeMs: number;
  intervalMs: number;
  videoRowId: string;
}

export function getTimelineSnapThresholdMs(intervalMs: number): number {
  const safeInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 0;
  return Math.max(50, Math.min(300, safeInterval / 5));
}

export function collectTimelineSnapTargets({
  activeItemId,
  items,
  currentTimeMs,
  videoRowId,
}: Pick<GetMagneticSnapSpanOptions, "activeItemId" | "items" | "currentTimeMs" | "videoRowId">): number[] {
  const baseExcludeId = activeItemId.split("-part-")[0];
  const activeItem = items.find((item) => item.id === activeItemId);

  if (!activeItem) return [];

  const targets = Number.isFinite(currentTimeMs) ? [currentTimeMs] : [];

  for (const item of items) {
    if (item.id === activeItemId) continue;
    if (item.id.split("-part-")[0] === baseExcludeId) continue;
    if (item.rowId !== activeItem.rowId && item.rowId !== videoRowId) continue;
    if (Number.isFinite(item.span.start)) targets.push(item.span.start);
    if (Number.isFinite(item.span.end)) targets.push(item.span.end);
  }

  return targets;
}

export function getTimelineMagneticSnapSpan({
  activeItemId,
  targetSpan,
  items,
  currentTimeMs,
  intervalMs,
  videoRowId,
}: GetMagneticSnapSpanOptions): Span {
  const activeItem = items.find((item) => item.id === activeItemId);
  if (!activeItem) return targetSpan;

  const oldSpan = activeItem.span;
  const snapTargets = collectTimelineSnapTargets({
    activeItemId,
    items,
    currentTimeMs,
    videoRowId,
  });
  const snapThresholdMs = getTimelineSnapThresholdMs(intervalMs);

  const duration = targetSpan.end - targetSpan.start;
  const oldDuration = oldSpan.end - oldSpan.start;
  const isTrimming = Math.abs(duration - oldDuration) > 1;

  let closestDelta = Infinity;
  let snapOffset = 0;

  const trySnapEdge = (edgeMs: number) => {
    for (const targetMs of snapTargets) {
      const diff = targetMs - edgeMs;
      if (Math.abs(diff) < Math.abs(closestDelta) && Math.abs(diff) <= snapThresholdMs) {
        closestDelta = diff;
        snapOffset = diff;
      }
    }
  };

  if (isTrimming) {
    const isResizingLeft = Math.abs(targetSpan.end - oldSpan.end) <= 2;
    const isResizingRight = Math.abs(targetSpan.start - oldSpan.start) <= 2;

    if (isResizingLeft) {
      trySnapEdge(targetSpan.start);
      return closestDelta !== Infinity
        ? { start: targetSpan.start + snapOffset, end: targetSpan.end }
        : targetSpan;
    }

    if (isResizingRight) {
      trySnapEdge(targetSpan.end);
      return closestDelta !== Infinity
        ? { start: targetSpan.start, end: targetSpan.end + snapOffset }
        : targetSpan;
    }

    return targetSpan;
  }

  trySnapEdge(targetSpan.start);
  trySnapEdge(targetSpan.end);

  return closestDelta !== Infinity
    ? { start: targetSpan.start + snapOffset, end: targetSpan.end + snapOffset }
    : targetSpan;
}
