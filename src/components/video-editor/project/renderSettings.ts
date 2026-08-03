import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { ExportQuality } from "@/lib/exporter";
import type {
  AnnotationRegion,
  AudioRegion,
  CropRegion,
  CursorDataPoint,
  CursorCustomImageMap,
  CursorStylePreset,
  TrimRegion,
  ZoomRegion,
} from "../types";
import { resolveCursorStyle } from "../types";
import { restoreLegacyEditorStateFromProjectModel } from "./legacyAdapter";
import type { VideoEditorProject } from "./types";
import type { EditingDocument } from "../editing";
import type { PresentationEffectRegion } from "../presentation/types";

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
    editingDocument: EditingDocument;
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
    style: CursorStylePreset;
    customImage: string | null;
    customImages: CursorCustomImageMap;
    offsetMs: number;
  };
  effects: {
    motionBlurEnabled: boolean;
    presentation: PresentationEffectRegion[];
    autoFocusEnabled: boolean;
  };
  exportSettings: {
    quality: ExportQuality;
  };
}

export interface ProjectAutosaveSnapshot {
  editingDocument: EditingDocument;
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  annotationRegions: AnnotationRegion[];
  audioRegions: AudioRegion[];
  projectModel: VideoEditorProject;
  cropRegion: CropRegion;
  wallpaper: string;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled: boolean;
  borderRadius: number;
  padding: number;
  aspectRatio: AspectRatio;
  exportQuality: ExportQuality;
  cursorData: CursorDataPoint[];
  cursorSize: number;
  cursorSmoothing: boolean;
  showVectorCursor: boolean;
  cursorStyle: CursorStylePreset;
  cursorCustomImage: string | null;
  cursorCustomImages: CursorCustomImageMap;
  cursorOffset: number;
  presentationEffects: PresentationEffectRegion[];
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
      editingDocument: restored.editingDocument,
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
      style: resolveCursorStyle(restored.cursorStyle, restored.showVectorCursor ?? true),
      customImage: restored.cursorCustomImage ?? null,
      customImages: restored.cursorCustomImages
        ?? (restored.cursorCustomImage ? { default: restored.cursorCustomImage } : {}),
      offsetMs: restored.cursorOffset ?? 0,
    },
    effects: {
      motionBlurEnabled: restored.motionBlurEnabled ?? true,
      presentation: restored.presentationEffects ?? [],
      autoFocusEnabled: restored.autoFocusEnabled ?? true,
    },
    exportSettings: {
      quality: restored.exportQuality,
    },
  };
}

export function createProjectAutosaveSnapshot(
  project: VideoEditorProject,
  memoryAudioRegions: AudioRegion[] = [],
): ProjectAutosaveSnapshot {
  const renderSettings = getProjectRenderSettings(project);
  const runtimeAudioRegions = resolveRuntimeAudioRegions(
    renderSettings.timeline.audioRegions,
    memoryAudioRegions,
  );

  return {
    editingDocument: renderSettings.timeline.editingDocument,
    zoomRegions: renderSettings.timeline.zoomRegions,
    trimRegions: renderSettings.timeline.trimRegions,
    annotationRegions: renderSettings.timeline.annotationRegions,
    audioRegions: serializeRuntimeAudioRegions(runtimeAudioRegions),
    projectModel: project,
    cropRegion: renderSettings.canvas.cropRegion,
    wallpaper: renderSettings.canvas.wallpaper,
    shadowIntensity: renderSettings.canvas.shadowIntensity,
    showBlur: renderSettings.canvas.showBlur,
    motionBlurEnabled: renderSettings.effects.motionBlurEnabled,
    borderRadius: renderSettings.canvas.borderRadius,
    padding: renderSettings.canvas.padding,
    aspectRatio: renderSettings.canvas.aspectRatio,
    exportQuality: renderSettings.exportSettings.quality,
    cursorData: renderSettings.cursor.data,
    cursorSize: renderSettings.cursor.size,
    cursorSmoothing: renderSettings.cursor.smoothing,
    showVectorCursor: renderSettings.cursor.showVectorCursor,
    cursorStyle: renderSettings.cursor.style,
    cursorCustomImage: renderSettings.cursor.customImage,
    cursorCustomImages: renderSettings.cursor.customImages,
    cursorOffset: renderSettings.cursor.offsetMs,
    presentationEffects: renderSettings.effects.presentation,
  };
}

export function resolveRuntimeAudioRegions(
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

export function resolveExportAudioRegions(
  renderSettingsAudioRegions: AudioRegion[],
  memoryAudioRegions: AudioRegion[],
): AudioRegion[] {
  return resolveRuntimeAudioRegions(renderSettingsAudioRegions, memoryAudioRegions);
}

function serializeRuntimeAudioRegions(audioRegions: AudioRegion[]): AudioRegion[] {
  return audioRegions.map((region) => {
    const { file: _file, ...serializable } = region;
    return serializable;
  });
}
