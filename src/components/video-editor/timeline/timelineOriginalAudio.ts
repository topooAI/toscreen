import type { AudioRegion } from "../types";

export function getAttachedOriginalAudio(audioRegions: AudioRegion[] = []) {
  return audioRegions.find((region) => region.isOriginal && !region.isDetached);
}

export function getStandaloneAudioRegions(audioRegions: AudioRegion[] = []) {
  return audioRegions.filter((region) => !region.isOriginal || region.isDetached);
}

export function buildAssociatedOriginalAudioForSourceRange(
  originalAudio: AudioRegion | undefined,
  sourceStartMs: number,
  sourceEndMs: number,
): AudioRegion | undefined {
  if (!originalAudio) return undefined;

  return {
    ...originalAudio,
    sourceStartMs,
    sourceEndMs,
  };
}
