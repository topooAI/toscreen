export const MAX_SOURCE_FRAME_SEEK_RETRIES = 2;

export interface SourceFrameSeekDecision {
  retry: boolean;
  acceptNearest: boolean;
  deltaMs: number;
  toleranceMs: number;
}

export function resolveSourceFrameSeekDecision(input: {
  actualSourceTimeMs: number;
  targetSourceTimeMs: number;
  sourceFrameRate: number;
  retryCount: number;
}): SourceFrameSeekDecision {
  const frameRate = Number.isFinite(input.sourceFrameRate) && input.sourceFrameRate > 0
    ? input.sourceFrameRate
    : 30;
  const toleranceMs = Math.max(20, (1000 / frameRate) * 1.5);
  const deltaMs = Math.abs(input.actualSourceTimeMs - input.targetSourceTimeMs);
  const outsideTolerance = deltaMs > toleranceMs;
  const retry = outsideTolerance && input.retryCount < MAX_SOURCE_FRAME_SEEK_RETRIES;

  return {
    retry,
    acceptNearest: outsideTolerance && !retry,
    deltaMs,
    toleranceMs,
  };
}
