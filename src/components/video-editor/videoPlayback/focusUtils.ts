import { ZOOM_DEPTH_SCALES, clampFocusToDepth, type ZoomFocus, type ZoomDepth } from "../types";

interface StageSize {
  width: number;
  height: number;
}

export function clampFocusToStage(
  focus: ZoomFocus,
  depth: ZoomDepth,
  stageSize: StageSize,
  isFullScreenBinding: boolean = true,
  videoSize?: { width: number; height: number },
  baseScale?: number,
  baseOffset?: { x: number; y: number }
): ZoomFocus {
  if (!stageSize.width || !stageSize.height) {
    return clampFocusToDepth(focus, depth);
  }

  const zoomScale = ZOOM_DEPTH_SCALES[depth];
  const halfWinW = (1 / zoomScale) / 2;
  const halfWinH = (1 / zoomScale) / 2;
  
  let minX = 0;
  let maxX = 1;
  let minY = 0;
  let maxY = 1;

  if (isFullScreenBinding && videoSize && baseScale !== undefined && baseOffset) {
    // FULL SCREEN: Clamp to VIDEO boundaries on stage
    // Calculate video edges in normalized stage units (0-1)
    const videoLeft = baseOffset.x / stageSize.width;
    const videoRight = (baseOffset.x + videoSize.width * baseScale) / stageSize.width;
    const videoTop = baseOffset.y / stageSize.height;
    const videoBottom = (baseOffset.y + videoSize.height * baseScale) / stageSize.height;

    minX = videoLeft + halfWinW;
    maxX = videoRight - halfWinW;
    minY = videoTop + halfWinH;
    maxY = videoBottom - halfWinH;

    // Handle case where video is smaller than window (unlikely but safe)
    if (minX > maxX) { minX = maxX = (videoLeft + videoRight) / 2; }
    if (minY > maxY) { minY = maxY = (videoTop + videoBottom) / 2; }
  } else if (!isFullScreenBinding) {
    // CENTER / GOLDEN RATIO: Keep subject 25% away from edges
    minX = 0.25;
    maxX = 0.75;
    minY = 0.25;
    maxY = 0.75;
  } else {
    // Fallback: Clamp to stage boundaries
    minX = halfWinW;
    maxX = 1 - halfWinW;
    minY = halfWinH;
    maxY = 1 - halfWinH;
  }
 
  const baseFocus = clampFocusToDepth(focus, depth);
 
  return {
    cx: Math.max(minX, Math.min(maxX, baseFocus.cx)),
    cy: Math.max(minY, Math.min(maxY, baseFocus.cy)),
  };
}

export function videoFocusToStage(
  focus: ZoomFocus,
  stageSize: StageSize,
  videoSize: { width: number; height: number },
  baseScale: number,
  baseOffset: { x: number; y: number }
): ZoomFocus {
  if (!stageSize.width || !stageSize.height || !videoSize.width || !videoSize.height || baseScale <= 0) {
    return focus;
  }

  // Calculate absolute position on stage
  const stageX = baseOffset.x + (focus.cx * videoSize.width * baseScale);
  const stageY = baseOffset.y + (focus.cy * videoSize.height * baseScale);

  // Convert back to normalized stage coordinates (0-1)
  return {
    cx: stageX / stageSize.width,
    cy: stageY / stageSize.height,
  };
}
