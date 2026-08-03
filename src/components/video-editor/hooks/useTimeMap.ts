import { useMemo } from 'react';
import type { TrimRegion } from '../types';
import { createTimelineTimeMap } from '../timeline/timelineTimeMap';
import { createMainTrackTimeMap, type EditingDocument } from '../editing';

export function useTimeMap(trimRegions: TrimRegion[], videoDurationMs: number, editingDocument?: EditingDocument) {
  const timeMap = useMemo(
    () => editingDocument
      ? createMainTrackTimeMap(editingDocument, videoDurationMs)
      : createTimelineTimeMap(trimRegions, videoDurationMs),
    [editingDocument, trimRegions, videoDurationMs],
  );

  if ('projectDurationMs' in timeMap) {
    const mapSourceToProjectOrNull = timeMap.mapSourceToProject;
    const mapSourceToEffectiveOrNull = timeMap.mapSourceToEffective;
    return {
      ...timeMap,
      mapSourceToProjectOrNull,
      mapSourceToEffectiveOrNull,
      // Timeline overlays historically require a total numeric projection. A
      // deleted source instant collapses to its nearest surviving boundary.
      mapSourceToProject: (timeMs: number) => mapSourceToProjectOrNull(timeMs) ?? nearestProjectBoundary(timeMap, timeMs),
      mapSourceToEffective: (timeMs: number) => mapSourceToEffectiveOrNull(timeMs)
        ?? timeMap.mapProjectToEffective(nearestProjectBoundary(timeMap, timeMs)),
    };
  }

  return {
    sourceDurationMs: videoDurationMs,
    projectDurationMs: timeMap.effectiveDurationMs,
    effectiveDurationMs: timeMap.effectiveDurationMs,
    mapSourceToProject: timeMap.mapSourceToEffective,
    mapProjectToSource: timeMap.mapEffectiveToSource,
    mapProjectToEffective: (timeMs: number) => timeMs,
    mapEffectiveToProject: (timeMs: number) => timeMs,
    mapSourceToEffective: timeMap.mapSourceToEffective,
    mapEffectiveToSource: timeMap.mapEffectiveToSource,
    rateAtProjectTime: () => 1,
  };
}

function nearestProjectBoundary(timeMap: ReturnType<typeof createMainTrackTimeMap>, sourceTimeMs: number) {
  let projectCursor = 0;
  let best = { distance: Number.POSITIVE_INFINITY, projectTimeMs: 0 };
  for (const clip of timeMap.clips) {
    for (const boundary of [clip.sourceStartMs, clip.sourceEndMs]) {
      const candidateProject = projectCursor + (boundary === clip.sourceEndMs ? clip.sourceEndMs - clip.sourceStartMs : 0);
      const distance = Math.abs(sourceTimeMs - boundary);
      if (distance < best.distance) best = { distance, projectTimeMs: candidateProject };
    }
    projectCursor += clip.sourceEndMs - clip.sourceStartMs;
  }
  return best.projectTimeMs;
}
