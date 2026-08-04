import * as React from 'react';
import type { TrimRegion } from '../types';

interface VideoEventHandlersParams {
  video: HTMLVideoElement;
  isSeekingRef: React.MutableRefObject<boolean>;
  isPlayingRef: React.MutableRefObject<boolean>;
  allowPlaybackRef: React.MutableRefObject<boolean>;
  currentTimeRef: React.MutableRefObject<number>;
  timeUpdateAnimationRef: React.MutableRefObject<number | null>;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
  trimRegionsRef: React.MutableRefObject<TrimRegion[]>;
  isSkippingRef: React.MutableRefObject<boolean>;
  immuneUntilRef: React.MutableRefObject<number>;
  resolvePlaybackRate?: (sourceTimeMs: number) => number;
}

export function createVideoEventHandlers(params: VideoEventHandlersParams) {
  const {
    video,
    isSeekingRef,
    isPlayingRef,
    allowPlaybackRef,
    currentTimeRef,
    timeUpdateAnimationRef,
    onPlayStateChange,
    onTimeUpdate,
    trimRegionsRef,
    isSkippingRef,
    immuneUntilRef,
    resolvePlaybackRate,
  } = params;

  const syncPlaybackRate = (sourceTimeMs: number) => {
    const resolved = resolvePlaybackRate?.(sourceTimeMs) ?? 1;
    const rate = Number.isFinite(resolved) && resolved > 0 ? resolved : 1;
    if (Math.abs(video.playbackRate - rate) > 0.001) video.playbackRate = rate;
  };

  // Fast path: always update the ref at 60fps for PIXI/audio
  const updateRef = (timeValue: number) => {
    currentTimeRef.current = timeValue * 1000;
  };

  // Slow path: update React state at ~5fps for UI text displays only
  const emitTime = (timeValue: number) => {
    updateRef(timeValue);
    onTimeUpdate(timeValue);
  };

  // Helper function to check if current time is within a trim region
  const findActiveTrimRegion = (currentTimeMs: number): TrimRegion | null => {
    const trimRegions = trimRegionsRef.current;
    return trimRegions.find(
      (region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs
    ) || null;
  };

  let lastEmitTimestamp = 0;

  function updateTime() {
    if (!video) return;
    
    const now = performance.now();
    const currentTimeMs = video.currentTime * 1000;
    syncPlaybackRate(currentTimeMs);
    const activeTrimRegion = findActiveTrimRegion(currentTimeMs);
    
    // If we're in a trim region during playback, skip to the end of it
    if (activeTrimRegion && !video.paused && !video.ended && !isSkippingRef.current) {
      isSkippingRef.current = true;
      const skipToTime = activeTrimRegion.endMs / 1000;
      
      if (skipToTime >= video.duration) {
        video.pause();
        isSkippingRef.current = false;
      } else {
        video.currentTime = skipToTime;
        
        // Wait for the decoder to actually render the new frame before updating PIXI
        const resumePlayback = () => {
          isSkippingRef.current = false;
          emitTime(video.currentTime);
        };

        if (typeof (video as any).requestVideoFrameCallback === 'function') {
          (video as any).requestVideoFrameCallback(resumePlayback);
        } else {
          video.addEventListener('seeked', function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            resumePlayback();
          });
        }
      }
    } else if (!isSkippingRef.current) {
      // ALWAYS update the ref at full 60fps for PIXI rendering
      updateRef(video.currentTime);
      
      // Only push React state updates at ~5fps (200ms) to avoid
      // re-rendering the entire VideoEditor component tree every frame.
      // Paused/ended states always emit immediately for responsiveness.
      if (now - lastEmitTimestamp >= 200 || video.paused || video.ended) {
        onTimeUpdate(video.currentTime);
        lastEmitTimestamp = now;
      }
    }
    
    if (!video.paused && !video.ended) {
      timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
    }
  }

  const handlePlay = () => {
    if (isSeekingRef.current) {
      video.pause();
      return;
    }

    if (!allowPlaybackRef.current) {
      video.pause();
      return;
    }

    syncPlaybackRate(video.currentTime * 1000);
    isPlayingRef.current = true;
    onPlayStateChange(true);
    if (timeUpdateAnimationRef.current) {
      cancelAnimationFrame(timeUpdateAnimationRef.current);
    }
    timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
  };

    const handlePause = () => {
    isPlayingRef.current = false;
    onPlayStateChange(false);
    if (timeUpdateAnimationRef.current) {
      cancelAnimationFrame(timeUpdateAnimationRef.current);
      timeUpdateAnimationRef.current = null;
    }
    emitTime(video.currentTime);
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;

    const now = performance.now();
    const currentTimeMs = video.currentTime * 1000;
    const activeTrimRegion = findActiveTrimRegion(currentTimeMs);
    
    // If we seeked into a trim region while playing, skip to the end
    if (activeTrimRegion && isPlayingRef.current && !video.paused && now >= immuneUntilRef.current) {
      const skipToTime = (activeTrimRegion.endMs + 50) / 1000;
      
      if (skipToTime >= video.duration) {
        video.pause();
      } else {
        immuneUntilRef.current = now + 1000;
        video.currentTime = skipToTime;
        emitTime(skipToTime);
      }
    } else {
      if (!isPlayingRef.current && !video.paused) {
        video.pause();
      }
      emitTime(video.currentTime);
    }
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;

    if (!isPlayingRef.current && !video.paused) {
      video.pause();
    }
    emitTime(video.currentTime);
  };

  return {
    handlePlay,
    handlePause,
    handleSeeked,
    handleSeeking,
  };
}
