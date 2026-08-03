import { Container, BlurFilter } from 'pixi.js';
import type { CameraMotionTransform } from '../types';
import { IDENTITY_CAMERA_TRANSFORM } from './cameraMotion';

/**
 * Configuration for visual effects and filters.
 * This acts as a 'Registry' for all rendering-time effects.
 */
export interface EffectConfig {
  motionBlurEnabled?: boolean;
  // Future effects can be added here (e.g., colorFilters, noise, etc.)
}

interface TransformParams {
  cameraContainer: Container;
  blurFilter: BlurFilter | null;
  stageSize: { width: number; height: number };
  baseMask: { x: number; y: number; width: number; height: number };
  zoomScale: number;
  focusX: number;
  focusY: number;
  motionIntensity: number;
  isPlaying: boolean;
  effects?: EffectConfig; // New registry-style config
  motionBlurEnabled?: boolean; // Legacy support
  cameraMotion?: CameraMotionTransform;
}

export function applyZoomTransform({
  cameraContainer,
  blurFilter,
  stageSize,
  baseMask,
  zoomScale,
  focusX,
  focusY,
  motionIntensity,
  isPlaying,
  effects = {},
  motionBlurEnabled = true, // Default legacy support
  cameraMotion = IDENTITY_CAMERA_TRANSFORM,
}: TransformParams) {
  // Use effects config if present, otherwise fallback to legacy props
  const isMotionBlurActive = effects.motionBlurEnabled ?? motionBlurEnabled;

  if (
    stageSize.width <= 0 ||
    stageSize.height <= 0 ||
    baseMask.width <= 0 ||
    baseMask.height <= 0
  ) {
    return;
  }

  // focusX and focusY are already normalized STAGE coordinates (0-1),
  // properly computed via videoFocusToStage and clampFocusToStage.
  // We simply map them directly to absolute stage pixels.
  const focusStagePxX = focusX * stageSize.width;
  const focusStagePxY = focusY * stageSize.height;
  
  // Stage center (where we want the focus to end up after zoom)
  const stageCenterX = stageSize.width / 2;
  const stageCenterY = stageSize.height / 2;
 
  const totalScale = zoomScale * cameraMotion.scale;
  cameraContainer.scale.set(totalScale);
  cameraContainer.rotation = cameraMotion.rotateZ * Math.PI / 180;
  cameraContainer.skew.set(
    cameraMotion.skewX * Math.PI / 180,
    cameraMotion.skewY * Math.PI / 180,
  );
  cameraContainer.pivot.set(stageCenterX, stageCenterY);
 
  // Calculate camera position to keep focus point centered
  // We offset the container so that focusStagePxX * zoomScale moves to stageCenterX
  const cameraX = stageCenterX - focusStagePxX * totalScale;
  const cameraY = stageCenterY - focusStagePxY * totalScale;
 
  cameraContainer.position.set(
    cameraX + stageCenterX * totalScale + cameraMotion.translateX * stageSize.width,
    cameraY + stageCenterY * totalScale + cameraMotion.translateY * stageSize.height,
  );

  // Apply Filters from the 'Registry' logic
  if (blurFilter) {
    const shouldBlur = isMotionBlurActive && isPlaying && motionIntensity > 0.0005;
    const motionBlur = shouldBlur ? Math.min(6, motionIntensity * 120) : 0;
    // Fix: Using modern '.strength' property instead of deprecated '.blur'
    blurFilter.strength = Math.max(motionBlur, cameraMotion.blur);
  }
}
