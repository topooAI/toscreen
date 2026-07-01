import type { TrimRegion } from "../types";

export interface TrimInterval {
  startMs: number;
  endMs: number;
}

function finiteNumber(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function normalizeTrimIntervals(trimRegions: TrimRegion[], sourceTotalMs: number): TrimInterval[] {
  const sourceEndMs = Math.max(0, finiteNumber(sourceTotalMs));
  const sorted = trimRegions
    .map((trim) => ({
      startMs: Math.max(0, Math.min(sourceEndMs, finiteNumber(trim.startMs))),
      endMs: Math.max(0, Math.min(sourceEndMs, finiteNumber(trim.endMs))),
    }))
    .filter((trim) => trim.endMs > trim.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: TrimInterval[] = [];
  for (const trim of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || trim.startMs > previous.endMs) {
      merged.push({ ...trim });
      continue;
    }
    previous.endMs = Math.max(previous.endMs, trim.endMs);
  }

  return merged;
}

export function createTimelineTimeMap(trimRegions: TrimRegion[], sourceTotalMs: number) {
  const trimIntervals = normalizeTrimIntervals(trimRegions, sourceTotalMs);
  const totalTrimDurationMs = trimIntervals.reduce(
    (sum, trim) => sum + (trim.endMs - trim.startMs),
    0,
  );
  const effectiveDurationMs = Math.max(0, Math.max(0, finiteNumber(sourceTotalMs)) - totalTrimDurationMs);

  const mapSourceToEffective = (sourceTimeMs: number): number => {
    const safeSourceTimeMs = Math.max(0, finiteNumber(sourceTimeMs));
    let effectiveTimeMs = safeSourceTimeMs;
    for (const trim of trimIntervals) {
      if (safeSourceTimeMs <= trim.startMs) break;
      if (safeSourceTimeMs > trim.startMs && safeSourceTimeMs < trim.endMs) {
        effectiveTimeMs -= safeSourceTimeMs - trim.startMs;
        break;
      }
      effectiveTimeMs -= trim.endMs - trim.startMs;
    }
    return Math.max(0, effectiveTimeMs);
  };

  const mapEffectiveToSource = (effectiveTimeMs: number): number => {
    const safeEffectiveTimeMs = Math.max(0, finiteNumber(effectiveTimeMs));
    let sourceTimeMs = safeEffectiveTimeMs;
    let consumedTrimDurationMs = 0;
    for (const trim of trimIntervals) {
      const effectiveTrimStartMs = trim.startMs - consumedTrimDurationMs;
      if (safeEffectiveTimeMs < effectiveTrimStartMs) break;
      const trimDurationMs = trim.endMs - trim.startMs;
      sourceTimeMs += trimDurationMs;
      consumedTrimDurationMs += trimDurationMs;
    }
    return sourceTimeMs;
  };

  return {
    trimIntervals,
    totalTrimDurationMs,
    effectiveDurationMs,
    mapSourceToEffective,
    mapEffectiveToSource,
  };
}
