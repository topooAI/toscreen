import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion, TrimRegion, AnnotationRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
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
  previewWidth?: number;
  previewHeight?: number;
  cursorData?: any[];
  cursorSize?: number;
  cursorSmoothing?: boolean;
  showVectorCursor?: boolean;
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

  // Calculate the total duration excluding trim regions (in seconds)
  private getEffectiveDuration(totalDuration: number): number {
    const trimRegions = this.config.trimRegions || [];
    const totalTrimDuration = trimRegions.reduce((sum, region) => {
      return sum + (region.endMs - region.startMs) / 1000;
    }, 0);
    return totalDuration - totalTrimDuration;
  }

  private mapEffectiveToSourceTime(effectiveTimeMs: number): number {
    const trimRegions = this.config.trimRegions || [];
    // Sort trim regions by start time
    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);

    let sourceTimeMs = effectiveTimeMs;

    for (const trim of sortedTrims) {
      // If the source time hasn't reached this trim region yet, we're done
      if (sourceTimeMs < trim.startMs) {
        break;
      }

      // Add the duration of this trim region to the source time
      const trimDuration = trim.endMs - trim.startMs;
      sourceTimeMs += trimDuration;
    }

    return sourceTimeMs;
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
        cursorOffset: this.config.cursorOffset,
      });
      await this.renderer.initialize();

      // Initialize video encoder
      await this.initializeEncoder();

      // Initialize muxer
      this.muxer = new VideoMuxer(this.config, false);
      await this.muxer.initialize();

      const totalDuration = videoInfo.duration;
      const effectiveDuration = this.getEffectiveDuration(totalDuration);
      const frameDuration = 1 / this.config.frameRate;
      const totalFrames = Math.floor(effectiveDuration * this.config.frameRate);
      const startTime = 0;

      console.log(`[VideoExporter] Original duration: ${totalDuration.toFixed(3)} s`);
      console.log(`[VideoExporter] Effective duration: ${effectiveDuration.toFixed(3)} s`);
      console.log(`[VideoExporter] Total frames to export: ${totalFrames}`);

      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) throw new Error('Video element not found');

      const onProgress = this.config.onProgress || (() => {});

      // --- PROACTIVE STATE CHECK ---
      if (!this.encoder || this.encoder.state === 'closed') {
        throw new Error('Encoder failed to initialize properly.');
      }

      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelled) {
          return { success: false, error: 'Export cancelled' };
        }

        const videoTime = (i / this.config.frameRate) + startTime;
        const timestamp = i * frameDuration * 1_000_000; // in microseconds
        const sourceTimeMs = (videoTime * 1000);
           
        // Seek if needed or wait for first frame to be ready
        const needsSeek = Math.abs(videoElement.currentTime - videoTime) > 0.001;

        if (needsSeek) {
          const seekedPromise = new Promise<void>(resolve => {
            videoElement.addEventListener('seeked', () => resolve(), { once: true });
          });
          videoElement.currentTime = videoTime;
          await seekedPromise;
        }

        // --- CRITICAL WAIT: Ensure video actually has pixel data ---
        if (videoElement.readyState < 2) { // 2 = HAVE_CURRENT_DATA
          await new Promise<void>(resolve => {
            const onReady = () => {
              videoElement.removeEventListener('loadeddata', onReady);
              videoElement.removeEventListener('canplay', onReady);
              resolve();
            };
            videoElement.addEventListener('loadeddata', onReady);
            videoElement.addEventListener('canplay', onReady);
          });
        }

        // For the very first frame, use requestVideoFrameCallback for absolute guarantee
        // that the frame is painted in the browser's compositor.
        if (i === 0 && 'requestVideoFrameCallback' in videoElement) {
          await new Promise<void>(resolve => {
            videoElement.requestVideoFrameCallback(() => resolve());
          });
        }

        // Final check before rendering
        if (!this.encoder || this.encoder.state === 'closed') {
          throw new Error(`Encoder died unexpectedly at frame ${i + 1}`);
        }

        // Capture a static snapshot of the current video frame using ImageBitmap
        // This completely bypasses PixiJS's unstable VideoResource management during rapid seeking.
        const sourceBitmap = await createImageBitmap(videoElement);

        // Render the frame with all effects using source timestamp
        const sourceTimestamp = sourceTimeMs * 1000; // Convert to microseconds
        await this.renderer!.renderFrame(sourceBitmap, sourceTimestamp);
        
        // Clean up the source bitmap to prevent memory leaks
        sourceBitmap.close();

        const canvas = this.renderer!.getCanvas();
        
        // Final sanity check before encoding
        if (this.encoder.state === 'closed') {
          throw new Error('Encoder closed before it could process the frame');
        }

        // Use ImageBitmap for safer and more stable frame capture (OpenScreen style)
        const exportBitmap = await createImageBitmap(canvas);
        const exportFrame = new VideoFrame(exportBitmap, {
          timestamp: Math.round(timestamp),
          duration: Math.round(frameDuration * 1_000_000),
        });

        // FORCE the first real frame to be a keyframe. 
        // The encoder might have used its natural keyframe interval during the test-drive.
        this.encoder.encode(exportFrame, { keyFrame: i === 0 });
        
        exportFrame.close();
        exportBitmap.close();

        // Control queue depth to avoid OOM
        this.encodeQueue++;
        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }

        onProgress({
          percent: Math.round(((i + 1) / totalFrames) * 100),
          currentFrame: i + 1,
          totalFrames,
          percentage: (i + 1) / totalFrames * 100,
          estimatedTimeRemaining: 0,
        });
      }

      // Wait for all frames to be encoded
      await this.encoder.flush();
      
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
}
