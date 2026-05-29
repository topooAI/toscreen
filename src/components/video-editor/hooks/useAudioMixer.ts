import { useEffect, useRef } from 'react';
import type { AudioRegion } from '../types';

interface UseAudioMixerProps {
  audioRegions: AudioRegion[];
  isPlaying: boolean;
  currentTime: number; // in seconds
}

export function useAudioMixer({ audioRegions, isPlaying, currentTime }: UseAudioMixerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Track currently playing audio buffers
  const audioSourcesRef = useRef<Map<string, { source: AudioBufferSourceNode, gain: GainNode }>>(new Map());
  const decodedBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  
  // Keep refs for loop processing
  const stateRef = useRef({ isPlaying, currentTime, audioRegions });
  
  useEffect(() => {
    stateRef.current = { isPlaying, currentTime, audioRegions };
  }, [isPlaying, currentTime, audioRegions]);
  
  // Initialize Web Audio API
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    // Create context only if missing or closed
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;

    // We DO NOT connect the main video to AudioContext via createMediaElementSource anymore.
    // Reason: Local file:// URLs or CORS restrictions will cause the video to output silence when hijacked.
    // The main video will play its own audio naturally, and we will mix our AudioRegions via this AudioContext.
    
    // The ultimate hack to wake up AudioContext automatically on any user interaction:
    const wakeUp = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
      }
    };
    window.addEventListener('mousedown', wakeUp);
    window.addEventListener('keydown', wakeUp);

    return () => {
      window.removeEventListener('mousedown', wakeUp);
      window.removeEventListener('keydown', wakeUp);
      // We only close the context when the entire mixer unmounts
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Handle Play/Pause for Web Audio context
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    if (isPlaying) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(console.error);
      }
    } else {
      // We don't necessarily need to suspend the entire context, 
      // but we do need to stop active buffer sources
      audioSourcesRef.current.forEach(({ source }) => {
        try { source.stop(); } catch(e) {}
      });
      audioSourcesRef.current.clear();
    }
  }, [isPlaying]);

  // 1. Decode external audio regions immediately when added (regardless of isPlaying)
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    audioRegions.forEach(region => {
      if (!decodedBuffersRef.current.has(region.id)) {
        // Optimistically mark as loading
        decodedBuffersRef.current.set(region.id, null as any);
        
        const dataPromise = region.file 
          ? region.file.arrayBuffer() 
          : fetch(region.sourceUrl).then(res => res.arrayBuffer());
          
        dataPromise
          .then(data => ctx.decodeAudioData(data))
          .then(buffer => {
            decodedBuffersRef.current.set(region.id, buffer);
          })
          .catch(err => {
            console.error("Failed to decode audio", region.sourceUrl, err);
            decodedBuffersRef.current.delete(region.id);
          });
      }
    });
  }, [audioRegions]);

  // 2. High-performance polling for play/stop synchronization
  useEffect(() => {
    let animationFrameId: number;

    const syncAudio = () => {
      const ctx = audioContextRef.current;
      if (!ctx) {
        animationFrameId = requestAnimationFrame(syncAudio);
        return;
      }

      const { isPlaying: currentIsPlaying, currentTime: currentPlaybackTime, audioRegions: currentRegions } = stateRef.current;
      const currentTimeMs = currentPlaybackTime * 1000;

      // Handle pause globally by stopping all running sources
      if (!currentIsPlaying) {
        audioSourcesRef.current.forEach(({ source }) => {
          try { source.stop(); } catch(e) {}
        });
        audioSourcesRef.current.clear();
      } else {
        // Ensure context is running if we are playing
        if (ctx.state === 'suspended') {
          ctx.resume().catch(console.error);
        }

        currentRegions.forEach(region => {
          const isWithinRegion = currentTimeMs >= region.startMs && currentTimeMs < region.endMs;
          const isCurrentlyPlaying = audioSourcesRef.current.has(region.id);
          
          if (isWithinRegion && !isCurrentlyPlaying) {
            // Needs to start playing
            const buffer = decodedBuffersRef.current.get(region.id);
            if (buffer) {
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              
              const gainNode = ctx.createGain();
              gainNode.gain.value = region.volume ?? 1.0;
              
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              const offsetSeconds = (region.sourceStartMs || 0) / 1000 + (currentTimeMs - region.startMs) / 1000;
              source.start(0, offsetSeconds);
              
              audioSourcesRef.current.set(region.id, { source, gain: gainNode });
            }
          } else if (!isWithinRegion && isCurrentlyPlaying) {
            // Needs to stop playing because it went out of bounds
            const activeNodes = audioSourcesRef.current.get(region.id);
            if (activeNodes) {
              try { activeNodes.source.stop(); } catch(e) {}
              audioSourcesRef.current.delete(region.id);
            }
          } else if (isWithinRegion && isCurrentlyPlaying) {
            // Update volume if needed
            const activeNodes = audioSourcesRef.current.get(region.id);
            if (activeNodes) {
              activeNodes.gain.gain.value = region.volume ?? 1.0;
            }
          }
        });
      }

      // Clean up deleted regions
      audioSourcesRef.current.forEach((activeNodes, id) => {
        if (!currentRegions.some(r => r.id === id)) {
          try { activeNodes.source.stop(); } catch(e) {}
          audioSourcesRef.current.delete(id);
        }
      });

      animationFrameId = requestAnimationFrame(syncAudio);
    };

    animationFrameId = requestAnimationFrame(syncAudio);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
}
