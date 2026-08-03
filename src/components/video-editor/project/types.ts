import type {
  AnnotationRegion,
  AudioRegion,
  CropRegion,
  CursorDataPoint,
  CursorStylePreset,
  TrimRegion,
  ZoomDepth,
  ZoomFocus,
  ZoomRegion,
} from "../types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { ExportQuality } from "@/lib/exporter";

export type ProjectSchemaVersion = 1;

export type AssetType =
  | "screen-recording"
  | "video"
  | "audio"
  | "image"
  | "lottie"
  | "digital-human"
  | "ui-source"
  | "cursor-data"
  | "font";

export type TrackType =
  | "video"
  | "camera"
  | "presenter"
  | "text"
  | "annotation"
  | "lottie"
  | "image"
  | "ui-motion"
  | "audio"
  | "voice"
  | "music"
  | "cursor";

export type ClipType =
  | "screen-recording"
  | "video"
  | "audio"
  | "camera"
  | "presenter"
  | "text"
  | "annotation"
  | "lottie"
  | "image"
  | "ui-element-motion"
  | "cursor";

export interface ProjectAsset {
  id: string;
  type: AssetType;
  name: string;
  sourceUrl: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectTrack {
  id: string;
  type: TrackType;
  name: string;
  order: number;
  parentId?: string;
  locked?: boolean;
  muted?: boolean;
  hidden?: boolean;
}

export interface BaseProjectClip<TType extends ClipType, TProps> {
  id: string;
  type: TType;
  trackId: string;
  assetId?: string;
  startMs: number;
  endMs: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  name?: string;
  props: TProps;
  legacy?: {
    source: "VideoEditor";
    regionId?: string;
    regionType?: "zoom" | "trim" | "annotation" | "audio" | "screen-recording" | "cursor";
  };
}

export interface ScreenRecordingClipProps {
  crop?: CropRegion;
  trimRegions?: TrimRegion[];
  fitMode: "contain" | "cover" | "fill";
  freezeAfterEnd?: boolean;
  showBlackAfterEnd?: boolean;
  companionAudioAssetId?: string;
}

export interface CameraClipProps {
  mode: "zoom" | "pan" | "focus" | "three-d";
  depth?: ZoomDepth;
  focus?: ZoomFocus;
  easing?: "linear" | "smooth" | "spring" | "catmull-rom";
  sourceRegion?: ZoomRegion;
  threeD?: {
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    translateZ: number;
    perspective: number;
    depthOfField?: number;
  };
}

export interface PresenterClipProps {
  sourceKind: "camera" | "digital-human" | "video-file" | "generated-avatar";
  layout: "picture-in-picture" | "corner" | "split-screen" | "full-frame" | "cutaway";
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    borderRadius?: number;
  };
  backgroundRemoval?: boolean;
  eyeContactCorrection?: boolean;
  voiceSync?: {
    audioAssetId?: string;
    transcriptId?: string;
  };
}

export interface AnnotationClipProps {
  sourceRegion: AnnotationRegion;
}

export interface AudioClipProps {
  sourceRegion: Omit<AudioRegion, "file">;
}

export interface CursorClipProps {
  points: CursorDataPoint[];
  size: number;
  smoothing: boolean;
  vectorCursor: boolean;
  style?: CursorStylePreset;
  customImage?: string;
  customImages?: import("../types").CursorCustomImageMap;
  offsetMs: number;
}

export interface LottieClipProps {
  playback: {
    loop: boolean;
    speed: number;
    direction: 1 | -1;
  };
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    opacity: number;
  };
  colorOverrides?: Record<string, string>;
  enterPreset?: string;
  exitPreset?: string;
}

export type UISourceProvider =
  | "figma"
  | "dom-snapshot"
  | "screenshot"
  | "design-file"
  | "manual";

export interface UIElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProjectUIElement {
  id: string;
  name?: string;
  role?: "frame" | "component" | "text" | "button" | "input" | "image" | "icon" | "custom";
  stableSelector?: string;
  bounds?: UIElementBounds;
  metadata?: Record<string, unknown>;
}

export interface ProjectUISource {
  id: string;
  name: string;
  provider: UISourceProvider;
  sourceUrl?: string;
  filePath?: string;
  capturedAt?: string;
  elements: ProjectUIElement[];
  metadata?: Record<string, unknown>;
}

export interface UIElementMotionClipProps {
  uiSourceId: string;
  elementId: string;
  action: "highlight" | "move" | "scale" | "fade" | "morph" | "click" | "scroll" | "custom";
  from?: Partial<UIElementBounds> & {
    opacity?: number;
    rotation?: number;
  };
  to?: Partial<UIElementBounds> & {
    opacity?: number;
    rotation?: number;
  };
  easing?: "linear" | "smooth" | "spring" | "catmull-rom";
  generatedFrom?: {
    recordingEventId?: string;
    aiPlanStepId?: string;
  };
}

export interface AIEditPlanStep {
  id: string;
  type:
    | "cut"
    | "trim"
    | "camera"
    | "caption"
    | "annotation"
    | "lottie"
    | "ui-motion"
    | "audio"
    | "layout"
    | "custom";
  target?: {
    clipIds?: string[];
    trackIds?: string[];
    sceneIds?: string[];
    timeRangeMs?: {
      startMs: number;
      endMs: number;
    };
  };
  params?: Record<string, unknown>;
  rationale?: string;
  status: "draft" | "accepted" | "rejected" | "applied";
}

export interface AIEditPlan {
  id: string;
  createdAt: string;
  goal: string;
  summary?: string;
  status: "draft" | "reviewed" | "applied" | "rejected";
  steps: AIEditPlanStep[];
}

export type ProjectClip =
  | BaseProjectClip<"screen-recording", ScreenRecordingClipProps>
  | BaseProjectClip<"camera", CameraClipProps>
  | BaseProjectClip<"presenter", PresenterClipProps>
  | BaseProjectClip<"annotation", AnnotationClipProps>
  | BaseProjectClip<"audio", AudioClipProps>
  | BaseProjectClip<"cursor", CursorClipProps>
  | BaseProjectClip<"lottie", LottieClipProps>
  | BaseProjectClip<"ui-element-motion", UIElementMotionClipProps>
  | BaseProjectClip<"video" | "image" | "text", Record<string, unknown>>;

export interface ProjectCanvasSettings {
  aspectRatio: AspectRatio;
  background: {
    wallpaper: string;
    showBlur: boolean;
  };
  padding: number;
  borderRadius: number;
  shadow: {
    intensity: number;
  };
  cropRegion: CropRegion;
}

export interface ProjectExportSettings {
  quality: ExportQuality;
}

export interface ProjectScene {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
  purpose: "hook" | "problem" | "demo" | "feature" | "result" | "cta" | "custom";
  clipIds: string[];
  aiSummary?: string;
}

export interface VideoEditorProject {
  id: string;
  schemaVersion: ProjectSchemaVersion;
  name: string;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
  canvas: ProjectCanvasSettings;
  assets: ProjectAsset[];
  uiSources?: ProjectUISource[];
  tracks: ProjectTrack[];
  clips: ProjectClip[];
  scenes: ProjectScene[];
  aiEditPlans?: AIEditPlan[];
  activeAIEditPlanId?: string;
  exportSettings: ProjectExportSettings;
  legacyState?: Record<string, unknown>;
}
