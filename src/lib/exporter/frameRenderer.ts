import { Application, Container, Sprite, Graphics, BlurFilter, Texture } from 'pixi.js';
import type { ZoomRegion, CropRegion, AnnotationRegion } from '@/components/video-editor/types';
import { ZOOM_DEPTH_SCALES } from '@/components/video-editor/types';
import { findInterpolatedTarget, interpolateZoomScale } from '@/components/video-editor/videoPlayback/zoomRegionUtils';
import { applyZoomTransform } from '@/components/video-editor/videoPlayback/zoomTransform';
import { DEFAULT_FOCUS, SMOOTHING_FACTOR, MIN_DELTA } from '@/components/video-editor/videoPlayback/constants';
import { clampFocusToStage as clampFocusToStageUtil, videoFocusToStage } from '@/components/video-editor/videoPlayback/focusUtils';
import { renderAnnotations } from './annotationRenderer';

interface FrameRenderConfig {
  width: number;
  height: number;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  showShadow: boolean;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius?: number;
  padding?: number;
  cropRegion: CropRegion;
  videoWidth: number;
  videoHeight: number;
  annotationRegions?: AnnotationRegion[];
  previewWidth?: number;
  previewHeight?: number;
  cursorData?: any[];
  cursorSize?: number;
  cursorSmoothing?: boolean;
  showVectorCursor?: boolean;
  cursorOffset?: number;
}

interface AnimationState {
  scale: number;
  focusX: number;
  focusY: number;
}

type CanvasBackgroundFill = string | CanvasGradient;

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function isColorStopCandidate(value: string): boolean {
  return /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|[a-zA-Z]+)/.test(value.trim())
    && !/^(to\s+|circle\b|ellipse\b|closest-|farthest-|at\s+)/.test(value.trim());
}

function parseColorStop(value: string, fallbackOffset: number) {
  const trimmed = value.trim();
  const percentMatch = trimmed.match(/^(.*)\s+(-?\d+(?:\.\d+)?)%\s*$/);
  if (!percentMatch) {
    return {
      color: trimmed,
      offset: fallbackOffset,
    };
  }

  return {
    color: percentMatch[1].trim(),
    offset: Math.min(1, Math.max(0, Number(percentMatch[2]) / 100)),
  };
}

function parseGradientStops(parts: string[]) {
  const candidates = parts.filter(isColorStopCandidate);
  return candidates.map((part, index) => {
    const fallbackOffset = candidates.length <= 1 ? 0 : index / (candidates.length - 1);
    return parseColorStop(part, fallbackOffset);
  });
}

function linearDirectionToVector(direction: string | undefined) {
  const normalized = direction?.trim().toLowerCase();
  if (!normalized) {
    return { x: 0, y: 1 };
  }

  if (normalized.endsWith("deg")) {
    const degrees = Number(normalized.replace("deg", "").trim());
    if (Number.isFinite(degrees)) {
      const radians = degrees * Math.PI / 180;
      return {
        x: Math.sin(radians),
        y: -Math.cos(radians),
      };
    }
  }

  if (normalized.startsWith("to ")) {
    const x = normalized.includes("right") ? 1 : normalized.includes("left") ? -1 : 0;
    const y = normalized.includes("bottom") ? 1 : normalized.includes("top") ? -1 : 0;
    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    }
  }

  return { x: 0, y: 1 };
}

function createLinearGradientFill(
  ctx: CanvasRenderingContext2D,
  parts: string[],
  width: number,
  height: number,
): CanvasGradient | null {
  const firstPart = parts[0]?.trim().toLowerCase();
  const direction = firstPart && (firstPart.startsWith("to ") || firstPart.endsWith("deg"))
    ? firstPart
    : undefined;
  const stops = parseGradientStops(direction ? parts.slice(1) : parts);
  if (stops.length === 0) {
    return null;
  }

  const vector = linearDirectionToVector(direction);
  const cx = width / 2;
  const cy = height / 2;
  const halfLength = Math.sqrt(width * width + height * height) / 2;
  const gradient = ctx.createLinearGradient(
    cx - vector.x * halfLength,
    cy - vector.y * halfLength,
    cx + vector.x * halfLength,
    cy + vector.y * halfLength,
  );

  for (const stop of stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

function parseRadialCenter(direction: string | undefined, width: number, height: number) {
  const centerMatch = direction?.match(/\bat\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/i);
  if (!centerMatch) {
    return { x: width / 2, y: height / 2 };
  }

  return {
    x: width * (Number(centerMatch[1]) / 100),
    y: height * (Number(centerMatch[2]) / 100),
  };
}

function createRadialGradientFill(
  ctx: CanvasRenderingContext2D,
  parts: string[],
  width: number,
  height: number,
): CanvasGradient | null {
  const firstPart = parts[0]?.trim();
  const hasDirection = firstPart && !isColorStopCandidate(firstPart);
  const center = parseRadialCenter(hasDirection ? firstPart : undefined, width, height);
  const stops = parseGradientStops(hasDirection ? parts.slice(1) : parts);
  if (stops.length === 0) {
    return null;
  }

  const radius = Math.max(
    Math.hypot(center.x, center.y),
    Math.hypot(width - center.x, center.y),
    Math.hypot(center.x, height - center.y),
    Math.hypot(width - center.x, height - center.y),
  );
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);

  for (const stop of stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  return gradient;
}

function createCanvasBackgroundFill(
  ctx: CanvasRenderingContext2D,
  wallpaper: string,
  width: number,
  height: number,
): CanvasBackgroundFill | null {
  const gradientMatch = wallpaper.match(/^\s*(linear|radial)-gradient\((.*)\)\s*$/);
  if (!gradientMatch) {
    return wallpaper;
  }

  const [, type, params] = gradientMatch;
  const parts = splitTopLevelCommas(params);
  if (type === "linear") {
    return createLinearGradientFill(ctx, parts, width, height);
  }

  return createRadialGradientFill(ctx, parts, width, height);
}

// Renders video frames with all effects (background, zoom, crop, blur, shadow) to an offscreen canvas for export.

export class FrameRenderer {
  private app: Application | null = null;
  private cameraContainer: Container | null = null;
  private videoContainer: Container | null = null;
  private videoSprite: Sprite | null = null;
  private backgroundSprite: Sprite | null = null;
  private maskGraphics: Graphics | null = null;
  private blurFilter: BlurFilter | null = null;
  private shadowCanvas: HTMLCanvasElement | null = null;
  private shadowCtx: CanvasRenderingContext2D | null = null;
  private compositeCanvas: HTMLCanvasElement | null = null;
  private compositeCtx: CanvasRenderingContext2D | null = null;
  private config: FrameRenderConfig;
  private animationState: AnimationState;
  private layoutCache: any = null;
  private currentVideoTime = 0;

  constructor(config: FrameRenderConfig) {
    this.config = config;
    this.animationState = {
      scale: 1,
      focusX: DEFAULT_FOCUS.cx,
      focusY: DEFAULT_FOCUS.cy,
    };
  }

  async initialize(): Promise<void> {
    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = this.config.width;
    canvas.height = this.config.height;
    
    // Try to set colorSpace if supported (may not be available on all platforms)
    try {
      if (canvas && 'colorSpace' in canvas) {
        // @ts-ignore
        canvas.colorSpace = 'srgb';
      }
    } catch (error) {
      // Silently ignore colorSpace errors on platforms that don't support it
      console.warn('[FrameRenderer] colorSpace not supported on this platform:', error);
    }

    // Initialize PixiJS with optimized settings for export performance
    this.app = new Application();
    await this.app.init({
      canvas,
      width: this.config.width,
      height: this.config.height,
      backgroundAlpha: 0,
      antialias: false,
      resolution: 1,
      autoDensity: true,
    });

    // Setup containers
    this.cameraContainer = new Container();
    this.videoContainer = new Container();
    this.app.stage.addChild(this.cameraContainer);
    this.cameraContainer.addChild(this.videoContainer);

    // Setup background (render separately, not in PixiJS)
    await this.setupBackground();

    // Setup blur filter for video container
    this.blurFilter = new BlurFilter();
    this.blurFilter.quality = 1; // PERFORMANCE OVERRIDE: Prevent 3-pass FBO pipeline slowdowns
    this.blurFilter.resolution = this.app.renderer.resolution;
    this.blurFilter.blur = 0;
    this.videoContainer.filters = [this.blurFilter];

    // Setup composite canvas for final output with shadows
    this.compositeCanvas = document.createElement('canvas');
    this.compositeCanvas.width = this.config.width;
    this.compositeCanvas.height = this.config.height;
    this.compositeCtx = this.compositeCanvas.getContext('2d', { willReadFrequently: false });
    
    if (!this.compositeCtx) {
      throw new Error('Failed to get 2D context for composite canvas');
    }

    // Setup shadow canvas if needed
    if (this.config.showShadow) {
      this.shadowCanvas = document.createElement('canvas');
      this.shadowCanvas.width = this.config.width;
      this.shadowCanvas.height = this.config.height;
      this.shadowCtx = this.shadowCanvas.getContext('2d', { willReadFrequently: false });
      
      if (!this.shadowCtx) {
        throw new Error('Failed to get 2D context for shadow canvas');
      }
    }

    // Setup mask
    this.maskGraphics = new Graphics();
    this.videoContainer.addChild(this.maskGraphics);
    this.videoContainer.mask = this.maskGraphics;
  }

  private async setupBackground(): Promise<void> {
    const wallpaper = this.config.wallpaper;

    // Create background canvas for separate rendering (not affected by zoom)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = this.config.width;
    bgCanvas.height = this.config.height;
    const bgCtx = bgCanvas.getContext('2d')!;

    try {
      // Render background based on type
      if (wallpaper.startsWith('file://') || wallpaper.startsWith('data:') || wallpaper.startsWith('/') || wallpaper.startsWith('http')) {
        // Image background
        const img = new Image();
        // Don't set crossOrigin for same-origin images to avoid CORS taint
        // Only set it for cross-origin URLs
        let imageUrl: string;
        if (wallpaper.startsWith('http')) {
          imageUrl = wallpaper;
          if (!imageUrl.startsWith(window.location.origin)) {
            img.crossOrigin = 'anonymous';
          }
        } else if (wallpaper.startsWith('file://') || wallpaper.startsWith('data:')) {
          imageUrl = wallpaper;
        } else {
          imageUrl = window.location.origin + wallpaper;
        }
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (err) => {
            console.error('[FrameRenderer] Failed to load background image:', imageUrl, err);
            reject(new Error(`Failed to load background image: ${imageUrl}`));
          };
          img.src = imageUrl;
        });
        
        // Draw the image using cover and center positioning
        const imgAspect = img.width / img.height;
        const canvasAspect = this.config.width / this.config.height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgAspect > canvasAspect) {
          drawHeight = this.config.height;
          drawWidth = drawHeight * imgAspect;
          drawX = (this.config.width - drawWidth) / 2;
          drawY = 0;
        } else {
          drawWidth = this.config.width;
          drawHeight = drawWidth / imgAspect;
          drawX = 0;
          drawY = (this.config.height - drawHeight) / 2;
        }
        
        bgCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } else {
        const fill = createCanvasBackgroundFill(bgCtx, wallpaper, this.config.width, this.config.height);
        bgCtx.fillStyle = fill ?? '#000000';
        bgCtx.fillRect(0, 0, this.config.width, this.config.height);
      }
    } catch (error) {
      console.error('[FrameRenderer] Error setting up background, using fallback:', error);
      bgCtx.fillStyle = '#000000';
      bgCtx.fillRect(0, 0, this.config.width, this.config.height);
    }

    // Store the background canvas for compositing
    this.backgroundSprite = bgCanvas as any;
  }

  async renderFrame(videoSource: HTMLVideoElement | VideoFrame | ImageBitmap, timestamp: number): Promise<void> {
    if (!this.app || !this.videoContainer || !this.cameraContainer) {
      throw new Error('Renderer not initialized');
    }

    this.currentVideoTime = timestamp / 1000000;

    // Create or update video sprite from videoSource
    if (!this.videoSprite) {
      const texture = Texture.from(videoSource as any);
      this.videoSprite = new Sprite(texture);
      this.videoContainer.addChild(this.videoSprite);
    } else {
      const newTexture = Texture.from(videoSource as any);
      // Only replace and destroy if the source actually changed (e.g., a new VideoFrame)
      if (this.videoSprite.texture !== newTexture) {
        const oldTexture = this.videoSprite.texture;
        this.videoSprite.texture = newTexture;
        if (oldTexture) {
          oldTexture.destroy(true);
        }
      } else {
        // If it's the exact same texture (e.g., same HTMLVideoElement), just trigger an update
        if (this.videoSprite.texture.source) {
          this.videoSprite.texture.source.update();
        }
      }
    }

    // Apply layout only if config or video dimensions changed
    this.updateLayout();

    const timeMs = this.currentVideoTime * 1000;
    const TICKS_PER_FRAME = 1;
    
    let maxMotionIntensity = 0;
    for (let i = 0; i < TICKS_PER_FRAME; i++) {
      const motionIntensity = this.updateAnimationState(timeMs);
      maxMotionIntensity = Math.max(maxMotionIntensity, motionIntensity);
    }
    
    // Apply transform once with maximum motion intensity from all ticks
    applyZoomTransform({
      cameraContainer: this.cameraContainer,
      blurFilter: this.blurFilter,
      stageSize: this.layoutCache.stageSize,
      baseMask: this.layoutCache.maskRect,
      zoomScale: this.animationState.scale,
      focusX: this.animationState.focusX,
      focusY: this.animationState.focusY,
      motionIntensity: maxMotionIntensity,
      isPlaying: true,
      motionBlurEnabled: this.config.motionBlurEnabled ?? true,
    });

    // Render the PixiJS stage to its canvas (video only, transparent background)
    this.app.renderer.render(this.app.stage);

    // Composite with shadows to final output canvas
    this.compositeWithShadows();

    // Render annotations on top if present
    if (this.config.annotationRegions && this.config.annotationRegions.length > 0 && this.compositeCtx) {
      // Calculate scale factor based on export vs preview dimensions
      const previewWidth = this.config.previewWidth || 1920;
      const previewHeight = this.config.previewHeight || 1080;
      const scaleX = this.config.width / previewWidth;
      const scaleY = this.config.height / previewHeight;
      const scaleFactor = (scaleX + scaleY) / 2;



      await renderAnnotations(
        this.compositeCtx,
        this.config.annotationRegions,
        this.config.width,
        this.config.height,
        timeMs,
        scaleFactor
      );
    }

    // Render cursor on top of annotations
    if (this.config.showVectorCursor !== false && this.config.cursorData && this.config.cursorData.length > 0 && this.compositeCtx) {
      this.renderCursor(timeMs);
    }
  }

  private updateLayout(): void {
    if (!this.app || !this.videoSprite || !this.maskGraphics || !this.videoContainer) return;

    const { width, height } = this.config;
    const { cropRegion, borderRadius = 0, padding = 0 } = this.config;
    const videoWidth = this.config.videoWidth;
    const videoHeight = this.config.videoHeight;

    // CHECK CACHE: Only re-calculate if dimensions or layout parameters changed
    const layoutKey = `${width}-${height}-${videoWidth}-${videoHeight}-${borderRadius}-${padding}-${cropRegion.x}-${cropRegion.y}-${cropRegion.width}-${cropRegion.height}`;
    if (this.layoutCache && this.layoutCache.key === layoutKey) {
      return;
    }

    // Calculate cropped video dimensions
    const cropStartX = cropRegion.x;
    const cropStartY = cropRegion.y;
    const cropEndX = cropRegion.x + cropRegion.width;
    const cropEndY = cropRegion.y + cropRegion.height;

    const croppedVideoWidth = videoWidth * (cropEndX - cropStartX);
    const croppedVideoHeight = videoHeight * (cropEndY - cropStartY);
    
    // Calculate scale to fit in viewport
    // Padding is a percentage (0-100), where 50% ~ 0.8 scale
    const paddingScale = 1.0 - (padding / 100) * 0.4;
    const viewportWidth = width * paddingScale;
    const viewportHeight = height * paddingScale;
    const scale = Math.min(viewportWidth / croppedVideoWidth, viewportHeight / croppedVideoHeight);

    // Position video sprite
    this.videoSprite.width = videoWidth * scale;
    this.videoSprite.height = videoHeight * scale;

    // Ensure crop pixel offsets are handled below

    // Center the cropped region in the container
    const croppedDisplayWidth = croppedVideoWidth * scale;
    const croppedDisplayHeight = croppedVideoHeight * scale;
    const centerOffsetX = (width - croppedDisplayWidth) / 2;
    const centerOffsetY = (height - croppedDisplayHeight) / 2;

    // Position video sprite relative to stage (like in preview layoutUtils.ts)
    const cropPixelX = cropStartX * videoWidth * scale;
    const cropPixelY = cropStartY * videoHeight * scale;
    const spriteX = centerOffsetX - cropPixelX;
    const spriteY = centerOffsetY - cropPixelY;

    this.videoSprite.x = spriteX;
    this.videoSprite.y = spriteY;

    // Ensure container is at 0,0 so stage calculations match
    this.videoContainer.x = 0;
    this.videoContainer.y = 0;

    // scale border radius by export/preview canvas ratio
    const previewWidth = this.config.previewWidth || 1920;
    const previewHeight = this.config.previewHeight || 1080;
    const canvasScaleFactor = Math.min(width / previewWidth, height / previewHeight);
    const scaledBorderRadius = borderRadius * canvasScaleFactor;
    
    // Draw mask at the centered offset (like in preview layoutUtils.ts)
    const maskX = centerOffsetX;
    const maskY = centerOffsetY;

    this.maskGraphics.clear();
    this.maskGraphics.roundRect(maskX, maskY, croppedDisplayWidth, croppedDisplayHeight, scaledBorderRadius);
    this.maskGraphics.fill({ color: 0xffffff });

    // Cache layout info
    this.layoutCache = {
      key: layoutKey,
      stageSize: { width, height },
      videoSize: { width: croppedVideoWidth, height: croppedVideoHeight },
      baseScale: scale,
      baseOffset: { x: spriteX, y: spriteY },
      maskRect: { x: maskX, y: maskY, width: croppedDisplayWidth, height: croppedDisplayHeight },
    };
  }

  private clampFocusToStage(focus: { cx: number; cy: number }, depth: number): { cx: number; cy: number } {
    if (!this.layoutCache) return focus;
    const cache = this.layoutCache;
    return clampFocusToStageUtil(
      focus, 
      depth as any, 
      cache.stageSize,
      true, // isFullScreenBinding
      cache.videoSize,
      cache.baseScale,
      cache.baseOffset
    );
  }

  private updateAnimationState(timeMs: number): number {
    if (!this.cameraContainer || !this.layoutCache) return 0;

    const { strength, focus, depth } = findInterpolatedTarget(this.config.zoomRegions, timeMs);
    
    const defaultFocus = DEFAULT_FOCUS;
    let targetScaleFactor = 1;
    let targetFocus = { ...defaultFocus };

    if (strength > 0 && focus && depth !== null) {
      const zoomScale = interpolateZoomScale(depth, ZOOM_DEPTH_SCALES);
      const clampedDepth = Math.round(Math.max(1, Math.min(6, depth))) as 1|2|3|4|5|6;
      
      // NEW: Convert video focus to stage focus first!
      const stageFocus = videoFocusToStage(
        focus,
        this.layoutCache.stageSize,
        this.layoutCache.videoSize,
        this.layoutCache.baseScale,
        this.layoutCache.baseOffset
      );
      
      const clampedFocus = this.clampFocusToStage(stageFocus, clampedDepth);
      
      targetScaleFactor = 1 + (zoomScale - 1) * strength;
      targetFocus = {
        cx: defaultFocus.cx + (clampedFocus.cx - defaultFocus.cx) * strength,
        cy: defaultFocus.cy + (clampedFocus.cy - defaultFocus.cy) * strength,
      };
    }

    const state = this.animationState;

    const prevScale = state.scale;
    const prevFocusX = state.focusX;
    const prevFocusY = state.focusY;

    const scaleDelta = targetScaleFactor - state.scale;
    const focusXDelta = targetFocus.cx - state.focusX;
    const focusYDelta = targetFocus.cy - state.focusY;

    let nextScale = prevScale;
    let nextFocusX = prevFocusX;
    let nextFocusY = prevFocusY;

    if (Math.abs(scaleDelta) > MIN_DELTA) {
      nextScale = prevScale + scaleDelta * SMOOTHING_FACTOR;
    } else {
      nextScale = targetScaleFactor;
    }

    if (Math.abs(focusXDelta) > MIN_DELTA) {
      nextFocusX = prevFocusX + focusXDelta * SMOOTHING_FACTOR;
    } else {
      nextFocusX = targetFocus.cx;
    }

    if (Math.abs(focusYDelta) > MIN_DELTA) {
      nextFocusY = prevFocusY + focusYDelta * SMOOTHING_FACTOR;
    } else {
      nextFocusY = targetFocus.cy;
    }

    state.scale = nextScale;
    state.focusX = nextFocusX;
    state.focusY = nextFocusY;

    return Math.max(
      Math.abs(nextScale - prevScale),
      Math.abs(nextFocusX - prevFocusX),
      Math.abs(nextFocusY - prevFocusY)
    );
  }

  private compositeWithShadows(): void {
    if (!this.compositeCanvas || !this.compositeCtx || !this.app) return;

    const videoCanvas = this.app.canvas as HTMLCanvasElement;
    const ctx = this.compositeCtx;
    const w = this.compositeCanvas.width;
    const h = this.compositeCanvas.height;

    // Clear composite canvas
    ctx.clearRect(0, 0, w, h);

    // Step 1: Draw background layer (with optional blur, not affected by zoom)
    if (this.backgroundSprite) {
      const bgCanvas = this.backgroundSprite as any as HTMLCanvasElement;
      
      if (this.config.showBlur) {
        ctx.save();
        ctx.filter = 'blur(6px)'; // Canvas blur is weaker than CSS
        ctx.drawImage(bgCanvas, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(bgCanvas, 0, 0, w, h);
      }
    } else {
      console.warn('[FrameRenderer] No background sprite found during compositing!');
    }

    // Draw video layer with shadows on top of background
    if (this.config.showShadow && this.config.shadowIntensity > 0 && this.shadowCanvas && this.shadowCtx) {
      const shadowCtx = this.shadowCtx;
      shadowCtx.clearRect(0, 0, w, h);
      shadowCtx.save();
      
      // Calculate combined shadow parameters for performance
      const intensity = this.config.shadowIntensity;
      const combinedBlur = 40 * intensity;
      const combinedAlpha = 0.5 * intensity;
      const combinedOffset = 10 * intensity;
      
      // Use a SINGLE drop-shadow instead of triple - this is 3x faster!
      shadowCtx.filter = `drop-shadow(0 ${combinedOffset}px ${combinedBlur}px rgba(0,0,0,${combinedAlpha}))`;
      shadowCtx.drawImage(videoCanvas, 0, 0, w, h);
      shadowCtx.restore();
      ctx.drawImage(this.shadowCanvas, 0, 0, w, h);
    } else {
      ctx.drawImage(videoCanvas, 0, 0, w, h);
    }
  }

  getCanvas(): HTMLCanvasElement {
    if (!this.compositeCanvas) {
      throw new Error('Renderer not initialized');
    }
    return this.compositeCanvas;
  }


  private drawMacCursor(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, isVectorStyle = true) {
    ctx.save();
    
    // The tip of the pointer is mathematically positioned at local (0, 0), so no offset subtraction needed
    const targetX = x;
    const targetY = y;
    
    // Drop shadow
    if (isVectorStyle) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 5 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3 * scale;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 2 * scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1 * scale;
    }
    
    // Draw the crisp macOS vector cursor scaled relative to the tip at (0, 0)
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(targetX, targetY + 20 * scale);
    ctx.lineTo(targetX + 5.7 * scale, targetY + 14.3 * scale);
    ctx.lineTo(targetX + 10.7 * scale, scale * 24.3 + targetY);
    ctx.lineTo(targetX + 14.3 * scale, scale * 22.1 + targetY);
    ctx.lineTo(targetX + 9.3 * scale, targetY + 12.1 * scale);
    ctx.lineTo(targetX + 18 * scale, targetY + 12.1 * scale);
    ctx.closePath();
    
    ctx.fillStyle = 'black';
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.2 * scale;
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    ctx.restore();
  }

  private renderCursor(timeMs: number): void {
    const cursorData = this.config.cursorData || [];
    if (cursorData.length === 0 || !this.compositeCtx) return;

    let currentTimeMs = timeMs + (this.config.cursorOffset || 0);
    const minTime = cursorData[0].timestamp;
    const maxTime = cursorData[cursorData.length - 1].timestamp;
    currentTimeMs = Math.max(minTime, Math.min(maxTime, currentTimeMs));

    let currentIndex = 0;
    for (let i = 0; i < cursorData.length - 1; i++) {
      if (cursorData[i].timestamp <= currentTimeMs && cursorData[i + 1].timestamp > currentTimeMs) {
        currentIndex = i;
        break;
      }
    }
    if (currentTimeMs >= maxTime) {
      currentIndex = cursorData.length - 2;
    }

    const p0 = cursorData[Math.max(0, currentIndex - 1)];
    const p1 = cursorData[currentIndex];
    const p2 = cursorData[currentIndex + 1];
    const p3 = cursorData[Math.min(cursorData.length - 1, currentIndex + 2)];

    const timeDiff = p2.timestamp - p1.timestamp;
    const progress = timeDiff === 0 ? 0 : Math.max(0, Math.min(1, (currentTimeMs - p1.timestamp) / timeDiff));

    const getX = (p: any) => p.cx !== undefined ? p.cx : (p.x > 1 ? p.x / 1920 : p.x);
    const getY = (p: any) => p.cy !== undefined ? p.cy : (p.y > 1 ? p.y / 1080 : p.y);

    const catmullRom = (v0: number, v1: number, v2: number, v3: number, t: number): number => {
      return 0.5 * (
        (2 * v1) +
        (-v0 + v2) * t +
        (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t +
        (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t
      );
    };

    let currentX = 0;
    let currentY = 0;

    if (this.config.cursorSmoothing !== false) {
      currentX = catmullRom(getX(p0), getX(p1), getX(p2), getX(p3), progress);
      currentY = catmullRom(getY(p0), getY(p1), getY(p2), getY(p3), progress);
    } else {
      currentX = getX(p1) + (getX(p2) - getX(p1)) * progress;
      currentY = getY(p1) + (getY(p2) - getY(p1)) * progress;
    }

    const videoSprite = this.videoSprite;
    let finalX = 0;
    let finalY = 0;

    if (videoSprite && videoSprite.texture && videoSprite.texture.width > 0) {
      const videoWidth = videoSprite.texture.width;
      const videoHeight = videoSprite.texture.height;

      // Directly invoke videoSprite.toGlobal using PIXI affine matrix conversion!
      // This is 100% mathematically correct and eliminates manual layout offsets.
      const globalPos = videoSprite.toGlobal({
        x: currentX * videoWidth,
        y: currentY * videoHeight
      });
      finalX = globalPos.x;
      finalY = globalPos.y;
    } else {
      finalX = currentX * this.config.width;
      finalY = currentY * this.config.height;
    }

    const isVectorStyle = this.config.showVectorCursor !== false;
    const scaleFactor = (this.config.width / (this.config.previewWidth || 1920));
    const cursorSize = this.config.cursorSize || 1.5;

    let jiggleScale = 1.0;
    if (isVectorStyle) {
      const lastClick = [...cursorData].reverse().find(
        (c: any) => c.type === 'click' && c.timestamp <= currentTimeMs && (currentTimeMs - c.timestamp) < 200
      );
      if (lastClick) {
        const t = currentTimeMs - lastClick.timestamp;
        jiggleScale = 1.0 - 0.2 * Math.cos(t * 0.05) * Math.exp(-t * 0.02);
      }
    }

    const displayScale = isVectorStyle ? cursorSize * 1.6 : 0.62;
    const finalScale = jiggleScale * displayScale * scaleFactor;

    this.drawMacCursor(this.compositeCtx, finalX, finalY, finalScale, isVectorStyle);
  }

  destroy(): void {
    if (this.videoSprite) {
      this.videoSprite.destroy();
      this.videoSprite = null;
    }
    this.backgroundSprite = null;
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = null;
    }
    this.cameraContainer = null;
    this.videoContainer = null;
    this.maskGraphics = null;
    this.blurFilter = null;
    this.shadowCanvas = null;
    this.shadowCtx = null;
    this.compositeCanvas = null;
    this.compositeCtx = null;
  }
}
