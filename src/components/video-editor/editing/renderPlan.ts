import { createMainTrackTimeMap } from './timeMap';
import type { EditingDocument } from './types';

export interface RenderSample {
  effectiveTimeMs: number;
  projectTimeMs: number;
  sourceTimeMs: number;
  playbackRate: number;
}

/** One clock contract shared by Preview frame seeking, Export frame sampling,
 * and original-audio resampling. Consumers must advance effective time and use
 * the returned source time/rate instead of maintaining a second trim clock. */
export function createEditingRenderPlan(document: EditingDocument, sourceDurationMs: number) {
  const timeMap = createMainTrackTimeMap(document, sourceDurationMs);
  const sample = (effectiveTimeMs: number): RenderSample => {
    const projectTimeMs = timeMap.mapEffectiveToProject(effectiveTimeMs);
    return {
      effectiveTimeMs: Math.max(0, Math.min(effectiveTimeMs, timeMap.effectiveDurationMs)),
      projectTimeMs,
      sourceTimeMs: timeMap.mapProjectToSource(projectTimeMs),
      playbackRate: timeMap.rateAtProjectTime(projectTimeMs),
    };
  };
  return {
    durationMs: timeMap.effectiveDurationMs,
    previewSample: sample,
    exportSample: sample,
    audioSample: sample,
    timeMap,
  };
}
