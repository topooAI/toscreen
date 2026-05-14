import { Container, BlurFilter } from 'pixi.js';

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
  motionBlurEnabled?: boolean;
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
  motionBlurEnabled = true,
}: TransformParams) {
  if (
    stageSize.width <= 0 ||
    stageSize.height <= 0 ||
    baseMask.width <= 0 ||
    baseMask.height <= 0
  ) {
    return;
  }

  // The focus point relative to the actual video area
  const focusVideoPxX = focusX * baseMask.width;
  const focusVideoPxY = focusY * baseMask.height;
  
  // The focus point relative to the stage (before zoom)
  const focusStagePxX = baseMask.x + focusVideoPxX;
  const focusStagePxY = baseMask.y + focusVideoPxY;
  
  // Stage center (where we want the focus to end up after zoom)
  const stageCenterX = stageSize.width / 2;
  const stageCenterY = stageSize.height / 2;
 
  // Apply zoom scale to camera container
  cameraContainer.scale.set(zoomScale);
 
  // Calculate camera position to keep focus point centered
  // We offset the container so that focusStagePxX * zoomScale moves to stageCenterX
  const cameraX = stageCenterX - focusStagePxX * zoomScale;
  const cameraY = stageCenterY - focusStagePxY * zoomScale;
 
  cameraContainer.position.set(cameraX, cameraY);

  if (blurFilter) {
    const shouldBlur = motionBlurEnabled && isPlaying && motionIntensity > 0.0005;
    const motionBlur = shouldBlur ? Math.min(6, motionIntensity * 120) : 0;
    blurFilter.strength = motionBlur;
  }
}
