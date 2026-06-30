import type { ExportQuality } from "@/lib/exporter";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type {
  AnnotationRegion,
  AudioRegion,
  CropRegion,
  CursorDataPoint,
  TrimRegion,
  ZoomRegion,
} from "../types";
import type {
  ProjectAsset,
  ProjectClip,
  ProjectTrack,
  VideoEditorProject,
} from "./types";

const TRACK_IDS = {
  video: "track-video-main",
  camera: "track-camera-main",
  annotation: "track-annotation-main",
  audio: "track-audio-main",
  cursor: "track-cursor-main",
} as const;

export interface LegacyEditorProjectInput {
  projectId?: string;
  projectName?: string;
  videoPath: string | null;
  originalVideoPath: string | null;
  companionAudioPath?: string | null;
  durationSeconds: number;
  projectDurationSeconds: number;
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  annotationRegions: AnnotationRegion[];
  audioRegions: AudioRegion[];
  cursorData: CursorDataPoint[];
  cursorSize: number;
  cursorSmoothing: boolean;
  showVectorCursor: boolean;
  cursorOffset: number;
  cropRegion: CropRegion;
  wallpaper: string;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled: boolean;
  borderRadius: number;
  padding: number;
  aspectRatio: AspectRatio;
  exportQuality: ExportQuality;
  now?: Date;
}

export interface LegacyEditorRestoredState {
  companionAudioPath?: string | null;
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  annotationRegions: AnnotationRegion[];
  audioRegions: AudioRegion[];
  cropRegion: CropRegion;
  wallpaper: string;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius: number;
  padding: number;
  aspectRatio: AspectRatio;
  exportQuality: ExportQuality;
  cursorData?: CursorDataPoint[];
  cursorSize?: number;
  cursorSmoothing?: boolean;
  showVectorCursor?: boolean;
  cursorOffset?: number;
}

export function createProjectFromLegacyEditorState(input: LegacyEditorProjectInput): VideoEditorProject {
  const now = input.now ?? new Date();
  const updatedAt = now.toISOString();
  const sourceDurationMs = Math.max(0, Math.round(input.durationSeconds * 1000));
  const projectDurationMs = Math.max(
    sourceDurationMs,
    Math.round(input.projectDurationSeconds * 1000),
    ...input.zoomRegions.map((region) => region.endMs),
    ...input.trimRegions.map((region) => region.endMs),
    ...input.annotationRegions.map((region) => region.endMs),
    ...input.audioRegions.map((region) => region.endMs),
  );

  const projectId = input.projectId || stableId("project", input.originalVideoPath || input.videoPath || "unsaved");
  const screenAssetId = input.originalVideoPath
    ? stableId("asset-screen", input.originalVideoPath)
    : undefined;
  const proxyAssetId = input.videoPath && input.videoPath !== input.originalVideoPath
    ? stableId("asset-video-proxy", input.videoPath)
    : undefined;
  const companionAudioAssetId = input.companionAudioPath
    ? stableId("asset-audio-companion", input.companionAudioPath)
    : undefined;

  const assets: ProjectAsset[] = [];
  const addAsset = (asset: ProjectAsset | undefined) => {
    if (!asset || assets.some((existing) => existing.id === asset.id)) return;
    assets.push(asset);
  };

  addAsset(input.originalVideoPath && screenAssetId ? {
    id: screenAssetId,
    type: "screen-recording",
    name: fileNameFromPath(input.originalVideoPath) || "Screen Recording",
    sourceUrl: input.originalVideoPath,
    filePath: input.originalVideoPath,
    metadata: {
      durationMs: sourceDurationMs,
      proxyAssetId,
    },
  } : undefined);

  addAsset(input.videoPath && proxyAssetId ? {
    id: proxyAssetId,
    type: "video",
    name: fileNameFromPath(input.videoPath) || "Preview Proxy",
    sourceUrl: input.videoPath,
    filePath: input.videoPath,
    metadata: {
      role: "preview-proxy",
      originalAssetId: screenAssetId,
    },
  } : undefined);

  addAsset(input.companionAudioPath && companionAudioAssetId ? {
    id: companionAudioAssetId,
    type: "audio",
    name: fileNameFromPath(input.companionAudioPath) || "Recorded Audio",
    sourceUrl: input.companionAudioPath,
    filePath: input.companionAudioPath,
    metadata: {
      role: "companion-audio",
    },
  } : undefined);

  input.audioRegions.forEach((region) => {
    const source = region.path || region.sourceUrl;
    if (!source) return;
    addAsset({
      id: audioAssetId(region),
      type: "audio",
      name: region.name || fileNameFromPath(source) || "Audio",
      sourceUrl: region.sourceUrl || source,
      filePath: region.path,
      metadata: {
        isOriginal: Boolean(region.isOriginal),
        isDetached: Boolean(region.isDetached),
        totalDurationMs: region.totalDurationMs,
      },
    });
  });

  const tracks: ProjectTrack[] = [
    { id: TRACK_IDS.video, type: "video", name: "Video", order: 0 },
    { id: TRACK_IDS.camera, type: "camera", name: "Camera", order: 1 },
    { id: TRACK_IDS.annotation, type: "annotation", name: "Annotation", order: 2 },
    { id: TRACK_IDS.audio, type: "audio", name: "Audio", order: 3 },
    { id: TRACK_IDS.cursor, type: "cursor", name: "Cursor", order: 4 },
  ];

  const clips: ProjectClip[] = [];
  if (screenAssetId) {
    clips.push({
      id: stableId("clip-screen", input.originalVideoPath || input.videoPath || "screen"),
      type: "screen-recording",
      trackId: TRACK_IDS.video,
      assetId: screenAssetId,
      startMs: 0,
      endMs: sourceDurationMs,
      sourceStartMs: 0,
      sourceEndMs: sourceDurationMs,
      name: "Screen Recording",
      props: {
        crop: input.cropRegion,
        trimRegions: input.trimRegions,
        fitMode: "contain",
        freezeAfterEnd: true,
        companionAudioAssetId,
      },
      legacy: {
        source: "VideoEditor",
        regionType: "screen-recording",
      },
    });
  }

  input.zoomRegions.forEach((region) => {
    clips.push({
      id: stableId("clip-camera", region.id),
      type: "camera",
      trackId: TRACK_IDS.camera,
      startMs: region.startMs,
      endMs: region.endMs,
      name: `Zoom ${region.depth}`,
      props: {
        mode: "zoom",
        depth: region.depth,
        focus: region.focus,
        easing: input.motionBlurEnabled ? "smooth" : "linear",
        sourceRegion: region,
      },
      legacy: {
        source: "VideoEditor",
        regionId: region.id,
        regionType: "zoom",
      },
    });
  });

  input.annotationRegions.forEach((region) => {
    clips.push({
      id: stableId("clip-annotation", region.id),
      type: "annotation",
      trackId: TRACK_IDS.annotation,
      startMs: region.startMs,
      endMs: region.endMs,
      name: region.type,
      props: {
        sourceRegion: region,
      },
      legacy: {
        source: "VideoEditor",
        regionId: region.id,
        regionType: "annotation",
      },
    });
  });

  input.audioRegions.forEach((region) => {
    const { file: _file, ...serializableRegion } = region;
    clips.push({
      id: stableId("clip-audio", region.id),
      type: "audio",
      trackId: TRACK_IDS.audio,
      assetId: audioAssetId(region),
      startMs: region.startMs,
      endMs: region.endMs,
      sourceStartMs: region.sourceStartMs,
      sourceEndMs: region.sourceEndMs,
      name: region.name || "Audio",
      props: {
        sourceRegion: serializableRegion,
      },
      legacy: {
        source: "VideoEditor",
        regionId: region.id,
        regionType: "audio",
      },
    });
  });

  if (input.cursorData.length > 0) {
    const cursorAssetId = stableId("asset-cursor", input.originalVideoPath || input.videoPath || "cursor");
    addAsset({
      id: cursorAssetId,
      type: "cursor-data",
      name: "Cursor Data",
      sourceUrl: cursorAssetId,
      metadata: {
        points: input.cursorData.length,
      },
    });
    clips.push({
      id: stableId("clip-cursor", cursorAssetId),
      type: "cursor",
      trackId: TRACK_IDS.cursor,
      assetId: cursorAssetId,
      startMs: 0,
      endMs: projectDurationMs,
      name: "Cursor",
      props: {
        points: input.cursorData,
        size: input.cursorSize,
        smoothing: input.cursorSmoothing,
        vectorCursor: input.showVectorCursor,
        offsetMs: input.cursorOffset,
      },
      legacy: {
        source: "VideoEditor",
        regionType: "cursor",
      },
    });
  }

  return {
    id: projectId,
    schemaVersion: 1,
    name: input.projectName || fileNameFromPath(input.originalVideoPath || input.videoPath || "") || "Untitled Project",
    durationMs: projectDurationMs,
    createdAt: updatedAt,
    updatedAt,
    canvas: {
      aspectRatio: input.aspectRatio,
      background: {
        wallpaper: input.wallpaper,
        showBlur: input.showBlur,
      },
      padding: input.padding,
      borderRadius: input.borderRadius,
      shadow: {
        intensity: input.shadowIntensity,
      },
      cropRegion: input.cropRegion,
    },
    assets,
    tracks,
    clips,
    scenes: [],
    exportSettings: {
      quality: input.exportQuality,
    },
    legacyState: {
      trimRegions: input.trimRegions,
      motionBlurEnabled: input.motionBlurEnabled,
    },
  };
}

export function restoreLegacyEditorStateFromProjectModel(project: VideoEditorProject): LegacyEditorRestoredState {
  const screenClip = project.clips.find((clip) => clip.type === "screen-recording");
  const cursorClip = project.clips.find((clip) => clip.type === "cursor");
  const companionAudioPath = findCompanionAudioPath(project, screenClip);
  const legacyTrimRegions = Array.isArray(project.legacyState?.trimRegions)
    ? project.legacyState.trimRegions as TrimRegion[]
    : [];
  const legacyMotionBlurEnabled = typeof project.legacyState?.motionBlurEnabled === "boolean"
    ? project.legacyState.motionBlurEnabled
    : undefined;

  return {
    companionAudioPath,
    zoomRegions: project.clips.flatMap((clip): ZoomRegion[] => {
      if (clip.type !== "camera" || clip.props.mode !== "zoom") return [];
      if (clip.props.sourceRegion) return [clip.props.sourceRegion];
      if (!clip.props.depth || !clip.props.focus) return [];
      return [{
        id: clip.legacy?.regionId || clip.id,
        startMs: clip.startMs,
        endMs: clip.endMs,
        depth: clip.props.depth,
        focus: clip.props.focus,
      }];
    }),
    trimRegions: screenClip?.type === "screen-recording"
      ? screenClip.props.trimRegions || legacyTrimRegions
      : legacyTrimRegions,
    annotationRegions: project.clips.flatMap((clip): AnnotationRegion[] => (
      clip.type === "annotation" ? [clip.props.sourceRegion] : []
    )),
    audioRegions: project.clips.flatMap((clip): AudioRegion[] => {
      if (clip.type !== "audio") return [];
      return [restoreAudioSourceUrl(clip.props.sourceRegion)];
    }),
    cropRegion: project.canvas.cropRegion,
    wallpaper: project.canvas.background.wallpaper,
    shadowIntensity: project.canvas.shadow.intensity,
    showBlur: project.canvas.background.showBlur,
    motionBlurEnabled: legacyMotionBlurEnabled,
    borderRadius: project.canvas.borderRadius,
    padding: project.canvas.padding,
    aspectRatio: project.canvas.aspectRatio,
    exportQuality: project.exportSettings.quality,
    ...(cursorClip?.type === "cursor" ? {
      cursorData: cursorClip.props.points,
      cursorSize: cursorClip.props.size,
      cursorSmoothing: cursorClip.props.smoothing,
      showVectorCursor: cursorClip.props.vectorCursor,
      cursorOffset: cursorClip.props.offsetMs,
    } : {}),
  };
}

function audioAssetId(region: AudioRegion) {
  return stableId("asset-audio", region.path || region.sourceUrl || region.id);
}

function restoreAudioSourceUrl(region: Omit<AudioRegion, "file">): AudioRegion {
  return {
    ...region,
    sourceUrl: region.path ? `file://${region.path.replace(/\\/g, "/")}` : region.sourceUrl,
    isOriginal: region.isOriginal !== undefined ? region.isOriginal : true,
    isDetached: region.isDetached !== undefined ? region.isDetached : false,
  };
}

function findCompanionAudioPath(
  project: VideoEditorProject,
  screenClip: ProjectClip | undefined,
): string | null {
  const companionAudioAssetId = screenClip?.type === "screen-recording"
    ? screenClip.props.companionAudioAssetId
    : undefined;
  const companionAsset = companionAudioAssetId
    ? project.assets.find((asset) => asset.id === companionAudioAssetId)
    : project.assets.find((asset) => asset.type === "audio" && asset.metadata?.role === "companion-audio");

  if (companionAsset) {
    return companionAsset.filePath || companionAsset.sourceUrl || null;
  }

  const originalAudioClip = project.clips.find((clip) => (
    clip.type === "audio" &&
    clip.props.sourceRegion?.isOriginal &&
    !clip.props.sourceRegion?.isDetached
  ));

  if (originalAudioClip?.type === "audio") {
    return originalAudioClip.props.sourceRegion.path || originalAudioClip.props.sourceRegion.sourceUrl || null;
  }

  return null;
}

function fileNameFromPath(path: string) {
  if (!path) return "";
  const normalized = path.split("?")[0].replace(/\\/g, "/");
  return decodeURIComponent(normalized.split("/").filter(Boolean).pop() || "");
}

function stableId(prefix: string, value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}
