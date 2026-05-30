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

export function useWaveformCache(audioItems: { id: string; sourceUrl?: string; file?: File; }[]) {
  const [cache, setCache] = useState<Map<string, WaveformCacheEntry>>(new Map());
  const fetchingUrls = useRef<Set<string>>(new Set());
  const failedUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ac = getAudioContext();
    
    audioItems.forEach(item => {
      const url = item.sourceUrl;
      if (!url) return;
      
      const cacheKey = url;
      
      // If already cached, currently fetching, or failed, skip
      if (cache.has(cacheKey) || fetchingUrls.current.has(cacheKey) || failedUrls.current.has(cacheKey)) {
        return;
      }
      
      fetchingUrls.current.add(cacheKey);
      
      // Prioritize file arrayBuffer decoding to bypass CSP fetch limitations
      const dataPromise = item.file 
        ? item.file.arrayBuffer()
        : fetch(url).then(res => res.arrayBuffer());
        
      dataPromise
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
            next.set(cacheKey, { peaks: newPeaks, durationMs: audioBuffer.duration * 1000 });
            return next;
          });
          fetchingUrls.current.delete(cacheKey);
        })
        .catch(e => {
            console.error("Cache decode failed for", url, e);
            fetchingUrls.current.delete(cacheKey);
            failedUrls.current.add(cacheKey); // Mark as failed to avoid infinite retries
        });
    });

  }, [audioItems, cache]);

  return cache;
}
