import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import { AudioMixerExporter } from './audioMixerExporter';
import { AudioEncoderWrapper } from './audioEncoder';
import { resolveExportDurationSeconds } from './duration';
import type { ZoomRegion, CropRegion, TrimRegion, AnnotationRegion, AudioRegion, CursorCustomImageMap, CursorStylePreset } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  projectDurationMs?: number;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  trimRegions?: TrimRegion[];
  showShadow: boolean;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius?: number;
  padding?: number;
  videoPadding?: number;
  cropRegion: CropRegion;
  annotationRegions?: AnnotationRegion[];
  audioRegions?: AudioRegion[];
  previewWidth?: number;
  previewHeight?: number;
  cursorData?: any[];
  cursorSize?: number;
  cursorSmoothing?: boolean;
  showVectorCursor?: boolean;
  cursorStyle?: CursorStylePreset;
  cursorCustomImages?: CursorCustomImageMap;
  cursorOffset?: number;
  onProgress?: (progress: ExportProgress) => void;
}

export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodeQueue = 0;
  // Increased queue size for better throughput with hardware encoding
  private readonly MAX_ENCODE_QUEUE = 120;
  private videoDescription: Uint8Array | undefined;
  private videoColorSpace: VideoColorSpaceInit | undefined;
  // Track muxing promises for parallel processing
  private muxingPromises: Promise<void>[] = [];
  private chunkCount = 0;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  private getEffectiveDuration(totalDuration: number): number {
    return resolveExportDurationSeconds({
      sourceDurationSeconds: totalDuration,
      trimRegions: this.config.trimRegions,
      projectDurationMs: this.config.projectDurationMs,
    });
  }

  async export(): Promise<ExportResult> {
    try {
      this.cleanup();
      this.cancelled = false;

      // Initialize decoder and load video
      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      // Force dimensions to be multiples of 16 for universal encoder compatibility
      const safeWidth = Math.floor(this.config.width / 16) * 16;
      const safeHeight = Math.floor(this.config.height / 16) * 16;
      
      // Update config with safe dimensions so all subsequent components use the same sizes
      this.config.width = safeWidth;
      this.config.height = safeHeight;

      // Initialize frame renderer with safe, encoder-friendly dimensions
      this.renderer = new FrameRenderer({
        width: safeWidth,
        height: safeHeight,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        shadowIntensity: this.config.shadowIntensity,
        showBlur: this.config.showBlur,
        motionBlurEnabled: this.config.motionBlurEnabled,
        borderRadius: this.config.borderRadius,
        padding: this.config.padding,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
        annotationRegions: this.config.annotationRegions,
        previewWidth: this.config.previewWidth,
        previewHeight: this.config.previewHeight,
        cursorData: this.config.cursorData,
        cursorSize: this.config.cursorSize,
        cursorSmoothing: this.config.cursorSmoothing,
        showVectorCursor: this.config.showVectorCursor,
        cursorStyle: this.config.cursorStyle,
        cursorCustomImages: this.config.cursorCustomImages,
        cursorOffset: this.config.cursorOffset,
        cursorMediaDurationMs: videoInfo.duration * 1000,
      });
      await this.renderer.initialize();

      // Initialize video encoder
      await this.initializeEncoder();

      const totalDuration = videoInfo.duration;
      const effectiveDuration = this.getEffectiveDuration(totalDuration);
      
      const onProgress = this.config.onProgress || (() => {});

      // --- NEW: Audio Rendering and Encoding Phase ---
      let audioBuffer: AudioBuffer | null = null;
      try {
        console.log(`[VideoExporter] Starting offline audio mix...`);
        const mixer = new AudioMixerExporter(this.config, this.config.videoUrl);
        audioBuffer = await mixer.renderAudio(totalDuration);
      } catch (err) {
        console.error("[VideoExporter] Audio mixing failed", err);
      }

      const hasAudio = !!audioBuffer;
      console.log(`[VideoExporter] Audio processed. Has audio: ${hasAudio}`);

      let audioEncoder: AudioEncoderWrapper | null = null;
      let audioCodec = 'opus';

      if (audioBuffer) {
        console.log(`[VideoExporter] Initializing audio encoder...`);
        audioEncoder = new AudioEncoderWrapper(audioBuffer, (chunk, meta) => {
          this.muxingPromises.push(this.muxer!.addAudioChunk(chunk, meta));
        });
        await audioEncoder.initialize();
        audioCodec = audioEncoder.getCodec() === 'mp4a.40.2' ? 'aac' : 'opus';
      }
      // Initialize muxer with or without audio (now we know the exact audio codec)
      this.muxer = new VideoMuxer(this.config, hasAudio, audioCodec as any);
      await this.muxer.initialize();
      // --- END Audio Setup Phase ---

      const totalFrames = Math.floor(effectiveDuration * this.config.frameRate);

      console.log(`[VideoExporter] Original duration: ${totalDuration.toFixed(3)} s`);
      console.log(`[VideoExporter] Effective duration: ${effectiveDuration.toFixed(3)} s`);
      console.log(`[VideoExporter] Total frames to export: ${totalFrames}`);

      // --- NEW: Pause-and-Play Stepping Pipeline ---
      // This is a genius compromise: we use the blazing fast native stream decoder via play() 
      // but we PAUSE it instantly on every frame callback. This freezes the video's internal clock 
      // while we do heavy PIXI rendering, guaranteeing absolutely zero dropped frames without 
      // the catastrophic "take hours" overhead of seek().
      
      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not found. Please ensure the video is loaded properly.');
      }

      videoElement.muted = true;
      videoElement.playbackRate = 1.0; // Normal speed, we control pacing via pause/play

      const totalExpectedFrames = Math.floor(effectiveDuration * this.config.frameRate);
      let totalFramesExported = 0;
      let isExportingFrames = true;

      const reportFrameProgress = () => {
        if (totalFramesExported % 5 === 0) {
          onProgress({
            currentFrame: totalFramesExported,
            totalFrames: totalExpectedFrames,
            percentage: (totalFramesExported / totalExpectedFrames) * 100,
            estimatedTimeRemaining: 0,
          });
        }
      };

      const waitForEncoderBackpressure = async () => {
        if (this.encodeQueue < this.MAX_ENCODE_QUEUE) return;
        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };

      const encodeRenderedFrame = async (source: ImageBitmap | HTMLVideoElement, frameIndex: number) => {
        if (this.cancelled || !this.encoder || this.encoder.state === 'closed') return false;

        await this.renderer!.renderFrame(source, frameIndex * (1000000 / this.config.frameRate));

        const canvas = this.renderer!.getCanvas();
        const exportBitmap = await createImageBitmap(canvas);
        const timestampMicro = frameIndex * (1000000 / this.config.frameRate);
        const durationMicro = 1000000 / this.config.frameRate;

        const exportFrame = new VideoFrame(exportBitmap, {
          timestamp: Math.round(timestampMicro),
          duration: Math.round(durationMicro),
        });

        this.encoder.encode(exportFrame, { keyFrame: frameIndex === 0 });
        exportFrame.close();
        exportBitmap.close();
        this.encodeQueue++;
        return true;
      };

      const renderBlackTailFrames = async () => {
        if (totalFramesExported >= totalExpectedFrames) return;

        const blackCanvas = document.createElement('canvas');
        blackCanvas.width = videoInfo.width;
        blackCanvas.height = videoInfo.height;
        const blackCtx = blackCanvas.getContext('2d');
        if (!blackCtx) return;
        blackCtx.fillStyle = '#000000';
        blackCtx.fillRect(0, 0, blackCanvas.width, blackCanvas.height);

        const blackBitmap = await createImageBitmap(blackCanvas);
        try {
          while (!this.cancelled && totalFramesExported < totalExpectedFrames) {
            if (audioEncoder) {
              try {
                await audioEncoder.encodeUpTo(totalFramesExported / this.config.frameRate);
              } catch (e) {
                console.error("Audio encode tail step error:", e);
              }
            }

            await waitForEncoderBackpressure();
            const encoded = await encodeRenderedFrame(blackBitmap, totalFramesExported);
            if (!encoded) break;
            totalFramesExported++;
            reportFrameProgress();
          }
        } finally {
          blackBitmap.close();
        }
      };

      const processFrame = async (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
        if (this.cancelled) {
          isExportingFrames = false;
          return;
        }

        // 1. INSTANTLY pause to freeze the decoder clock! 
        // This ensures the video doesn't run ahead while we are busy rendering.
        videoElement.pause();

        const sourceTimeSec = metadata.mediaTime;
        
        // 2. Trim Skip Logic
        const trimRegions = this.config.trimRegions || [];
        let isTrimmed = false;
        let nextValidTime = -1;

        for (const trim of trimRegions) {
          const trimStartSec = trim.startMs / 1000;
          const trimEndSec = trim.endMs / 1000;
          if (sourceTimeSec >= trimStartSec && sourceTimeSec < trimEndSec) {
            isTrimmed = true;
            nextValidTime = trimEndSec;
            break;
          }
        }

        if (isTrimmed) {
          if (Math.abs(videoElement.currentTime - nextValidTime) > 0.1) {
             videoElement.currentTime = nextValidTime;
          }
          if (!videoElement.ended && isExportingFrames) {
            videoElement.requestVideoFrameCallback(processFrame);
            videoElement.play().catch(() => {});
          }
          return;
        }

        // 3. Throttle and Sync Time
        const effectiveTimeSec = this.mapSourceToEffectiveTime(sourceTimeSec);
        const expectedFrameIndex = Math.floor(effectiveTimeSec * this.config.frameRate);
        
        if (expectedFrameIndex > totalFramesExported) {
          if (audioEncoder) {
            try {
              await audioEncoder.encodeUpTo(effectiveTimeSec);
            } catch (e) {
              console.error("Audio encode step error:", e);
            }
          }

          // Backpressure: wait if encoder queue is getting too full
          await waitForEncoderBackpressure();

          if (this.cancelled || !this.encoder || this.encoder.state === 'closed') {
            isExportingFrames = false;
            return;
          }

          try {
            // Render the visual frame, potentially multiple times if the stream dropped a frame,
            // using strictly progressive virtual timestamps to guarantee butter-smooth animations!
            const sourceBitmap = await createImageBitmap(videoElement);
            
            const framesToFill = expectedFrameIndex - totalFramesExported;
            // Ensure we render at least once
            const count = Math.max(1, framesToFill);
            
            for (let i = 0; i < count; i++) {
              if (this.cancelled || !this.encoder) break;
              
              const currentExportIndex = totalFramesExported;
              const encoded = await encodeRenderedFrame(sourceBitmap, currentExportIndex);
              if (!encoded) break;

              totalFramesExported++;
            }
            
            sourceBitmap.close();

            // Update UI progress
            reportFrameProgress();
          } catch (e) {
            console.error("Frame processing error:", e);
          }
        }

        // 4. Resume decoding and request next frame!
        if (!videoElement.ended && isExportingFrames && totalFramesExported < totalExpectedFrames) {
          videoElement.requestVideoFrameCallback(processFrame);
          videoElement.play().catch(() => {});
        } else {
          isExportingFrames = false;
        }
      };

      // Kick off the loop
      videoElement.currentTime = 0;
      await new Promise<void>((resolve) => {
        videoElement.addEventListener('seeked', () => resolve(), { once: true });
      });

      videoElement.requestVideoFrameCallback(processFrame);
      videoElement.play().catch(console.error);

      // Block until exporting finishes or cancels
      while (isExportingFrames && !this.cancelled) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (videoElement.ended || totalFramesExported >= totalExpectedFrames) {
          isExportingFrames = false;
        }
      }

      videoElement.pause();
      await renderBlackTailFrames();
      
      if (this.cancelled) {
        return { success: false, error: 'Export cancelled' };
      }

      // --------------------------------------------------------

      // Wait for all frames to be encoded
      if (!this.encoder) {
        throw new Error('Video encoder was not initialized.');
      }
      await this.encoder.flush();
      
      if (audioEncoder) {
        // Encode any remaining audio tail and flush
        await audioEncoder.encodeUpTo(effectiveDuration);
        await audioEncoder.flush();
      }

      // Wait for all muxing promises to finish
      await Promise.all(this.muxingPromises);
      
      // Finalize the muxer
      const blob = await this.muxer!.finalize();
      
      // SANITY CHECK: Ensure we actually got data (not just headers)
      if (blob.size < 1024) {
        throw new Error('Export produced an empty file. This usually means the encoder failed silently.');
      }
      
      return { success: true, blob };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private handleEncodedChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) {
    if (!this.muxer || this.cancelled) return;

    // Capture decoder config metadata from encoder output
    if (meta?.decoderConfig?.description && !this.videoDescription) {
      const desc = meta.decoderConfig.description;
      this.videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
    }
    
    // Capture colorSpace
    if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
      this.videoColorSpace = meta.decoderConfig.colorSpace;
    }

    const isFirstChunk = this.chunkCount === 0;
    this.chunkCount++;

    const muxingPromise = (async () => {
      try {
        if (isFirstChunk && this.videoDescription) {
          const colorSpace = this.videoColorSpace || {
            primaries: 'bt709',
            transfer: 'iec61966-2-1',
            matrix: 'rgb',
            fullRange: true,
          };

          const metadata: EncodedVideoChunkMetadata = {
            decoderConfig: {
              codec: this.config.codec || 'avc1.4D4028',
              codedWidth: this.config.width,
              codedHeight: this.config.height,
              description: this.videoDescription,
              colorSpace,
            },
          };

          await this.muxer!.addVideoChunk(chunk, metadata);
        } else {
          await this.muxer!.addVideoChunk(chunk, meta);
        }
      } catch (error) {
        console.error('Muxing error:', error);
      }
    })();

    this.muxingPromises.push(muxingPromise);
    this.encodeQueue--;
  }

  private async initializeEncoder(): Promise<void> {
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    this.videoDescription = undefined;
    this.videoColorSpace = undefined;

    // Force dimensions to be multiples of 16
    const exportWidth = Math.floor(this.config.width / 16) * 16;
    const exportHeight = Math.floor(this.config.height / 16) * 16;
    
    console.log(`[VideoExporter] Initializing encoder for ${exportWidth}x${exportHeight}`);

    const tryConfigure = async (currentCodec: string, hw: HardwareAcceleration): Promise<boolean> => {
      return new Promise(async (resolve) => {
        let isResolved = false;
        let testFrameEncoded = false;

        const encoder = new VideoEncoder({
          output: (chunk, meta) => {
            if (!testFrameEncoded) {
              // TEST FRAME SUCCESS!
              // CRITICAL: We MUST capture the decoder config here because the encoder 
              // often only emits it on the very first frame (which is this test frame).
              if (meta?.decoderConfig?.description && !this.videoDescription) {
                const desc = meta.decoderConfig.description;
                this.videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
              }
              if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
                this.videoColorSpace = meta.decoderConfig.colorSpace;
              }

              testFrameEncoded = true;
              if (!isResolved) {
                this.encoder = encoder;
                isResolved = true;
                resolve(true);
              }
            } else {
              // Route real frames to the muxer
              this.handleEncodedChunk(chunk, meta);
            }
          },
          error: (err) => {
            console.warn(`[VideoExporter] Test frame failed for ${hw}/${currentCodec}:`, err);
            if (!isResolved) {
              isResolved = true;
              resolve(false);
            }
          },
        });

        const encoderConfig: VideoEncoderConfig = {
          codec: currentCodec,
          width: exportWidth,
          height: exportHeight,
          bitrate: Math.min(this.config.bitrate, 10_000_000),
          framerate: this.config.frameRate,
          hardwareAcceleration: hw,
        };

        try {
          const support = await VideoEncoder.isConfigSupported(encoderConfig);
          if (support.supported && support.config) {
            console.log(`[VideoExporter] Testing ${hw} with ${currentCodec}...`);
            encoder.configure(support.config);
            
            // --- TEST DRIVE ---
            // Create a tiny black canvas for a test frame
            const testCanvas = document.createElement('canvas');
            testCanvas.width = exportWidth;
            testCanvas.height = exportHeight;
            const testCtx = testCanvas.getContext('2d')!;
            testCtx.fillStyle = 'black';
            testCtx.fillRect(0, 0, exportWidth, exportHeight);

            const testFrame = new VideoFrame(testCanvas, {
              timestamp: 0,
              duration: 1000,
            });

            encoder.encode(testFrame, { keyFrame: true });
            testFrame.close();
            await encoder.flush();

            // The 'output' or 'error' callback will resolve the promise
          } else {
            resolve(false);
          }
        } catch (e) {
          console.warn(`[VideoExporter] Config rejection for ${hw}/${currentCodec}:`, e);
          resolve(false);
        }

        // Safety timeout in case flush() hangs
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            resolve(false);
          }
        }, 2000);
      });
    };

    // Retry Strategy (Hardware High -> Hardware Baseline -> Software Baseline)
    const configs = [
      { codec: 'avc1.640028', hw: 'prefer-hardware' as const }, // High 4.0
      { codec: 'avc1.4D4028', hw: 'prefer-hardware' as const }, // Main 4.0
      { codec: 'avc1.42E028', hw: 'prefer-hardware' as const }, // Baseline 4.0
      { codec: 'avc1.42E028', hw: 'prefer-software' as const }, // Software Baseline
    ];

    for (const conf of configs) {
      if (await tryConfigure(conf.codec, conf.hw)) {
        console.log(`[VideoExporter] Selected stable config: ${conf.hw} / ${conf.codec}`);
        return;
      }
    }

    throw new Error('Video encoding not supported on this system.');
  }

  cancel(): void {
    this.cancelled = true;
  }

  private cleanup(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state !== 'closed') this.encoder.close();
      } catch (e) {}
      this.encoder = null;
    }
    if (this.decoder) {
      this.decoder.destroy();
      this.decoder = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    this.muxer = null;
  }

  private mapSourceToEffectiveTime(sourceTimeSec: number): number {
    const trimRegions = this.config.trimRegions || [];
    let effectiveTime = sourceTimeSec;
    
    for (const trim of trimRegions) {
      const trimStart = trim.startMs / 1000;
      const trimEnd = trim.endMs / 1000;
      
      if (sourceTimeSec > trimEnd) {
        effectiveTime -= (trimEnd - trimStart);
      } else if (sourceTimeSec > trimStart) {
        effectiveTime -= (sourceTimeSec - trimStart);
      }
    }
    
    return Math.max(0, effectiveTime);
  }
}
