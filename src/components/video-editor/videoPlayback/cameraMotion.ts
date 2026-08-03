import type { CameraMotionPreset, CameraMotionTransform, ZoomRegion } from '../types';

export const IDENTITY_CAMERA_TRANSFORM: CameraMotionTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  rotateZ: 0,
  skewX: 0,
  skewY: 0,
  blur: 0,
};

export const PRODUCT_OBLIQUE_PUSH_PRESET: CameraMotionPreset = {
  id: 'product-oblique-push',
  name: 'Product Oblique Push',
  from: {
    scale: 0.96,
    translateX: 0.035,
    translateY: 0.025,
    rotateZ: -4.8,
    skewX: -2.4,
    skewY: 1.2,
    blur: 1.8,
  },
  to: {
    scale: 1.12,
    translateX: -0.035,
    translateY: -0.018,
    rotateZ: -3.2,
    skewX: -1.4,
    skewY: 0.7,
    blur: 0.2,
  },
  easing: 'smooth',
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

export function createProductCameraRegion(startMs: number, endMs: number): ZoomRegion {
  return {
    id: `camera-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startMs,
    endMs,
    depth: 1,
    focus: { cx: 0.5, cy: 0.5 },
    focusMode: 'manual',
    source: 'manual',
    kind: 'camera',
    cameraMotion: PRODUCT_OBLIQUE_PUSH_PRESET,
  };
}

export function sampleCameraMotion(regions: readonly ZoomRegion[], timeMs: number): CameraMotionTransform {
  const region = regions
    .filter((candidate) => candidate.kind === 'camera' && candidate.cameraMotion && candidate.endMs > candidate.startMs)
    .find((candidate) => timeMs >= candidate.startMs && timeMs <= candidate.endMs);
  if (!region?.cameraMotion) return IDENTITY_CAMERA_TRANSFORM;

  const rawProgress = clamp01((timeMs - region.startMs) / (region.endMs - region.startMs));
  const progress = region.cameraMotion.easing === 'linear' ? rawProgress : smoothstep(rawProgress);
  const from = region.cameraMotion.from;
  const to = region.cameraMotion.to;
  return {
    scale: lerp(from.scale, to.scale, progress),
    translateX: lerp(from.translateX, to.translateX, progress),
    translateY: lerp(from.translateY, to.translateY, progress),
    rotateZ: lerp(from.rotateZ, to.rotateZ, progress),
    skewX: lerp(from.skewX, to.skewX, progress),
    skewY: lerp(from.skewY, to.skewY, progress),
    blur: lerp(from.blur, to.blur, progress),
  };
}
