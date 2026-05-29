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

export function generateProxyVideo(
  inputPath: string, 
  onProgress?: (percent: number) => void
): Promise<ProxyResult> {
  return new Promise((resolve) => {
    try {
      const parsedPath = path.parse(inputPath);
      const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-proxy.mp4`);

      // If it already exists, just return it (e.g. re-opening the same project)
      if (fs.existsSync(outputPath)) {
        console.log(`[ProxyGenerator] Proxy already exists at ${outputPath}`);
        resolve({ success: true, proxyPath: outputPath });
        return;
      }

      console.log(`[ProxyGenerator] Starting proxy generation for ${inputPath} -> ${outputPath}`);

      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',   // H264 codec for max web compatibility
          '-crf 23',        // Better quality for editing preview
          '-preset ultrafast', // Fastest encoding speed
          '-r 30',          // Limit to 30fps for UI performance
          '-c:a aac',       // AAC audio
          '-b:a 128k',      // Basic audio bitrate
          '-pix_fmt yuv420p'// Standard pixel format for HTML5 video
        ])
        .on('progress', (progress) => {
          if (progress.percent && onProgress) {
            onProgress(Math.floor(progress.percent));
          }
        })
        .on('end', () => {
          console.log(`[ProxyGenerator] Successfully generated proxy at ${outputPath}`);
          resolve({ success: true, proxyPath: outputPath });
        })
        .on('error', (err) => {
          console.error(`[ProxyGenerator] Error generating proxy:`, err);
          resolve({ success: false, error: err.message });
        })
        .save(outputPath);
    } catch (error) {
      console.error(`[ProxyGenerator] Exception:`, error);
      resolve({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}
