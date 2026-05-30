import * as React from "react";
import { useEffect, useRef } from "react";
import { Sprite, Graphics, Texture, BlurFilter, Application, Container } from "pixi.js";
import { createVideoEventHandlers } from "../videoPlayback/videoEventHandlers";
import { type TrimRegion } from "../types";

interface UseVideoTextureProps {
  pixiReady: boolean;
  videoPath: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  appRef: React.RefObject<Application | null>;
  videoContainerRef: React.RefObject<Container | null>;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onDurationChange: (duration: number) => void;
  onLoadedMetadata: (width: number, height: number) => void;
  trimRegionsRef: React.RefObject<TrimRegion[]>;
  layoutVideoContent: () => void;
  onVideoError?: (error: string) => void;
  videoReady: boolean;
  setVideoReady: (ready: boolean) => void;
  videoSpriteRef: React.MutableRefObject<Sprite | null>;
  maskGraphicsRef: React.MutableRefObject<Graphics | null>;
  blurFilterRef: React.MutableRefObject<BlurFilter | null>;
}

export function useVideoTexture({
  pixiReady,
  videoPath,
  videoRef,
  appRef,
  videoContainerRef,
  onTimeUpdate,
  onPlayStateChange,
  onDurationChange,
  onLoadedMetadata,
  trimRegionsRef,
  layoutVideoContent,
  onVideoError,
  videoReady,
  setVideoReady,
  videoSpriteRef,
  maskGraphicsRef,
  blurFilterRef,
}: UseVideoTextureProps) {
  const videoReadyRafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isSeekingRef = useRef(false);
  const allowPlaybackRef = useRef(false);
  const currentTimeRef = useRef(0);
  const isSkippingRef = useRef(false);
  const immuneUntilRef = useRef(0);
  const timeUpdateAnimationRef = useRef<number | null>(null);

  // Reset video state only if path REALLY changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoPath) return;
    
    video.pause();
    video.currentTime = 0;
    allowPlaybackRef.current = false;
    setVideoReady(false);
  }, [videoPath, videoRef, setVideoReady]);

  // Lock callbacks in refs to prevent the effect from re-running on parent re-renders
  const callbacksRef = useRef({ 
    onTimeUpdate, 
    onPlayStateChange, 
    onDurationChange, 
    onLoadedMetadata,
    onVideoError 
  });
  
  useEffect(() => {
    callbacksRef.current = { 
      onTimeUpdate, 
      onPlayStateChange, 
      onDurationChange, 
      onLoadedMetadata,
      onVideoError 
    };
  }, [onTimeUpdate, onPlayStateChange, onDurationChange, onLoadedMetadata, onVideoError]);

  const layoutVideoContentRef = useRef(layoutVideoContent);
  useEffect(() => {
    layoutVideoContentRef.current = layoutVideoContent;
  }, [layoutVideoContent]);

  // Initialize PIXI texture only when native video is ready
  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    
    const video = videoRef.current;
    const app = appRef.current;
    const videoContainer = videoContainerRef.current;
    if (!video || !app || !videoContainer) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    const videoTexture = Texture.from(video);
    if (videoTexture.source) {
      (videoTexture.source as any).autoPlay = false;
      (videoTexture.source as any).autoUpdate = true;
    }
    
    const videoSprite = new Sprite(videoTexture);
    videoSpriteRef.current = videoSprite;
    
    const maskGraphics = new Graphics();
    videoContainer.addChild(videoSprite);
    videoContainer.addChild(maskGraphics);
    videoContainer.mask = maskGraphics;
    maskGraphicsRef.current = maskGraphics;

    const blurFilter = new BlurFilter();
    blurFilter.quality = 3;
    blurFilter.resolution = app.renderer.resolution;
    blurFilter.strength = 0;
    videoContainer.filters = [blurFilter];
    blurFilterRef.current = blurFilter;
    
    // Use the ref here to avoid dependency on the function identity
    layoutVideoContentRef.current();
    video.pause();
    allowPlaybackRef.current = true;

    const { handlePlay, handlePause, handleSeeked, handleSeeking } = createVideoEventHandlers({
      video,
      isSeekingRef,
      isPlayingRef,
      allowPlaybackRef,
      currentTimeRef,
      timeUpdateAnimationRef,
      onPlayStateChange: (p) => callbacksRef.current.onPlayStateChange(p),
      onTimeUpdate: (t) => callbacksRef.current.onTimeUpdate(t),
      trimRegionsRef,
      isSkippingRef,
      immuneUntilRef,
    });
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('seeking', handleSeeking);
    
    return () => {
      // Defensive cleanup: Check if refs and objects still exist before touching them
      const currentVideoSprite = videoSpriteRef.current;
      const currentMaskGraphics = maskGraphicsRef.current;
      const currentVideoContainer = videoContainerRef.current;
      const currentBlurFilter = blurFilterRef.current;

      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('seeking', handleSeeking);
      
      try {
        if (currentVideoSprite && !currentVideoSprite.destroyed) {
          if (currentVideoContainer && currentVideoContainer.children.includes(currentVideoSprite)) {
            currentVideoContainer.removeChild(currentVideoSprite);
          }
          // Safely destroy sprite without aggressive texture source destruction which can crash if already null
          currentVideoSprite.destroy(true); 
        }

        if (currentMaskGraphics && !currentMaskGraphics.destroyed) {
          if (currentVideoContainer) {
            if (currentVideoContainer.mask === currentMaskGraphics) {
              currentVideoContainer.mask = null;
            }
            if (currentVideoContainer.children.includes(currentMaskGraphics)) {
              currentVideoContainer.removeChild(currentMaskGraphics);
            }
          }
          currentMaskGraphics.destroy(true);
        }

        if (currentBlurFilter) {
          if (currentVideoContainer && currentVideoContainer.filters?.includes(currentBlurFilter)) {
            currentVideoContainer.filters = (currentVideoContainer.filters || []).filter(f => f !== currentBlurFilter);
          }
          currentBlurFilter.destroy();
        }
      } catch (e) {
        console.warn("[useVideoTexture] Cleanup warning:", e);
      }

      if (videoTexture) {
        videoTexture.destroy(true);
      }
      
      videoSpriteRef.current = null;
      maskGraphicsRef.current = null;
      blurFilterRef.current = null;
    };
  }, [pixiReady, videoReady, videoRef, appRef, videoContainerRef, trimRegionsRef]);

  return {
    videoReady,
    setVideoReady,
    videoSpriteRef,
    maskGraphicsRef,
    blurFilterRef,
    videoReadyRafRef,
    isPlayingRef,
    isSeekingRef,
    allowPlaybackRef,
    currentTimeRef,
  };
}
