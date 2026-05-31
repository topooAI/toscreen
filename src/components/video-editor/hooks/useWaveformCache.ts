import { useState, useEffect, useRef } from 'react';
import { parseWavFile } from './wavParser';

export interface WaveformCacheEntry {
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
      let fetchUrl = url;
      if (fetchUrl.startsWith('file://')) {
        fetchUrl = fetchUrl.replace('file://', 'toscreen://');
      }
      const dataPromise = item.file 
        ? item.file.arrayBuffer()
        : fetch(fetchUrl + '?t=' + Date.now(), { cache: 'no-store' }).then(res => res.arrayBuffer());
        
      dataPromise
        .then(ab => {
          // Attempt manual WAV parse to bypass decodeAudioData silence padding bugs
          const parsed = parseWavFile(ab);
          if (parsed) {
            setCache(c => {
              const next = new Map(c);
              next.set(cacheKey, parsed);
              return next;
            });
            fetchingUrls.current.delete(cacheKey);
            return;
          }

          // Fallback to decodeAudioData
          return ac.decodeAudioData(ab).then(audioBuffer => {
            const durationSec = audioBuffer.duration;
            const samples = Math.max(32000, Math.floor(durationSec * 400));
            const numChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const blockSize = Math.floor(length / samples);
            const newPeaks: number[] = new Array(samples);
            for (let i = 0; i < samples; i++) {
              let max = 0;
              const start = i * blockSize;
              const end = Math.min(start + blockSize, length);
              for (let j = start; j < end; j++) {
                for (let c = 0; c < numChannels; c++) {
                  const val = Math.abs(audioBuffer.getChannelData(c)[j]);
                  if (val > max) max = val;
                }
              }
              newPeaks[i] = max;
            }
            setCache(c => {
              const next = new Map(c);
              next.set(cacheKey, { peaks: newPeaks, durationMs: durationSec * 1000 });
              return next;
            });
            fetchingUrls.current.delete(cacheKey);
          });
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
