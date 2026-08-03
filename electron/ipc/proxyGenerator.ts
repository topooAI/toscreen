import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import * as path from 'path';
import * as fs from 'fs';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface ProxyResult {
  success: boolean;
  proxyPath?: string;
  error?: string;
}

const PROXY_TIMELINE_VERSION = 4;

interface ProxyMetadata {
  timelineVersion: number;
  sourceSize: number;
  sourceMtimeMs: number;
}

interface ProxyGenerationJob {
  promise: Promise<ProxyResult>;
  progressListeners: Set<(percent: number) => void>;
}

const activeProxyJobs = new Map<string, ProxyGenerationJob>();

function metadataPathForProxy(proxyPath: string): string {
  return `${proxyPath}.meta.json`;
}

function hasCurrentProxyMetadata(inputPath: string, proxyPath: string): boolean {
  try {
    if (!fs.existsSync(proxyPath)) return false;

    const sourceStat = fs.statSync(inputPath);
    const metadata = JSON.parse(
      fs.readFileSync(metadataPathForProxy(proxyPath), 'utf8'),
    ) as ProxyMetadata;

    return metadata.timelineVersion === PROXY_TIMELINE_VERSION
      && metadata.sourceSize === sourceStat.size
      && Math.abs(metadata.sourceMtimeMs - sourceStat.mtimeMs) < 1;
  } catch {
    return false;
  }
}

function writeProxyMetadata(inputPath: string, proxyPath: string): void {
  const sourceStat = fs.statSync(inputPath);
  const metadata: ProxyMetadata = {
    timelineVersion: PROXY_TIMELINE_VERSION,
    sourceSize: sourceStat.size,
    sourceMtimeMs: sourceStat.mtimeMs,
  };
  fs.writeFileSync(metadataPathForProxy(proxyPath), JSON.stringify(metadata, null, 2));
}

export function generateProxyVideo(
  inputPath: string, 
  onProgress?: (percent: number) => void
): Promise<ProxyResult> {
  const parsedPath = path.parse(inputPath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-proxy.mp4`);

  if (hasCurrentProxyMetadata(inputPath, outputPath)) {
    console.log(`[ProxyGenerator] Proxy already exists at ${outputPath}`);
    return Promise.resolve({ success: true, proxyPath: outputPath });
  }

  const activeJob = activeProxyJobs.get(outputPath);
  if (activeJob) {
    if (onProgress) activeJob.progressListeners.add(onProgress);
    console.log(`[ProxyGenerator] Reusing active proxy generation for ${inputPath}`);
    return activeJob.promise;
  }

  const progressListeners = new Set<(percent: number) => void>();
  if (onProgress) progressListeners.add(onProgress);

  const promise = new Promise<ProxyResult>((resolve) => {
    try {
      const temporaryOutputPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}-proxy.building-${process.pid}.mp4`,
      );

      const metadataPath = metadataPathForProxy(outputPath);
      if (fs.existsSync(metadataPath)) fs.unlinkSync(metadataPath);
      if (fs.existsSync(temporaryOutputPath)) fs.unlinkSync(temporaryOutputPath);

      console.log(`[ProxyGenerator] Starting proxy generation for ${inputPath} -> ${outputPath}`);

      let settled = false;
      ffmpeg(inputPath)
        .videoFilters('fps=fps=30:start_time=0:round=near,setpts=PTS-STARTPTS')
        .outputOptions([
          '-c:v libx264',   // H264 codec for max web compatibility
          '-crf 23',        // Better quality for editing preview
          '-preset ultrafast', // Fastest encoding speed
          '-vsync cfr',     // Preserve a deterministic 30fps media timeline
          '-c:a aac',       // AAC audio
          '-b:a 128k',      // Basic audio bitrate
          '-pix_fmt yuv420p'// Standard pixel format for HTML5 video
        ])
        .on('progress', (progress) => {
          if (progress.percent) {
            const percent = Math.floor(progress.percent);
            progressListeners.forEach((listener) => listener(percent));
          }
        })
        .on('end', () => {
          if (settled) return;
          settled = true;
          try {
            fs.renameSync(temporaryOutputPath, outputPath);
            writeProxyMetadata(inputPath, outputPath);
            console.log(`[ProxyGenerator] Successfully generated proxy at ${outputPath}`);
            resolve({ success: true, proxyPath: outputPath });
          } catch (error) {
            if (fs.existsSync(temporaryOutputPath)) fs.unlinkSync(temporaryOutputPath);
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[ProxyGenerator] Failed to finalize proxy:`, error);
            resolve({ success: false, error: message });
          }
        })
        .on('error', (err) => {
          if (settled) return;
          settled = true;
          if (fs.existsSync(temporaryOutputPath)) fs.unlinkSync(temporaryOutputPath);
          console.error(`[ProxyGenerator] Error generating proxy:`, err);
          resolve({ success: false, error: err.message });
        })
        .save(temporaryOutputPath);
    } catch (error) {
      console.error(`[ProxyGenerator] Exception:`, error);
      resolve({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  activeProxyJobs.set(outputPath, { promise, progressListeners });
  void promise.finally(() => {
    if (activeProxyJobs.get(outputPath)?.promise === promise) {
      activeProxyJobs.delete(outputPath);
    }
  });

  return promise;
}
