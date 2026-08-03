import { useEffect, useMemo, useRef } from "react";
import { Application, Container, Ticker } from "pixi.js";
import { CursorDataPoint } from "../types";
import type { CursorCustomImageMap, CursorStylePreset } from "../types";
import type { PresentationEffectRegion } from "../presentation/types";
import { isCursorHiddenAt } from "../presentation/presentationEffects";
import { prepareCursorTrack, sampleCursorTrack } from "../videoPlayback/cursorTrack";
import { cursorElementMarkup, normalizeCursorVisualType } from "../videoPlayback/cursorVisuals";

interface UseCursorRendererProps {
  pixiReady: boolean;
  appRef: React.RefObject<Application | null>;
  videoRef: React.RefObject<HTMLVideoElement>;
  videoContainerRef: React.RefObject<Container | null>;
  currentTimeRef: React.RefObject<number>;
  cursorData: CursorDataPoint[];
  cursorSize?: number;
  cursorSmoothing?: boolean;
  showVectorCursor?: boolean;
  cursorStyle?: CursorStylePreset;
  cursorCustomImages?: CursorCustomImageMap;
  cursorOffset?: number;
  mediaDurationMs?: number;
  presentationEffects?: PresentationEffectRegion[];
}

export function useCursorRenderer({
  pixiReady,
  appRef,
  videoRef,
  videoContainerRef,
  currentTimeRef,
  cursorData,
  cursorSize = 1.5,
  cursorSmoothing = true,
  showVectorCursor = true,
  cursorStyle = 'toscreen',
  cursorCustomImages = {},
  cursorOffset = 0,
  mediaDurationMs,
  presentationEffects = [],
}: UseCursorRendererProps) {
  const clickAnimationStateRef = useRef({ timeSinceClick: 999, isAnimating: false });
  const preparedCursorData = useMemo(
    () => prepareCursorTrack(cursorData, cursorSmoothing, mediaDurationMs),
    [cursorData, cursorSmoothing, mediaDurationMs],
  );

  // Sync settings parameters into high-performance references (avoid ticker rebuilds)
  const cursorSizeRef = useRef(cursorSize);
  const showVectorCursorRef = useRef(showVectorCursor);
  const cursorStyleRef = useRef(cursorStyle);
  const cursorCustomImagesRef = useRef(cursorCustomImages);
  const cursorOffsetRef = useRef(cursorOffset);
  const presentationEffectsRef = useRef(presentationEffects);

  useEffect(() => { cursorSizeRef.current = cursorSize; }, [cursorSize]);
  useEffect(() => { showVectorCursorRef.current = showVectorCursor; }, [showVectorCursor]);
  useEffect(() => { cursorStyleRef.current = cursorStyle; }, [cursorStyle]);
  useEffect(() => { cursorCustomImagesRef.current = cursorCustomImages; }, [cursorCustomImages]);
  useEffect(() => { cursorOffsetRef.current = cursorOffset; }, [cursorOffset]);
  useEffect(() => { presentationEffectsRef.current = presentationEffects; }, [presentationEffects]);

  useEffect(() => {
    if (!pixiReady || !appRef.current || !videoRef.current || preparedCursorData.length === 0) return;

    const app = appRef.current;
    const parent = app.canvas?.parentElement || videoRef.current.parentElement;
    if (!parent) return;

    const cursorLayer = document.createElement("div");
    cursorLayer.style.position = "absolute";
    cursorLayer.style.inset = "0";
    cursorLayer.style.overflow = "hidden";
    cursorLayer.style.pointerEvents = "none";
    cursorLayer.style.zIndex = "9999";

    // Create standard, high-performance HTML/CSS element for distortion-free rendering
    const cursor = document.createElement("div");
    cursor.style.position = "absolute";
    cursor.style.left = "0";
    cursor.style.top = "0";
    cursor.style.width = "56px";
    cursor.style.height = "56px";
    cursor.style.margin = "0";
    cursor.style.padding = "0";
    cursor.style.border = "none";
    cursor.style.overflow = "visible";
    cursor.style.transformOrigin = "0px 0px"; // Tip of the arrow
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "1";
    cursor.style.willChange = "transform";
    
    const fitCursorVisualToBox = () => {
      const visual = cursor.querySelector('svg, img') as SVGElement | HTMLImageElement | null;
      if (!visual) return;
      visual.style.width = '100%';
      visual.style.height = '100%';
    };

    cursor.innerHTML = cursorElementMarkup('default', cursorStyleRef.current, cursorCustomImagesRef.current);
    fitCursorVisualToBox();

    cursorLayer.appendChild(cursor);
    parent.appendChild(cursorLayer);

    let lastClickIndex = -1;
    let rVFCId: number | null = null;
    let currentFrameMediaTimeMs = -1;

    const updateFrameTime = (_now: number, metadata: any) => {
      currentFrameMediaTimeMs = metadata.mediaTime * 1000;
      
      const video = videoRef.current;
      if (video && 'requestVideoFrameCallback' in video) {
        rVFCId = (video as any).requestVideoFrameCallback(updateFrameTime);
      }
    };

    const video = videoRef.current;
    if (video && 'requestVideoFrameCallback' in video) {
      rVFCId = (video as any).requestVideoFrameCallback(updateFrameTime);
    }

    let lastAppliedFilter = '';
    let lastClipPath = '';
    let lastCursorType = 'default';
    let lastCursorStyle = cursorStyleRef.current;
    let lastCustomImages = cursorCustomImagesRef.current;
    let lastCursorBoxSize = 56;

    const ticker = (time: Ticker) => {
      const video = videoRef.current;
      if (!video) return;

      const rawTimeMs = currentTimeRef.current ?? 0;
      
      let currentTimeMs = rawTimeMs;

      if (video.paused) {
        currentTimeMs = rawTimeMs;
        currentFrameMediaTimeMs = -1;
      } else {
        if (
          currentFrameMediaTimeMs !== -1
          && !video.seeking
          && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          // mediaTime is the PTS of the frame the user is actually seeing.
          // Extrapolating between callbacks makes the cursor run ahead of video.
          currentTimeMs = currentFrameMediaTimeMs;
        } else {
          currentTimeMs = video.currentTime * 1000;
        }
      }

      // Apply synchronous time offset adjustment (e.g. shift backward to align with video decoder latency)
      currentTimeMs = currentTimeMs + cursorOffsetRef.current;

      // Determine if we are running mock or real recording data
      const isMock = preparedCursorData.length > 0
        && preparedCursorData[0].timestamp === 0
        && preparedCursorData[preparedCursorData.length - 1].timestamp === 10000;
      
      const minTimeMs = preparedCursorData[0].timestamp;
      const maxTimeMs = preparedCursorData[preparedCursorData.length - 1].timestamp;
      
      if (isMock) {
        const mockDurationMs = preparedCursorData[preparedCursorData.length - 1].timestamp;
        currentTimeMs = currentTimeMs % Math.max(1, mockDurationMs);
      } else {
        currentTimeMs = Math.max(minTimeMs, Math.min(maxTimeMs, currentTimeMs));
      }

      const sample = sampleCursorTrack(preparedCursorData, currentTimeMs);
      if (!sample) return;
      const currentIndex = sample.index;
      const currentPoint = preparedCursorData[currentIndex];
      const currentX = sample.x;
      const currentY = sample.y;
      const currentCursorType = normalizeCursorVisualType(sample.cursorType);
      const currentCursorStyle = cursorStyleRef.current;
      const currentCustomImages = cursorCustomImagesRef.current;
      if (
        currentCursorType !== lastCursorType
        || currentCursorStyle !== lastCursorStyle
        || currentCustomImages !== lastCustomImages
      ) {
        cursor.innerHTML = cursorElementMarkup(currentCursorType, currentCursorStyle, currentCustomImages);
        fitCursorVisualToBox();
        lastCursorType = currentCursorType;
        lastCursorStyle = currentCursorStyle;
        lastCustomImages = currentCustomImages;
        lastAppliedFilter = '';
      }

      // PERFORMANCE KILLER FIX: Forced Synchronous Layout (Layout Thrashing)
      // NEVER read parent.clientWidth/clientHeight inside a 60fps ticker loop!
      // This causes the browser to recalculate the entire page layout on EVERY FRAME, causing massive stutters!
      // We assume it's visible by default, or you can rely on CSS for hiding.
      let isVisible = false;

      // Detect clicks to trigger Jiggle animation (only for Premium Vector Cursor)
      const isVectorStyle = showVectorCursorRef.current;
      if (isVectorStyle && currentPoint.isClick && currentIndex !== lastClickIndex) {
        lastClickIndex = currentIndex;
        clickAnimationStateRef.current = { timeSinceClick: 0, isAnimating: true };
      }

      // Jiggle Physics Animation (Scale down and spring back) - only for premium large cursor
      const currentSize = cursorSizeRef.current;
      // When showVectorCursor is false, force small size to match macOS native cursor size
      // Note: SVG base is 56px (2x), so divide by 2 to get equivalent visual size
      const displayScale = isVectorStyle ? currentSize * 0.8 : 0.31; 
      const targetSizePx = 56 * displayScale;
      if (Math.abs(targetSizePx - lastCursorBoxSize) > 0.01) {
        cursor.style.width = `${targetSizePx}px`;
        cursor.style.height = `${targetSizePx}px`;
        lastCursorBoxSize = targetSizePx;
      }

      let jiggleScale = 1.0;
      if (isVectorStyle && clickAnimationStateRef.current.isAnimating) {
        clickAnimationStateRef.current.timeSinceClick += time.deltaMS;
        const t = clickAnimationStateRef.current.timeSinceClick;
        
        // A simple spring dampening formula
        if (t < 200) {
          // Scale down quickly, then bounce back past 1.0, then settle
          jiggleScale = 1.0 - 0.2 * Math.cos(t * 0.05) * Math.exp(-t * 0.02);
        } else {
          clickAnimationStateRef.current.isAnimating = false;
        }
      }

      // Dynamically toggle drop shadow filter based on style selection
      const visualElement = cursor.querySelector('svg, img') as SVGElement | HTMLImageElement | null;
      if (visualElement) {
        const targetFilter = isVectorStyle
          ? 'drop-shadow(0px 3px 5px rgba(0,0,0,0.35))' // Premium large style
          : 'drop-shadow(0px 1px 2px rgba(0,0,0,0.45))'; // Native style
        
        if (lastAppliedFilter !== targetFilter) {
          visualElement.style.filter = targetFilter;
          lastAppliedFilter = targetFilter;
        }
      }

      let finalX = 0;
      let finalY = 0;

      // Transform the recorded video coordinate through the current PIXI camera.
      const container = videoContainerRef.current;
      if (container) {
        const videoSprite = container.children?.[0] as any;
        if (videoSprite && videoSprite.texture && videoSprite.texture.width > 0) {
          const videoWidth = videoSprite.texture.width;
          const videoHeight = videoSprite.texture.height;
          const globalPos = videoSprite.toGlobal({
            x: currentX * videoWidth,
            y: currentY * videoHeight
          });

          finalX = globalPos.x;
          finalY = globalPos.y;
          isVisible = true;

          const visibleVideoBounds = videoSprite.getBounds?.();
          if (visibleVideoBounds?.width > 0 && visibleVideoBounds?.height > 0) {
            const stageWidth = app.screen.width;
            const stageHeight = app.screen.height;
            const left = Math.max(0, Math.min(stageWidth, visibleVideoBounds.x));
            const top = Math.max(0, Math.min(stageHeight, visibleVideoBounds.y));
            const right = Math.max(0, Math.min(stageWidth, stageWidth - (visibleVideoBounds.x + visibleVideoBounds.width)));
            const bottom = Math.max(0, Math.min(stageHeight, stageHeight - (visibleVideoBounds.y + visibleVideoBounds.height)));
            const clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
            if (clipPath !== lastClipPath) {
              cursorLayer.style.clipPath = clipPath;
              lastClipPath = clipPath;
            }
          }
        }
      }

      if (isCursorHiddenAt(presentationEffectsRef.current, currentTimeMs)) isVisible = false;
      cursor.style.display = isVisible ? 'block' : 'none';
      if (!isVisible) return;

      // The SVG path tip is exactly at (0, 0).
      const pressedScale = sample.isPointerDown ? 0.86 : 1;
      const animationScale = jiggleScale * pressedScale;
      cursor.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${animationScale})`;
    };

    app.ticker.add(ticker);

    return () => {
      if (rVFCId !== null && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(rVFCId);
      }
      if (app && app.ticker) {
        app.ticker.remove(ticker);
      }
      if (cursorLayer.parentElement) {
        cursorLayer.parentElement.removeChild(cursorLayer);
      }
    };
  }, [pixiReady, preparedCursorData]);

  return null;
}
