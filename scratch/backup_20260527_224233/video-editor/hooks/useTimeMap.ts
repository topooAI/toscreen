import { useCallback, useMemo } from 'react';
import type { TrimRegion } from '../types';

export function useTimeMap(trimRegions: TrimRegion[], videoDurationMs: number) {
  // 确保 regions 始终按开始时间排序
  const sortedTrims = useMemo(() => {
    return [...trimRegions].sort((a, b) => a.startMs - b.startMs);
  }, [trimRegions]);

  // 计算总跳过时长
  const totalTrimDurationMs = useMemo(() => {
    return sortedTrims.reduce((sum, trim) => sum + (trim.endMs - trim.startMs), 0);
  }, [sortedTrims]);

  // 有效成片时长
  const effectiveDurationMs = Math.max(0, videoDurationMs - totalTrimDurationMs);

  /**
   * 将源视频的绝对时间转换成界面/成片上的有效时间
   * 如果给定的 sourceTime 落在某个被 Trim 的缝隙里，
   * 会自动将其收缩并对齐到该缝隙的起始位置。
   */
  const mapSourceToEffective = useCallback((sourceTimeMs: number): number => {
    let effectiveTimeMs = sourceTimeMs;
    for (const trim of sortedTrims) {
      if (sourceTimeMs <= trim.startMs) {
        break;
      }
      if (sourceTimeMs > trim.startMs && sourceTimeMs < trim.endMs) {
        // 如果落在了被截断的区域内部，有效时间只能停留在这个切割点
        effectiveTimeMs -= (sourceTimeMs - trim.startMs);
        break;
      }
      if (sourceTimeMs >= trim.endMs) {
        // 跨过了整个跳过区域，需要扣除这个区域的宽度
        effectiveTimeMs -= (trim.endMs - trim.startMs);
      }
    }
    return Math.max(0, effectiveTimeMs);
  }, [sortedTrims]);

  /**
   * 将 UI/界面上拖拽得到的有效时间，转换回源视频的真实时间。
   * 当拖拽经过切分缝隙时，这能保证真实的时间轴正确跳跃。
   */
  const mapEffectiveToSource = useCallback((effectiveTimeMs: number): number => {
    let sourceTimeMs = effectiveTimeMs;
    for (const trim of sortedTrims) {
      if (sourceTimeMs < trim.startMs) {
        break;
      }
      sourceTimeMs += (trim.endMs - trim.startMs);
    }
    return sourceTimeMs;
  }, [sortedTrims]);

  return {
    effectiveDurationMs,
    mapSourceToEffective,
    mapEffectiveToSource,
  };
}
