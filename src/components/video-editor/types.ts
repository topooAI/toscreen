export {
  CURSOR_STYLE_PRESETS,
  DEFAULT_CURSOR_STYLE,
  isCursorStylePreset,
  resolveCursorStyle,
} from '../../../shared/cursorStyles';
export type { CursorStylePreset } from '../../../shared/cursorStyles';
export type { CursorCustomImageMap, CursorCustomState } from '../../../shared/cursorStyles';
export { CURSOR_CUSTOMIZABLE_STATES } from '../../../shared/cursorStyles';

export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZoomFocus {
  cx: number; // normalized horizontal center (0-1)
  cy: number; // normalized vertical center (0-1)
}

export interface ZoomRegion {
  id: string;
  startMs: number;
  endMs: number;
  depth: ZoomDepth;
  focus: ZoomFocus;
  focusMode?: 'manual' | 'auto';
  source?: 'manual' | 'auto';
  clicks?: any[]; // Raw mouse path data for dynamic tracking
  /** Camera Motion clips share the legacy timed-region persistence path while
   * rendering on their own Camera lane. Focus sampling ignores these clips. */
  kind?: 'focus' | 'camera';
  cameraMotion?: CameraMotionPreset;
}

export interface CameraMotionTransform {
  scale: number;
  translateX: number; // normalized stage width
  translateY: number; // normalized stage height
  rotateZ: number; // degrees
  skewX: number; // degrees; lightweight perspective approximation
  skewY: number; // degrees; lightweight perspective approximation
  blur: number;
}

export interface CameraMotionPreset {
  id: 'product-oblique-push' | 'custom';
  name: string;
  from: CameraMotionTransform;
  to: CameraMotionTransform;
  easing: 'smooth' | 'linear';
}

export interface CursorDataPoint {
  timestamp: number;
  absoluteTime?: number;
  x: number; 
  y: number; 
  cx: number;
  cy: number;
  isClick?: boolean;
  isPointerDown?: boolean;
  type?: 'click' | 'mousedown' | 'mouseup' | 'drag' | 'move' | 'keydown' | 'wheel';
  cursorType?: string;
}

export interface TrimRegion {
  id: string;
  startMs: number;
  endMs: number;
}

export interface VolumeKeyframe {
  id: string;
  timeRatio: number; // 0.0 to 1.0 (relative to clip duration)
  volume: number;    // 0.0 to 2.0 (200%)
}

export interface AudioRegion {
  id: string;
  startMs: number;
  endMs: number;
  sourceUrl: string;    // The original audio file URL (e.g. file://... or blob://...)
  file?: File;          // The underlying File object to avoid fetch blob CSP issues
  audioPeaks?: number[];
  audioPeaksDurationMs?: number;
  path?: string;
  sourceStartMs?: number; // Start offset within the audio file itself (for trimming)
  sourceEndMs?: number;   // End offset within the audio file itself (for trimming)
  totalDurationMs?: number; // Total duration of the audio file
  volume: number;       // Volume multiplier (0.0 to 1.0+)
  isMuted?: boolean;
  name?: string;        // Added file name
  volumeKeyframes?: VolumeKeyframe[]; // Volume envelope keyframes
  isOriginal?: boolean; // True if this is the original recorded companion audio
  isDetached?: boolean; // True if separated from video into independent track
  trackIndex?: number;  // The physical track row this audio region belongs to
}

export type AnnotationType = 'text' | 'image' | 'figure';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'up-right' | 'up-left' | 'down-right' | 'down-left';

export interface FigureData {
  arrowDirection: ArrowDirection;
  color: string;
  strokeWidth: number;
}

export interface AnnotationPosition {
  x: number;
  y: number;
}

export interface AnnotationSize {
  width: number;
  height: number;
}

export interface AnnotationTextStyle {
  color: string;
  backgroundColor: string;
  fontSize: number; // pixels
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
}

export interface AnnotationRegion {
  id: string;
  startMs: number;
  endMs: number;
  type: AnnotationType;
  content: string; // Legacy - still used for current type
  textContent?: string; // Separate storage for text
  imageContent?: string; // Separate storage for image data URL
  position: AnnotationPosition;
  size: AnnotationSize;
  style: AnnotationTextStyle;
  zIndex: number;
  figureData?: FigureData;
}

export const DEFAULT_ANNOTATION_POSITION: AnnotationPosition = {
  x: 50,
  y: 50,
};

export const DEFAULT_ANNOTATION_SIZE: AnnotationSize = {
  width: 30,
  height: 20,
};

export const DEFAULT_ANNOTATION_STYLE: AnnotationTextStyle = {
  color: '#ffffff',
  backgroundColor: 'transparent',
  fontSize: 32,
  fontFamily: 'Inter',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'center',
};

export const DEFAULT_FIGURE_DATA: FigureData = {
  arrowDirection: 'right',
  color: '#34B27B',
  strokeWidth: 4,
};



export interface CropRegion {
  x: number; 
  y: number; 
  width: number; 
  height: number; 
}

export const DEFAULT_CROP_REGION: CropRegion = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
  1: 1.25,
  2: 1.5,
  3: 2.0,
  4: 2.5,
  5: 3.5,
  6: 5.0,
};

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
  return {
    cx: clamp(focus.cx, 0, 1),
    cy: clamp(focus.cy, 0, 1),
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
