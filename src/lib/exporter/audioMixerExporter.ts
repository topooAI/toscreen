import type { ExportConfig } from './types';
import { resolveEditingExportDurations, resolveExportDurationSeconds } from './duration';
import type { AudioRegion, TrimRegion } from '@/components/video-editor/types';
import type { createEditingRenderPlan } from '@/components/video-editor/editing';
import type { PresentationEffectRegion } from '@/components/video-editor/presentation/types';
import { activeClickEffect } from '@/components/video-editor/presentation/presentationEffects';

type AudioMixerExportConfig = ExportConfig & {
  audioRegions?: AudioRegion[];
  trimRegions?: TrimRegion[];
  projectDurationMs?: number;
  editingRenderPlan?: ReturnType<typeof createEditingRenderPlan>;
  cursorData?: Array<{ timestamp?: number; timestampMs?: number; isClick?: boolean; type?: string }>;
  presentationEffects?: PresentationEffectRegion[];
};

export class AudioMixerExporter {
  private config: AudioMixerExportConfig;
  private videoUrl: string;
  private audioRegions: AudioRegion[];
  private trimRegions: TrimRegion[];
  
  constructor(config: AudioMixerExportConfig, videoUrl: string) {
    this.config = config;
    this.videoUrl = videoUrl;
    this.audioRegions = config.audioRegions || [];
    this.trimRegions = config.trimRegions || [];
  }

  private getEffectiveDuration(totalDuration: number): number {
    if (this.config.editingRenderPlan) return resolveEditingExportDurations({
      mainTrackDurationMs: this.config.editingRenderPlan.durationMs,
      projectDurationMs: this.config.projectDurationMs,
    }).projectDurationSeconds;
    return resolveExportDurationSeconds({
      sourceDurationSeconds: totalDuration,
      trimRegions: this.trimRegions,
      projectDurationMs: this.config.projectDurationMs,
    });
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
        if (this.config.editingRenderPlan) {
          const { timeMap } = this.config.editingRenderPlan;
          let projectCursorMs = 0;
          for (const clip of timeMap.clips) {
            const clipProjectEndMs = projectCursorMs + clip.sourceEndMs - clip.sourceStartMs;
            const boundaries = Array.from(new Set([
              projectCursorMs,
              clipProjectEndMs,
              ...timeMap.speedSections.flatMap((section) => [section.projectStartMs, section.projectEndMs])
                .filter((time) => time > projectCursorMs && time < clipProjectEndMs),
            ])).sort((a, b) => a - b);
            for (let index = 0; index < boundaries.length - 1; index += 1) {
              const projectStartMs = boundaries[index];
              const projectEndMs = boundaries[index + 1];
              const rate = timeMap.rateAtProjectTime(projectStartMs + 0.01);
              const source = offlineCtx.createBufferSource();
              source.buffer = mainAudioBuffer;
              source.playbackRate.value = rate;
              const outputStart = timeMap.mapProjectToEffective(projectStartMs) / 1000;
              const sourceStart = timeMap.mapProjectToSource(projectStartMs) / 1000;
              const sourceDuration = (projectEndMs - projectStartMs) / 1000;
              source.connect(offlineCtx.destination);
              source.start(outputStart, sourceStart, sourceDuration);
            }
            projectCursorMs = clipProjectEndMs;
          }
        } else {
        const sortedTrims = [...this.trimRegions].sort((a, b) => a.startMs - b.startMs);
        let currentSourceTime = 0;
        let currentOutputTime = 0;

        const applyCrossfade = (source: AudioBufferSourceNode, tStart: number, duration: number) => {
          const tEnd = tStart + duration;
          const gainNode = offlineCtx.createGain();
          
          // 5ms crossfade. Clamp transition time to not exceed half of segment duration.
          const fadeTime = Math.min(0.005, duration / 2); 

          gainNode.gain.setValueAtTime(0, tStart);
          gainNode.gain.linearRampToValueAtTime(1.0, tStart + fadeTime);
          gainNode.gain.setValueAtTime(1.0, tEnd - fadeTime);
          gainNode.gain.linearRampToValueAtTime(0, tEnd);

          source.connect(gainNode);
          gainNode.connect(offlineCtx.destination);
        };

        for (const trim of sortedTrims) {
          const trimStartSec = trim.startMs / 1000;
          if (trimStartSec > currentSourceTime) {
            // Keep the segment before this trim
            const keepDuration = trimStartSec - currentSourceTime;
            
            const source = offlineCtx.createBufferSource();
            source.buffer = mainAudioBuffer;
            
            applyCrossfade(source, currentOutputTime, keepDuration);
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
          
          applyCrossfade(source, currentOutputTime, keepDuration);
          source.start(currentOutputTime, currentSourceTime, keepDuration);
        }
        }
      }

      onProgress?.(50);

      // Synthetic click track: deterministic and asset-free so preview/export use the same event clock.
      for (const point of this.config.cursorData ?? []) {
        if (!(point.isClick || point.type === 'click' || point.type === 'mousedown')) continue;
        const clickTime = Number(point.timestamp ?? point.timestampMs) / 1000;
        if (!Number.isFinite(clickTime) || clickTime < 0 || clickTime >= effectiveDuration) continue;
        const clickConfig = activeClickEffect(this.config.presentationEffects ?? [], clickTime * 1000);
        if (!clickConfig?.soundEnabled) continue;
        const oscillator = offlineCtx.createOscillator(); const gain = offlineCtx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(1150, clickTime); oscillator.frequency.exponentialRampToValueAtTime(520, clickTime + .045);
        gain.gain.setValueAtTime(.12 * clickConfig.soundVolume, clickTime); gain.gain.exponentialRampToValueAtTime(.001, clickTime + .055);
        oscillator.connect(gain); gain.connect(offlineCtx.destination); oscillator.start(clickTime); oscillator.stop(clickTime + .06);
      }

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
          const targetVol = region.volume ?? 1.0;

          // region.startMs is on the EFFECTIVE timeline. 
          const outputStartTime = region.startMs / 1000;
          const outputDuration = (region.endMs - region.startMs) / 1000;
          const outputEndTime = outputStartTime + outputDuration;
          const fadeTime = Math.min(0.005, outputDuration / 2);

          // Apply micro-fade in/out to avoid pops on cut starts/ends
          gainNode.gain.setValueAtTime(0, outputStartTime);
          gainNode.gain.linearRampToValueAtTime(targetVol, outputStartTime + fadeTime);
          gainNode.gain.setValueAtTime(targetVol, outputEndTime - fadeTime);
          gainNode.gain.linearRampToValueAtTime(0, outputEndTime);

          source.connect(gainNode);
          gainNode.connect(offlineCtx.destination);

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
