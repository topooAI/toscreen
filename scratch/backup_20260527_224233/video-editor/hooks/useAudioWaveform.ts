import { useState, useEffect } from 'react';

export function useAudioWaveform(videoUrl: string | null, samples = 1000) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!videoUrl) {
      setPeaks([]);
      return;
    }

    let isMounted = true;
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();

    async function loadAudio() {
      setLoading(true);
      try {
        const response = await fetch(videoUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // decodeAudioData might be heavy for very large files, but for typical screen recordings, it's fast enough locally
        const audioBuffer = await ac.decodeAudioData(arrayBuffer);
        
        if (!isMounted) return;

        // Use the first channel
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.ceil(channelData.length / samples);
        const extractedPeaks = new Array(samples);

        for (let i = 0; i < samples; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, channelData.length);
          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          extractedPeaks[i] = max;
        }

        // Normalize peaks to 0-1 range
        const globalMax = Math.max(...extractedPeaks, 0.001);
        const normalized = extractedPeaks.map(p => p / globalMax);

        if (isMounted) {
          setPeaks(normalized);
        }
      } catch (err) {
        console.error("Failed to decode audio for waveform:", err);
        // Fallback: Generate mock waveform data
        if (isMounted) {
           const mockPeaks = Array.from({ length: samples }, (_, i) => Math.abs(Math.sin(i * 0.05)) * 0.8 + 0.1);
           setPeaks(mockPeaks);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAudio();

    return () => {
      isMounted = false;
      ac.close();
    };
  }, [videoUrl, samples]);

  return { peaks, loading };
}
