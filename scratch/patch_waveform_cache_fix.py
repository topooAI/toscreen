import re

file_path = 'src/components/video-editor/hooks/useWaveformCache.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = """import { useState, useEffect, useRef } from 'react';

interface WaveformCacheEntry {
  peaks: number[];
  durationMs: number;
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

    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    
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

    return () => {
      // ac.close(); // Don't close immediately as async decode might be running!
    };
  }, [audioItems, cache]);

  return cache;
}
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched useWaveformCache.ts pure function bug!")
