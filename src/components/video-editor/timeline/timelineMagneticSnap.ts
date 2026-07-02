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

export interface TimelineMagneticSnapResult {
  span: Span;
  targetMs: number | null;
  edge: "start" | "end" | null;
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

export function getTimelineMagneticSnapResult({
  activeItemId,
  targetSpan,
  items,
  currentTimeMs,
  intervalMs,
  videoRowId,
}: GetMagneticSnapSpanOptions): TimelineMagneticSnapResult {
  const activeItem = items.find((item) => item.id === activeItemId);
  if (!activeItem) return { span: targetSpan, targetMs: null, edge: null };

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
  let snapTargetMs: number | null = null;
  let snapEdge: TimelineMagneticSnapResult["edge"] = null;

  const trySnapEdge = (edgeMs: number, edge: "start" | "end") => {
    for (const targetMs of snapTargets) {
      const diff = targetMs - edgeMs;
      if (Math.abs(diff) < Math.abs(closestDelta) && Math.abs(diff) <= snapThresholdMs) {
        closestDelta = diff;
        snapOffset = diff;
        snapTargetMs = targetMs;
        snapEdge = edge;
      }
    }
  };

  if (isTrimming) {
    const isResizingLeft = Math.abs(targetSpan.end - oldSpan.end) <= 2;
    const isResizingRight = Math.abs(targetSpan.start - oldSpan.start) <= 2;

    if (isResizingLeft) {
      trySnapEdge(targetSpan.start, "start");
      return closestDelta !== Infinity
        ? { span: { start: targetSpan.start + snapOffset, end: targetSpan.end }, targetMs: snapTargetMs, edge: snapEdge }
        : { span: targetSpan, targetMs: null, edge: null };
    }

    if (isResizingRight) {
      trySnapEdge(targetSpan.end, "end");
      return closestDelta !== Infinity
        ? { span: { start: targetSpan.start, end: targetSpan.end + snapOffset }, targetMs: snapTargetMs, edge: snapEdge }
        : { span: targetSpan, targetMs: null, edge: null };
    }

    return { span: targetSpan, targetMs: null, edge: null };
  }

  trySnapEdge(targetSpan.start, "start");
  trySnapEdge(targetSpan.end, "end");

  return closestDelta !== Infinity
    ? { span: { start: targetSpan.start + snapOffset, end: targetSpan.end + snapOffset }, targetMs: snapTargetMs, edge: snapEdge }
    : { span: targetSpan, targetMs: null, edge: null };
}

export function getTimelineMagneticSnapSpan(options: GetMagneticSnapSpanOptions): Span {
  return getTimelineMagneticSnapResult(options).span;
}
