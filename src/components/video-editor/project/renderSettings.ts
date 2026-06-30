import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { ExportQuality } from "@/lib/exporter";
import type {
  AnnotationRegion,
  AudioRegion,
  CropRegion,
  CursorDataPoint,
  TrimRegion,
  ZoomRegion,
} from "../types";
import { restoreLegacyEditorStateFromProjectModel } from "./legacyAdapter";
import type { VideoEditorProject } from "./types";

export interface ProjectRenderSettings {
  durationMs: number;
  canvas: {
    aspectRatio: AspectRatio;
    wallpaper: string;
    showBlur: boolean;
    shadowIntensity: number;
    borderRadius: number;
    padding: number;
    cropRegion: CropRegion;
  };
  timeline: {
    zoomRegions: ZoomRegion[];
    trimRegions: TrimRegion[];
    annotationRegions: AnnotationRegion[];
    audioRegions: AudioRegion[];
  };
  cursor: {
    data: CursorDataPoint[];
    size: number;
    smoothing: boolean;
    showVectorCursor: boolean;
    offsetMs: number;
  };
  effects: {
    motionBlurEnabled: boolean;
  };
  exportSettings: {
    quality: ExportQuality;
  };
}

export function getProjectRenderSettings(project: VideoEditorProject): ProjectRenderSettings {
  const restored = restoreLegacyEditorStateFromProjectModel(project);

  return {
    durationMs: project.durationMs,
    canvas: {
      aspectRatio: restored.aspectRatio,
      wallpaper: restored.wallpaper,
      showBlur: restored.showBlur,
      shadowIntensity: restored.shadowIntensity,
      borderRadius: restored.borderRadius,
      padding: restored.padding,
      cropRegion: restored.cropRegion,
    },
    timeline: {
      zoomRegions: restored.zoomRegions,
      trimRegions: restored.trimRegions,
      annotationRegions: restored.annotationRegions,
      audioRegions: restored.audioRegions,
    },
    cursor: {
      data: restored.cursorData ?? [],
      size: restored.cursorSize ?? 1.5,
      smoothing: restored.cursorSmoothing ?? true,
      showVectorCursor: restored.showVectorCursor ?? true,
      offsetMs: restored.cursorOffset ?? -150,
    },
    effects: {
      motionBlurEnabled: restored.motionBlurEnabled ?? true,
    },
    exportSettings: {
      quality: restored.exportQuality,
    },
  };
}

export function resolveExportAudioRegions(
  renderSettingsAudioRegions: AudioRegion[],
  memoryAudioRegions: AudioRegion[],
): AudioRegion[] {
  return renderSettingsAudioRegions.map((region) => {
    const needsMemoryFile = !region.file && region.sourceUrl?.startsWith("blob:");
    if (!needsMemoryFile) return region;

    const memoryRegion = memoryAudioRegions.find((candidate) => (
      candidate.id === region.id ||
      candidate.sourceUrl === region.sourceUrl ||
      (!!candidate.path && candidate.path === region.path)
    ));

    if (!memoryRegion?.file) return region;

    return {
      ...region,
      file: memoryRegion.file,
    };
  });
}
