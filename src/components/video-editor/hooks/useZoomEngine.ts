import * as React from "react";
import { useEffect, useRef } from "react";
import { Application, Container, BlurFilter } from "pixi.js";
import { 
  ZOOM_DEPTH_SCALES, 
  type ZoomRegion,
  type ZoomFocus,
  type ZoomDepth
} from "../types";
import { DEFAULT_FOCUS } from "../videoPlayback/constants";
import { findInterpolatedTarget, interpolateZoomScale } from "../videoPlayback/zoomRegionUtils";
import { videoFocusToStage } from "../videoPlayback/focusUtils";
import { applyZoomTransform } from "../videoPlayback/zoomTransform";

interface useZoomEngineProps {
  pixiReady: boolean;
  videoReady: boolean;
  appRef: React.RefObject<Application | null>;
  cameraContainerRef: React.RefObject<Container | null>;
  videoContainerRef: React.RefObject<Container | null>;
  blurFilterRef: React.RefObject<BlurFilter | null>;
  currentTimeRef: React.RefObject<number>;
  zoomRegionsRef: React.RefObject<ZoomRegion[]>;
  isPlayingRef: React.RefObject<boolean>;
  isFullScreenBindingRef: React.RefObject<boolean>;
  selectedZoomIdRef: React.RefObject<string | null>;
  stageSizeRef: React.RefObject<{ width: number; height: number }>;
  videoSizeRef: React.RefObject<{ width: number; height: number }>;
  baseScaleRef: React.RefObject<number>;
  baseOffsetRef: React.RefObject<{ x: number; y: number }>;
  baseMaskRef: React.RefObject<{ x: number; y: number; width: number; height: number }>;
  motionBlurEnabledRef: React.RefObject<boolean>;
  clampFocusToStage: (focus: ZoomFocus, depth: ZoomDepth) => ZoomFocus;
}

export function useZoomEngine({
  pixiReady,
  videoReady,
  appRef,
  cameraContainerRef,
  videoContainerRef,
  blurFilterRef,
  currentTimeRef,
  zoomRegionsRef,
  isPlayingRef,
  isFullScreenBindingRef,
  selectedZoomIdRef,
  stageSizeRef,
  videoSizeRef,
  baseScaleRef,
  baseOffsetRef,
  baseMaskRef,
  motionBlurEnabledRef,
  clampFocusToStage
}: useZoomEngineProps) {
  const animationStateRef = useRef({ 
    scale: 1, 
    focusX: DEFAULT_FOCUS.cx, 
    focusY: DEFAULT_FOCUS.cy 
  });

  const clampRef = useRef(clampFocusToStage);
  useEffect(() => {
    clampRef.current = clampFocusToStage;
  }, [clampFocusToStage]);

  useEffect(() => {
    if (!pixiReady) return;

    const app = appRef.current;
    if (!app) return;

    const applyTransform = (motionIntensity: number) => {
      const cameraContainer = cameraContainerRef.current;
      if (!cameraContainer) return;
      const state = animationStateRef.current;
      applyZoomTransform({
        cameraContainer,
        blurFilter: blurFilterRef.current,
        stageSize: stageSizeRef.current!,
        baseMask: baseMaskRef.current!,
        zoomScale: state.scale,
        focusX: state.focusX,
        focusY: state.focusY,
        motionIntensity,
        isPlaying: isPlayingRef.current ?? false,
        motionBlurEnabled: motionBlurEnabledRef.current ?? false,
      });
    };

    const ticker = () => {
      try {
        if (!app || !app.ticker || !videoReady) return;

        const currentTimeMs = currentTimeRef.current || 0;
        const { strength, focus, depth } = findInterpolatedTarget(zoomRegionsRef.current || [], currentTimeMs);
      
        let targetScaleFactor = 1;
        let targetFocus = DEFAULT_FOCUS;

        if (strength > 0 && focus && depth !== null) {
          const zoomScale = interpolateZoomScale(depth, ZOOM_DEPTH_SCALES);
          const stageFocus = videoFocusToStage(
            focus,
            stageSizeRef.current!,
            videoSizeRef.current!,
            baseScaleRef.current!,
            baseOffsetRef.current!
          );
          
          const regionFocus = clampRef.current(stageFocus, Math.round(depth) as ZoomDepth);
          targetScaleFactor = 1 + (zoomScale - 1) * strength;
          targetFocus = {
            cx: DEFAULT_FOCUS.cx + (regionFocus.cx - DEFAULT_FOCUS.cx) * strength,
            cy: DEFAULT_FOCUS.cy + (regionFocus.cy - DEFAULT_FOCUS.cy) * strength,
          };
          
          if (Math.random() < 0.01) {
            console.log("ZoomEngine: Active. Strength:", strength, "Scale:", targetScaleFactor, "Focus:", targetFocus);
          }
        }

        const state = animationStateRef.current;
        const previousScale = state.scale;
        const previousFocusX = state.focusX;
        const previousFocusY = state.focusY;
        state.scale = targetScaleFactor;
        state.focusX = targetFocus.cx;
        state.focusY = targetFocus.cy;

        const motionIntensity = Math.max(
          Math.abs(state.scale - previousScale),
          Math.abs(state.focusX - previousFocusX),
          Math.abs(state.focusY - previousFocusY),
        );
        applyTransform(motionIntensity);
      } catch (err) {
        console.error("ZoomEngine ticker error:", err);
      }
    };

    app.ticker.add(ticker);
    return () => {
      if (app && app.ticker) app.ticker.remove(ticker);
    };
  }, [pixiReady, videoReady, appRef, cameraContainerRef, videoContainerRef, currentTimeRef, zoomRegionsRef, isPlayingRef, isFullScreenBindingRef, selectedZoomIdRef, stageSizeRef, videoSizeRef, baseScaleRef, baseOffsetRef, baseMaskRef, motionBlurEnabledRef]);

  return { animationStateRef };
}
