import type { TrimRegion } from "@/components/video-editor/types";

export interface ExportDurationInput {
  sourceDurationSeconds: number;
  trimRegions?: TrimRegion[];
  projectDurationMs?: number;
}

export interface EditingExportDurationInput {
  mainTrackDurationMs: number;
  projectDurationMs?: number;
}

export function resolveEditingExportDurations(input: EditingExportDurationInput) {
  const mainTrackDurationSeconds = safeMs(input.mainTrackDurationMs) / 1000;
  const projectDurationSeconds = Math.max(
    mainTrackDurationSeconds,
    safeMs(input.projectDurationMs) / 1000,
  );
  return { mainTrackDurationSeconds, projectDurationSeconds };
}

export function shouldRenderMainTrackFrame(frameIndex: number, frameRate: number, mainTrackDurationMs: number) {
  if (!Number.isFinite(frameIndex) || !Number.isFinite(frameRate) || frameRate <= 0) return false;
  return frameIndex < Math.floor((safeMs(mainTrackDurationMs) / 1000) * frameRate);
}

export function resolveExportDurationSeconds(input: ExportDurationInput): number {
  const sourceDurationSeconds = safeSeconds(input.sourceDurationSeconds);
  const projectDurationSeconds = safeMs(input.projectDurationMs) / 1000;
  const trimmedSourceDurationSeconds = calculateTrimmedSourceDurationSeconds(
    sourceDurationSeconds,
    input.trimRegions ?? [],
  );

  if (projectDurationSeconds > sourceDurationSeconds) {
    return projectDurationSeconds;
  }

  return trimmedSourceDurationSeconds;
}

export function calculateTrimmedSourceDurationSeconds(
  sourceDurationSeconds: number,
  trimRegions: TrimRegion[],
): number {
  const sourceDurationMs = Math.round(safeSeconds(sourceDurationSeconds) * 1000);
  const totalTrimMs = trimRegions.reduce((sum, region) => {
    const startMs = clampMs(region.startMs, 0, sourceDurationMs);
    const endMs = clampMs(region.endMs, startMs, sourceDurationMs);
    return sum + Math.max(0, endMs - startMs);
  }, 0);

  return Math.max(0, sourceDurationMs - totalTrimMs) / 1000;
}

function safeSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safeMs(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value as number) : 0;
}

function clampMs(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
