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
    console.log("[useCursorRenderer] HTML Hook Effect Triggered:", {
      pixiReady,
      appRefExists: !!appRef.current,
      videoContainerRefExists: !!videoContainerRef.current,
      cursorDataLength: cursorData ? cursorData.length : -1
    });

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
    cursor.style.overflow = "visible";
    cursor.style.transformOrigin = "0px 0px"; // Tip of the arrow
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "9999";
    cursor.style.willChange = "transform";
    
    // Inject a pixel-perfect, crisp, standard macOS vector cursor SVG with professional physical drop shadow
    cursor.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35)); display: block;">
        <path d="M5.5 3.5V23.5L11.2 17.8L16.2 27.8L19.8 25.6L14.8 15.6L23.5 15.6L5.5 3.5Z" fill="black" stroke="white" stroke-width="2.2" stroke-linejoin="round"/>
      </svg>
    `;

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

    console.log("[useCursorRenderer] Mounting HTML cursor renderer. Initial states:", {
      pixiReady,
      app: !!app,
      parent: !!parent,
      dataPoints: cursorData.length
    });

    // Catmull-Rom Cubic Spline interpolation formula for C1 smooth curves
    const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
      return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
      );
    };

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
      const isMock = cursorData.length > 0 && cursorData[0].timestampMs === 0 && cursorData[cursorData.length - 1].timestampMs === 10000;
      
      const minTimeMs = cursorData[0].timestampMs;
      const maxTimeMs = cursorData[cursorData.length - 1].timestampMs;
      
      if (isMock) {
        // Loop the mock data every 10 seconds so it never disappears on long videos
        const mockDurationMs = cursorData[cursorData.length - 1].timestampMs;
        currentTimeMs = currentTimeMs % Math.max(1, mockDurationMs);
      } else {
        // For real recorded videos, clamp to the range of available mouse events
        currentTimeMs = Math.max(minTimeMs, Math.min(maxTimeMs, currentTimeMs));
      }

      // Find indices of the boundary points surrounding the current time anchor
      let currentIndex = 0;
      for (let i = 0; i < cursorData.length - 1; i++) {
        if (cursorData[i].timestampMs <= currentTimeMs && cursorData[i + 1].timestampMs > currentTimeMs) {
          currentIndex = i;
          break;
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
      const timeDiff = p2.timestampMs - p1.timestampMs;
      const progress = timeDiff === 0 ? 0 : Math.max(0, Math.min(1, (currentTimeMs - p1.timestampMs) / timeDiff));

      let currentX = 0;
      let currentY = 0;

      if (cursorSmoothingRef.current) {
        // Apply Catmull-Rom interpolation to smooth out jerky angles/shakiness
        currentX = catmullRom(p0.x, p1.x, p2.x, p3.x, progress);
        currentY = catmullRom(p0.y, p1.y, p2.y, p3.y, progress);
      } else {
        // Linear interpolation (keeps native raw jerky points)
        currentX = p1.x + (p2.x - p1.x) * progress;
        currentY = p1.y + (p2.y - p1.y) * progress;
      }

      // Read player display dimensions
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;

      // Check if vector cursor should be visible
      const isVisible = showVectorCursorRef.current && (parentWidth > 0 && parentHeight > 0);
      cursor.style.display = isVisible ? 'block' : 'none';

      // Detect clicks to trigger Jiggle animation
      if (p1.isClick && currentIndex !== lastClickIndex) {
        lastClickIndex = currentIndex;
        clickAnimationStateRef.current = { timeSinceClick: 0, isAnimating: true };
      }

      // Jiggle Physics Animation (Scale down and spring back)
      const currentSize = cursorSizeRef.current;
      const displayScale = currentSize * 1.6; // 1.6x multiplier for premium Screen Studio enlarged look!

      let jiggleScale = 1.0;
      if (clickAnimationStateRef.current.isAnimating) {
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

      if (isVisible) {
        let finalX = currentX * parentWidth;
        let finalY = currentY * parentHeight;

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
        const totalScale = jiggleScale * displayScale;
        const tipOffsetX = 5.5 * totalScale;
        const tipOffsetY = 3.5 * totalScale;
        cursor.style.transform = `translate3d(${finalX - tipOffsetX}px, ${finalY - tipOffsetY}px, 0) scale(${totalScale})`;

        if (Math.random() < 0.02) {
          console.log("[useCursorRenderer] HTML Cursor active position:", {
            finalX,
            finalY,
            parentWidth,
            parentHeight,
            totalScale,
            currentTimeRef: currentTimeRef.current,
            rawTimeMs,
            currentTimeMs,
            currentIndex,
            currentX,
            currentY,
            progress,
            cursorDataLength: cursorData.length,
            firstEventTime: cursorData[0].timestampMs,
            lastEventTime: cursorData[cursorData.length - 1].timestampMs
          });
        }
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
