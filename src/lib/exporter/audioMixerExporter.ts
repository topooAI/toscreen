import type { ExportConfig } from './types';
import type { AudioRegion, TrimRegion } from '@/components/video-editor/types';

export class AudioMixerExporter {
  private config: ExportConfig;
  private videoUrl: string;
  private audioRegions: AudioRegion[];
  private trimRegions: TrimRegion[];
  
  constructor(config: ExportConfig, videoUrl: string) {
    this.config = config;
    this.videoUrl = videoUrl;
    // Safely fallback to empty arrays if not present
    this.audioRegions = (config as any).audioRegions || [];
    this.trimRegions = config.trimRegions || [];
  }

  private getEffectiveDuration(totalDuration: number): number {
    const totalTrimDuration = this.trimRegions.reduce((sum, region) => {
      return sum + (region.endMs - region.startMs) / 1000;
    }, 0);
    return Math.max(0, totalDuration - totalTrimDuration);
  }

  public async renderAudio(
    mainAudioTotalDuration: number, 
    onProgress?: (progress: number) => void
  ): Promise<AudioBuffer | null> {
    try {
      const effectiveDuration = this.getEffectiveDuration(mainAudioTotalDuration);
      if (effectiveDuration <= 0) return null;

      // 1. Setup global context for decoding
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const tempCtx = new AudioContextClass();
      
      const sampleRate = tempCtx.sampleRate || 48000;
      const offlineCtx = new OfflineAudioContext(2, sampleRate * effectiveDuration, sampleRate);

      onProgress?.(10); // Decode started

      // 2. Decode Main Video Audio (if any)
      let mainAudioBuffer: AudioBuffer | null = null;
      try {
        const videoRes = await fetch(this.videoUrl);
        const videoBuffer = await videoRes.arrayBuffer();
        mainAudioBuffer = await tempCtx.decodeAudioData(videoBuffer);
      } catch (err) {
        console.warn("[AudioMixerExporter] Could not decode main video audio. Proceeding without main audio.", err);
      }

      onProgress?.(30);

      // 3. Schedule Main Audio according to Trim Regions
      if (mainAudioBuffer) {
        const sortedTrims = [...this.trimRegions].sort((a, b) => a.startMs - b.startMs);
        let currentSourceTime = 0;
        let currentOutputTime = 0;

        for (const trim of sortedTrims) {
          const trimStartSec = trim.startMs / 1000;
          if (trimStartSec > currentSourceTime) {
            // Keep the segment before this trim
            const keepDuration = trimStartSec - currentSourceTime;
            
            const source = offlineCtx.createBufferSource();
            source.buffer = mainAudioBuffer;
            source.connect(offlineCtx.destination);
            source.start(currentOutputTime, currentSourceTime, keepDuration);

            currentOutputTime += keepDuration;
          }
          // Skip the trimmed duration
          currentSourceTime = trim.endMs / 1000;
        }

        // Add the remaining part after the last trim
        if (currentSourceTime < mainAudioBuffer.duration) {
          const keepDuration = mainAudioBuffer.duration - currentSourceTime;
          const source = offlineCtx.createBufferSource();
          source.buffer = mainAudioBuffer;
          source.connect(offlineCtx.destination);
          source.start(currentOutputTime, currentSourceTime, keepDuration);
        }
      }

      onProgress?.(50);

      // 4. Decode and Schedule External Audio Regions
      for (let i = 0; i < this.audioRegions.length; i++) {
        const region = this.audioRegions[i];
        let regionBuffer: AudioBuffer | null = null;

        try {
          const dataPromise = region.file 
            ? region.file.arrayBuffer() 
            : fetch(region.sourceUrl).then(res => res.arrayBuffer());
            
          const rawBuffer = await dataPromise;
          regionBuffer = await tempCtx.decodeAudioData(rawBuffer);
        } catch (err) {
          console.warn(`[AudioMixerExporter] Failed to decode audio region ${region.id}`, err);
        }

        if (regionBuffer) {
          const source = offlineCtx.createBufferSource();
          source.buffer = regionBuffer;

          const gainNode = offlineCtx.createGain();
          gainNode.gain.value = region.volume ?? 1.0;

          source.connect(gainNode);
          gainNode.connect(offlineCtx.destination);

          // region.startMs is on the EFFECTIVE timeline. 
          const outputStartTime = region.startMs / 1000;
          const outputDuration = (region.endMs - region.startMs) / 1000;
          
          // if it was cropped from the left, we'd start playback from sourceStartMs
          const sourceOffset = (region.sourceStartMs || 0) / 1000;

          source.start(outputStartTime, sourceOffset, outputDuration);
        }

        onProgress?.(50 + ((i + 1) / this.audioRegions.length) * 30);
      }

      // Cleanup temp context
      if (tempCtx.state !== 'closed') {
        tempCtx.close();
      }

      onProgress?.(85);

      // 5. Start Rendering
      const renderedBuffer = await offlineCtx.startRendering();
      
      onProgress?.(100);
      return renderedBuffer;

    } catch (err) {
      console.error("[AudioMixerExporter] Error rendering audio", err);
      return null;
    }
  }
}
