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
  } = params;

  const emitTime = (timeValue: number) => {
    currentTimeRef.current = timeValue * 1000;
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

        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(resumePlayback);
        } else {
          video.addEventListener('seeked', function onSeeked() {
            video.removeEventListener('seeked', onSeeked);
            resumePlayback();
          });
        }
      }
    } else if (!isSkippingRef.current) {
      // Throttle UI updates to ~30fps (every 32ms) to reduce React render pressure
      // while PixiJS continues to render at 60fps in its own ticker.
      if (now - lastEmitTimestamp >= 32 || video.paused || video.ended) {
        emitTime(video.currentTime);
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

    const currentTimeMs = video.currentTime * 1000;
    const activeTrimRegion = findActiveTrimRegion(currentTimeMs);
    
    // If we seeked into a trim region while playing, skip to the end
    if (activeTrimRegion && isPlayingRef.current && !video.paused) {
      const skipToTime = activeTrimRegion.endMs / 1000;
      
      if (skipToTime >= video.duration) {
        video.pause();
      } else {
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
