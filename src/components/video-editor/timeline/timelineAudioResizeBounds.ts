import type { Span } from "dnd-timeline";

function finiteNumber(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export interface AudioResizeBoundsInput {
  span: Span;
  sourceStartMs?: number;
  sourceTotalMs?: number;
  pxPerMs: number;
  minDurationMs?: number;
}

export interface AudioResizeBounds {
  sourceStartMs: number;
  sourceTotalMs: number;
  pxPerMs: number;
  minDurationMs: number;
  minAllowedStartMs: number;
  maxAllowedEndMs: number;
  minAllowedLeftPx: number;
  maxAllowedWidthPx: number;
  waveformLeftPx: number;
}

export function getAudioWaveformLeftPx(sourceStartMs: number | undefined, pxPerMs: number) {
  return -Math.max(0, finiteNumber(sourceStartMs)) * Math.max(0.0001, finiteNumber(pxPerMs, 1));
}

export function resolveAudioResizeBounds({
  span,
  sourceStartMs,
  sourceTotalMs,
  pxPerMs,
  minDurationMs = 1,
}: AudioResizeBoundsInput): AudioResizeBounds {
  const startMs = Math.max(0, finiteNumber(span.start));
  const endMs = Math.max(startMs + minDurationMs, finiteNumber(span.end, startMs + minDurationMs));
  const safeSourceStartMs = Math.max(0, finiteNumber(sourceStartMs));
  const fallbackSourceTotalMs = safeSourceStartMs + Math.max(minDurationMs, endMs - startMs);
  const safeSourceTotalMs = Math.max(
    safeSourceStartMs + minDurationMs,
    finiteNumber(sourceTotalMs, fallbackSourceTotalMs),
  );
  const safePxPerMs = Math.max(0.0001, finiteNumber(pxPerMs, 1));
  const safeMinDurationMs = Math.max(0.0001, finiteNumber(minDurationMs, 1));

  const minAllowedStartMs = Math.max(0, startMs - safeSourceStartMs);
  const maxAllowedWidthMs = Math.max(safeMinDurationMs, safeSourceTotalMs - safeSourceStartMs);
  const maxAllowedEndMs = startMs + maxAllowedWidthMs;

  return {
    sourceStartMs: safeSourceStartMs,
    sourceTotalMs: safeSourceTotalMs,
    pxPerMs: safePxPerMs,
    minDurationMs: safeMinDurationMs,
    minAllowedStartMs,
    maxAllowedEndMs,
    minAllowedLeftPx: minAllowedStartMs * safePxPerMs,
    maxAllowedWidthPx: maxAllowedWidthMs * safePxPerMs,
    waveformLeftPx: getAudioWaveformLeftPx(safeSourceStartMs, safePxPerMs),
  };
}

export function clampAudioResizeSpanToSource(
  span: Span,
  bounds: AudioResizeBounds,
  direction: "start" | "end",
): Span {
  if (direction === "start") {
    return {
      start: Math.max(bounds.minAllowedStartMs, Math.min(span.start, span.end - bounds.minDurationMs)),
      end: span.end,
    };
  }

  return {
    start: span.start,
    end: Math.min(bounds.maxAllowedEndMs, Math.max(span.start + bounds.minDurationMs, span.end)),
  };
}
