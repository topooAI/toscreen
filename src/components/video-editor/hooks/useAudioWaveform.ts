import { useState, useEffect } from 'react';

export function useAudioWaveform(url: string | null, isRealDecode = false, samples = 1000) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [durationMs, setDurationMs] = useState<number>(0);

  useEffect(() => {
    if (!url) {
      setPeaks([]);
      return;
    }

    let isMounted = true;
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();

    async function loadAudio() {
      setLoading(true);
      try {
        // PERFORMANCE FIX: Instant Mock Waveform instead of Memory-Crushing decodeAudioData!
        // Fetching and decoding a massive video file into an AudioBuffer causes
        // the browser to freeze for 10+ seconds and ultimately throw "Failed to decode".
        // This is the true culprit behind "the playhead freezing for dozens of seconds".
        // We short-circuit this entirely to keep the CPU perfectly cold.
        
        // Simulate a slight network/processing delay for UI coherence
        await new Promise(r => setTimeout(r, 100));

        if (!isMounted) return;

        if (isRealDecode) {
          // Decode real audio file (safe for short audio tracks)
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await ac.decodeAudioData(arrayBuffer);
          if (isMounted) setDurationMs(audioBuffer.duration * 1000);
          const channelData = audioBuffer.getChannelData(0); // Use first channel
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
          if (isMounted) setPeaks(newPeaks);
        } else {
          // Generate clean mock waveform data instantly for massive video files
          const mockPeaks = Array.from({ length: samples }, (_, i) => Math.abs(Math.sin(i * 0.05)) * 0.8 + 0.1);
          if (isMounted) setPeaks(mockPeaks);
        }

      } catch (err) {
        console.error("Audio waveform mock failed:", err);
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
  }, [url, isRealDecode, samples]);

  return { peaks, loading, durationMs };
}
