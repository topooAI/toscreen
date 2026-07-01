import { useMemo } from 'react';
import type { TrimRegion } from '../types';
import { createTimelineTimeMap } from '../timeline/timelineTimeMap';

export function useTimeMap(trimRegions: TrimRegion[], videoDurationMs: number) {
  const timeMap = useMemo(
    () => createTimelineTimeMap(trimRegions, videoDurationMs),
    [trimRegions, videoDurationMs],
  );

  return {
    effectiveDurationMs: timeMap.effectiveDurationMs,
    mapSourceToEffective: timeMap.mapSourceToEffective,
    mapEffectiveToSource: timeMap.mapEffectiveToSource,
  };
}
