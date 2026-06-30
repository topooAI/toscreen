import type { TrimRegion } from "@/components/video-editor/types";

export interface ExportDurationInput {
  sourceDurationSeconds: number;
  trimRegions?: TrimRegion[];
  projectDurationMs?: number;
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
