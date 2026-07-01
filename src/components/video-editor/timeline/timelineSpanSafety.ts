import type { Span } from "dnd-timeline";

interface NormalizeTimelineSpanOptions {
  minItemDurationMs: number;
  fallbackStartMs?: number;
}

const finiteNumberOr = (value: number, fallback: number) => (
  Number.isFinite(value) ? value : fallback
);

export function normalizeTimelineInteractionSpan(
  span: Span,
  { minItemDurationMs, fallbackStartMs = 0 }: NormalizeTimelineSpanOptions,
): Span {
  const minDuration = Number.isFinite(minItemDurationMs) && minItemDurationMs > 0
    ? minItemDurationMs
    : 1;
  const candidateStart = finiteNumberOr(span.start, fallbackStartMs);
  const candidateEnd = finiteNumberOr(span.end, candidateStart + minDuration);
  const rawDuration = candidateEnd - candidateStart;
  const duration = Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.max(rawDuration, minDuration)
    : minDuration;
  const start = Math.max(0, candidateStart);

  return {
    start,
    end: start + duration,
  };
}
