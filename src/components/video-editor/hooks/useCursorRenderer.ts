import { useEffect, useRef } from "react";
import { Application, Container, Ticker } from "pixi.js";
import { CursorDataPoint } from "../types";

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
  cursorOffset?: number;
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
  cursorOffset = -180,
}: UseCursorRendererProps) {
  const clickAnimationStateRef = useRef({ timeSinceClick: 999, isAnimating: false });

  // Sync settings parameters into high-performance references (avoid ticker rebuilds)
  const cursorSizeRef = useRef(cursorSize);
  const cursorSmoothingRef = useRef(cursorSmoothing);
  const showVectorCursorRef = useRef(showVectorCursor);
  const cursorOffsetRef = useRef(cursorOffset);

  useEffect(() => { cursorSizeRef.current = cursorSize; }, [cursorSize]);
  useEffect(() => { cursorSmoothingRef.current = cursorSmoothing; }, [cursorSmoothing]);
  useEffect(() => { showVectorCursorRef.current = showVectorCursor; }, [showVectorCursor]);
  useEffect(() => { cursorOffsetRef.current = cursorOffset; }, [cursorOffset]);

  useEffect(() => {
    if (!pixiReady || !appRef.current || !videoRef.current || cursorData.length === 0) return;

    const app = appRef.current;
    const parent = app.canvas?.parentElement || videoRef.current.parentElement;
    if (!parent) return;

    // Create standard, high-performance HTML/CSS element for distortion-free rendering
    const cursor = document.createElement("div");
    cursor.style.position = "absolute";
    cursor.style.left = "0";
    cursor.style.top = "0";
    cursor.style.width = "28px";
    cursor.style.height = "28px";
    cursor.style.margin = "0";
    cursor.style.padding = "0";
    cursor.style.border = "none";
    cursor.style.overflow = "visible";
    cursor.style.transformOrigin = "0px 0px"; // Tip of the arrow
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "9999";
    cursor.style.willChange = "transform";
    
    // Inject a pixel-perfect, crisp, standard macOS vector cursor SVG with professional physical drop shadow
    // The path is translated so that the cursor tip is mathematically positioned at local (0, 0)
    cursor.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35)); display: block; overflow: visible;">
        <path d="M0 0V20L5.7 14.3L10.7 24.3L14.3 22.1L9.3 12.1L18 12.1L0 0Z" fill="black" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>
    `;

    const svgEl = cursor.querySelector('svg') as SVGSVGElement | null;

    parent.appendChild(cursor);

    let lastClickIndex = -1;
    let rVFCId: number | null = null;
    let currentFrameMediaTimeMs = -1;
    let lastRVFCTime = -1;

    const updateFrameTime = (_now: number, metadata: any) => {
      currentFrameMediaTimeMs = metadata.mediaTime * 1000;
      lastRVFCTime = performance.now();
      
      const video = videoRef.current;
      if (video && 'requestVideoFrameCallback' in video) {
        rVFCId = (video as any).requestVideoFrameCallback(updateFrameTime);
      }
    };

    const video = videoRef.current;
    if (video && 'requestVideoFrameCallback' in video) {
      rVFCId = (video as any).requestVideoFrameCallback(updateFrameTime);
    }

    // Catmull-Rom Cubic Spline interpolation formula for C1 smooth curves
    const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
      return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
      );
    };

    let lastAppliedFilter = '';

    const ticker = (time: Ticker) => {
      const video = videoRef.current;
      if (!video) return;

      const rawTimeMs = currentTimeRef.current ?? 0;
      
      let currentTimeMs = rawTimeMs;

      if (video.paused) {
        currentTimeMs = rawTimeMs;
        currentFrameMediaTimeMs = -1;
        lastRVFCTime = -1;
      } else {
        if (currentFrameMediaTimeMs !== -1 && lastRVFCTime !== -1) {
          const elapsed = performance.now() - lastRVFCTime;
          currentTimeMs = currentFrameMediaTimeMs + elapsed * video.playbackRate;
        } else {
          currentTimeMs = video.currentTime * 1000;
        }
      }

      // Apply synchronous time offset adjustment (e.g. shift backward to align with video decoder latency)
      currentTimeMs = currentTimeMs + cursorOffsetRef.current;

      // Determine if we are running mock or real recording data
      const isMock = cursorData.length > 0 && cursorData[0].timestamp === 0 && cursorData[cursorData.length - 1].timestamp === 10000;
      
      const minTimeMs = cursorData[0].timestamp;
      const maxTimeMs = cursorData[cursorData.length - 1].timestamp;
      
      if (isMock) {
        // Loop the mock data every 10 seconds so it never disappears on long videos
        const mockDurationMs = cursorData[cursorData.length - 1].timestamp;
        currentTimeMs = currentTimeMs % Math.max(1, mockDurationMs);
      } else {
        // For real recorded videos, clamp to the range of available mouse events
        currentTimeMs = Math.max(minTimeMs, Math.min(maxTimeMs, currentTimeMs));
      }

      // O(log N) Binary Search to instantly find the correct time anchor.
      // This is the absolute key to fixing "end-of-video extreme lag"!
      // Previously, an O(N) linear scan caused up to 100,000 iterations per frame (60fps) 
      // towards the end of long videos, completely choking the CPU.
      let left = 0;
      let right = cursorData.length - 2;
      let currentIndex = 0;
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (cursorData[mid].timestamp <= currentTimeMs && cursorData[mid + 1].timestamp > currentTimeMs) {
          currentIndex = mid;
          break;
        } else if (cursorData[mid].timestamp > currentTimeMs) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      // If we've reached the very end of our mouse recording timeline, anchor to the final state
      if (currentTimeMs >= maxTimeMs) {
        currentIndex = cursorData.length - 2;
      }

      // Fetch 4 spline points for Catmull-Rom smooth boundary interpolation
      const p0 = cursorData[Math.max(0, currentIndex - 1)];
      const p1 = cursorData[currentIndex];
      const p2 = cursorData[Math.min(cursorData.length - 1, currentIndex + 1)];
      const p3 = cursorData[Math.min(cursorData.length - 1, currentIndex + 2)];

      // Calculate time progress between p1 and p2 (safely clamped to [0, 1] to prevent extrapolation glitches)
      const timeDiff = p2.timestamp - p1.timestamp;
      const progress = timeDiff === 0 ? 0 : Math.max(0, Math.min(1, (currentTimeMs - p1.timestamp) / timeDiff));

      let currentX = 0;
      let currentY = 0;

      if (cursorSmoothingRef.current) {
        // Apply Catmull-Rom interpolation to smooth out jerky angles/shakiness
        currentX = catmullRom(p0.cx, p1.cx, p2.cx, p3.cx, progress);
        currentY = catmullRom(p0.cy, p1.cy, p2.cy, p3.cy, progress);
      } else {
        // Linear interpolation (keeps native raw jerky points)
        currentX = p1.cx + (p2.cx - p1.cx) * progress;
        currentY = p1.cy + (p2.cy - p1.cy) * progress;
      }

      // PERFORMANCE KILLER FIX: Forced Synchronous Layout (Layout Thrashing)
      // NEVER read parent.clientWidth/clientHeight inside a 60fps ticker loop!
      // This causes the browser to recalculate the entire page layout on EVERY FRAME, causing massive stutters!
      // We assume it's visible by default, or you can rely on CSS for hiding.
      const isVisible = true;
      cursor.style.display = isVisible ? 'block' : 'none';

      // Detect clicks to trigger Jiggle animation (only for Premium Vector Cursor)
      const isVectorStyle = showVectorCursorRef.current;
      if (isVectorStyle && p1.isClick && currentIndex !== lastClickIndex) {
        lastClickIndex = currentIndex;
        clickAnimationStateRef.current = { timeSinceClick: 0, isAnimating: true };
      }

      // Jiggle Physics Animation (Scale down and spring back) - only for premium large cursor
      const currentSize = cursorSizeRef.current;
      // When showVectorCursor is false, force 0.6x base size to match macOS native cursor size perfectly
      const displayScale = isVectorStyle ? currentSize * 1.6 : 0.62; 

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
      if (svgEl) {
        const targetFilter = isVectorStyle
          ? 'drop-shadow(0px 3px 5px rgba(0,0,0,0.35))' // Premium large style
          : 'drop-shadow(0px 1px 2px rgba(0,0,0,0.45))'; // Native style
        
        if (lastAppliedFilter !== targetFilter) {
          svgEl.style.filter = targetFilter;
          lastAppliedFilter = targetFilter;
        }
      }

      if (isVisible) {
        // Fallback initialized to 0. 
        // We rely entirely on PIXI's mathematical affine transform below, eliminating DOM read thrashing!
        let finalX = 0;
        let finalY = 0;

        // Perfect coordinate transformation via PIXI to account for camera zoom/pan!
        const container = videoContainerRef.current;
        if (container) {
          const videoSprite = container.children?.[0] as any;
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
          }
        }

        // Apply transformation GPU-accelerated and distortion-free!
        // No tipOffsetX/tipOffsetY subtracted because the SVG path tip is exactly at (0, 0)
        const totalScale = jiggleScale * displayScale;
        // Removed performance-killing log
        cursor.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) scale(${totalScale})`;
      }
    };

    app.ticker.add(ticker);

    return () => {
      if (rVFCId !== null && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(rVFCId);
      }
      if (app && app.ticker) {
        app.ticker.remove(ticker);
      }
      if (cursor && cursor.parentElement) {
        cursor.parentElement.removeChild(cursor);
      }
    };
  }, [pixiReady, cursorData]);

  return null;
}
