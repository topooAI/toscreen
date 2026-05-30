import { useState, useEffect, useRef } from 'react';

interface WaveformCacheEntry {
  peaks: number[];
  durationMs: number;
}

// Reuse AudioContext globally to prevent leaks
let sharedAudioContext: AudioContext | null = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

export function useWaveformCache(audioItems: { id: string; sourceUrl?: string; }[]) {
  const [cache, setCache] = useState<Map<string, WaveformCacheEntry>>(new Map());
  const fetchingUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Collect all unique URLs
    const uniqueUrls = new Set<string>();
    audioItems.forEach(item => {
      if (item.sourceUrl) uniqueUrls.add(item.sourceUrl);
    });

    const ac = getAudioContext();
    
    uniqueUrls.forEach(url => {
      // If already cached or currently fetching, skip
      if (cache.has(url) || fetchingUrls.current.has(url)) return;
      
      fetchingUrls.current.add(url);
      
      // Decode
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(ab => ac.decodeAudioData(ab))
        .then(audioBuffer => {
          const channelData = audioBuffer.getChannelData(0);
          const samples = 1000;
          const blockSize = Math.floor(channelData.length / samples);
          const newPeaks = [];
          for (let i = 0; i < samples; i++) {
            let max = 0;
            const start = i * blockSize;
            const end = Math.min(start + blockSize, channelData.length);
            for (let j = start; j < end; j++) {
              const val = Math.abs(channelData[j]);
              if (val > max) max = val;
            }
            newPeaks.push(max);
          }
          setCache(c => {
            const next = new Map(c);
            next.set(url, { peaks: newPeaks, durationMs: audioBuffer.duration * 1000 });
            return next;
          });
        })
        .catch(e => {
            console.error("Cache decode failed for", url, e);
            fetchingUrls.current.delete(url); // Allow retry
        });
    });

  }, [audioItems, cache]);

  return cache;
}
