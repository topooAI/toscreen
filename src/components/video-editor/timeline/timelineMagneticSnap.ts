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
  interaction?: "drag" | "resize" | "auto";
  snapThresholdMs?: number;
}

interface CollectTimelineSnapTargetsOptions {
  activeItemId: string;
  items: readonly TimelineSnapItem[];
  currentTimeMs: number;
  includeCurrentTime?: boolean;
}

interface GetAdjacentSnapSpanOptions {
  activeItemId: string;
  targetSpan: Span;
  items: readonly TimelineSnapItem[];
  intervalMs: number;
  minMs?: number;
  maxMs?: number;
  snapThresholdMs?: number;
}

export interface TimelineMagneticSnapResult {
  span: Span;
  targetMs: number | null;
  edge: "start" | "end" | null;
}

interface FitSnapSpanToNearbyEdgesOptions {
  activeItemId: string;
  targetSpan: Span;
  items: readonly TimelineSnapItem[];
  intervalMs: number;
}

export function getTimelineSnapThresholdMs(intervalMs: number): number {
  const safeInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 0;
  return Math.max(70, Math.min(300, safeInterval * 0.16));
}

function getRowFamily(rowId: string): string {
  if (rowId.startsWith("row-zoom-")) return "row-zoom";
  if (rowId.startsWith("row-annotation-")) return "row-annotation";
  if (rowId.startsWith("row-audio-")) return "row-audio";
  return rowId;
}

export function collectTimelineSnapTargets({
  activeItemId,
  items,
  currentTimeMs,
  includeCurrentTime = false,
}: CollectTimelineSnapTargetsOptions): number[] {
  const baseExcludeId = activeItemId.split("-part-")[0];
  const activeItem = items.find((item) => item.id === activeItemId);

  if (!activeItem) return [];

  const targets = includeCurrentTime && Number.isFinite(currentTimeMs) ? [currentTimeMs] : [];

  for (const item of items) {
    if (item.id === activeItemId) continue;
    if (item.id.split("-part-")[0] === baseExcludeId) continue;
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
  interaction = "auto",
  snapThresholdMs: requestedSnapThresholdMs,
}: GetMagneticSnapSpanOptions): TimelineMagneticSnapResult {
  const activeItem = items.find((item) => item.id === activeItemId);
  if (!activeItem) return { span: targetSpan, targetMs: null, edge: null };

  const oldSpan = activeItem.span;
  const snapTargets = collectTimelineSnapTargets({
    activeItemId,
    items,
    currentTimeMs,
    includeCurrentTime: false,
  });
  const snapThresholdMs = Number.isFinite(requestedSnapThresholdMs)
    ? Math.max(0, requestedSnapThresholdMs!)
    : getTimelineSnapThresholdMs(intervalMs);

  const duration = targetSpan.end - targetSpan.start;
  const oldDuration = oldSpan.end - oldSpan.start;
  const isTrimming = interaction === "resize" || (interaction === "auto" && Math.abs(duration - oldDuration) > 1);

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
    const startDelta = Math.abs(targetSpan.start - oldSpan.start);
    const endDelta = Math.abs(targetSpan.end - oldSpan.end);
    const isResizingLeft = startDelta > endDelta;
    const isResizingRight = endDelta >= startDelta && endDelta > 0;

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

  const adjacentSpan = getTimelineAdjacentSnapSpan({
    activeItemId,
    targetSpan,
    items,
    intervalMs,
    snapThresholdMs,
  });
  const adjacentOffset = adjacentSpan !== targetSpan
    ? adjacentSpan.start - targetSpan.start
    : Infinity;

  if (Number.isFinite(adjacentOffset)) {
    const startMoved = Math.abs(adjacentSpan.start - targetSpan.start) > Math.abs(adjacentSpan.end - targetSpan.end);
    return {
      span: adjacentSpan,
      targetMs: startMoved ? adjacentSpan.start : adjacentSpan.end,
      edge: startMoved ? "start" : "end",
    };
  }

  const tryDragSnapEdge = (edgeMs: number, edge: "start" | "end") => {
    for (const targetMs of snapTargets) {
      const diff = targetMs - edgeMs;
      if (Math.abs(diff) > snapThresholdMs || Math.abs(diff) >= Math.abs(closestDelta)) continue;

      closestDelta = diff;
      snapOffset = diff;
      snapTargetMs = targetMs;
      snapEdge = edge;
    }
  };

  tryDragSnapEdge(targetSpan.start, "start");
  tryDragSnapEdge(targetSpan.end, "end");
  const genericSpan = closestDelta !== Infinity
    ? { start: targetSpan.start + snapOffset, end: targetSpan.end + snapOffset }
    : null;

  if (closestDelta !== Infinity) {
    return {
      span: genericSpan!,
      targetMs: snapTargetMs,
      edge: snapEdge,
    };
  }

  return { span: targetSpan, targetMs: null, edge: null };
}

export function getTimelineMagneticSnapSpan(options: GetMagneticSnapSpanOptions): Span {
  return getTimelineMagneticSnapResult(options).span;
}

export function fitTimelineSnapSpanToNearbyEdges({
  activeItemId,
  targetSpan,
  items,
  intervalMs,
}: FitSnapSpanToNearbyEdgesOptions): Span {
  const activeItem = items.find((item) => item.id === activeItemId);
  if (!activeItem) return targetSpan;

  const baseExcludeId = activeItemId.split("-part-")[0];
  const activeFamily = getRowFamily(activeItem.rowId);
  const thresholdMs = Math.max(1, getTimelineSnapThresholdMs(intervalMs));
  let fittedSpan = { ...targetSpan };

  for (const item of items) {
    if (item.id === activeItemId) continue;
    if (item.id.split("-part-")[0] === baseExcludeId) continue;
    if (getRowFamily(item.rowId) !== activeFamily) continue;

    if (Math.abs(fittedSpan.start - item.span.end) <= thresholdMs) {
      fittedSpan = {
        start: item.span.end,
        end: fittedSpan.end,
      };
    }

    if (Math.abs(fittedSpan.end - item.span.start) <= thresholdMs) {
      fittedSpan = {
        start: fittedSpan.start,
        end: item.span.start,
      };
    }
  }

  return fittedSpan.end > fittedSpan.start ? fittedSpan : targetSpan;
}

export function getTimelineAdjacentSnapSpan({
  activeItemId,
  targetSpan,
  items,
  intervalMs,
  minMs = 0,
  maxMs = Number.POSITIVE_INFINITY,
  snapThresholdMs,
}: GetAdjacentSnapSpanOptions): Span {
  const activeItem = items.find((item) => item.id === activeItemId);
  if (!activeItem) return targetSpan;

  const duration = targetSpan.end - targetSpan.start;
  if (!Number.isFinite(duration) || duration <= 0) return targetSpan;

  const baseExcludeId = activeItemId.split("-part-")[0];
  const activeFamily = getRowFamily(activeItem.rowId);
  const thresholdMs = Number.isFinite(snapThresholdMs)
    ? Math.max(0, snapThresholdMs!)
    : getTimelineSnapThresholdMs(intervalMs);
  let bestSpan: Span | null = null;
  let bestDistance = Infinity;

  const tryCandidate = (candidate: Span, distance: number) => {
    if (candidate.start < minMs || candidate.end > maxMs) return;
    if (distance > thresholdMs) return;
    if (distance >= bestDistance) return;
    bestDistance = distance;
    bestSpan = candidate;
  };

  for (const item of items) {
    if (item.id === activeItemId) continue;
    if (item.id.split("-part-")[0] === baseExcludeId) continue;
    if (getRowFamily(item.rowId) !== activeFamily) continue;

    tryCandidate(
      { start: item.span.start - duration, end: item.span.start },
      Math.abs(targetSpan.end - item.span.start),
    );
    tryCandidate(
      { start: item.span.end, end: item.span.end + duration },
      Math.abs(targetSpan.start - item.span.end),
    );
  }

  return bestSpan ?? targetSpan;
}
