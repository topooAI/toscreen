import type { Span } from "dnd-timeline";

interface FocusSpanItem {
  id: string;
  startMs: number;
  endMs: number;
}

interface FocusSpanBounds {
  previousEndMs: number;
  nextStartMs: number;
}

function getFocusSpanBounds(
  activeItemId: string,
  items: readonly FocusSpanItem[],
  activeSpan: Span,
  maxMs: number,
): FocusSpanBounds {
  let previousEndMs = 0;
  let nextStartMs = maxMs;

  for (const item of items) {
    if (item.id === activeItemId) continue;
    if (item.endMs <= activeSpan.start) {
      previousEndMs = Math.max(previousEndMs, item.endMs);
    }
    if (item.startMs >= activeSpan.end) {
      nextStartMs = Math.min(nextStartMs, item.startMs);
    }
  }

  return { previousEndMs, nextStartMs };
}

export function constrainFocusDragSpan(
  activeItemId: string,
  targetSpan: Span,
  items: readonly FocusSpanItem[],
  maxMs: number,
): Span {
  const active = items.find((item) => item.id === activeItemId);
  if (!active) return targetSpan;

  const durationMs = active.endMs - active.startMs;
  const { previousEndMs, nextStartMs } = getFocusSpanBounds(
    activeItemId,
    items,
    { start: active.startMs, end: active.endMs },
    maxMs,
  );
  const maxStartMs = Math.max(previousEndMs, nextStartMs - durationMs);
  const start = Math.min(maxStartMs, Math.max(previousEndMs, targetSpan.start));
  return { start, end: start + durationMs };
}

export function constrainFocusResizeSpan(
  activeItemId: string,
  targetSpan: Span,
  items: readonly FocusSpanItem[],
  maxMs: number,
  minDurationMs = 1,
): Span {
  const active = items.find((item) => item.id === activeItemId);
  if (!active) return targetSpan;

  const activeSpan = { start: active.startMs, end: active.endMs };
  const { previousEndMs, nextStartMs } = getFocusSpanBounds(activeItemId, items, activeSpan, maxMs);
  const startDelta = Math.abs(targetSpan.start - activeSpan.start);
  const endDelta = Math.abs(targetSpan.end - activeSpan.end);

  if (startDelta > endDelta) {
    return {
      start: Math.min(activeSpan.end - minDurationMs, Math.max(previousEndMs, targetSpan.start)),
      end: activeSpan.end,
    };
  }

  return {
    start: activeSpan.start,
    end: Math.max(activeSpan.start + minDurationMs, Math.min(nextStartMs, targetSpan.end)),
  };
}
