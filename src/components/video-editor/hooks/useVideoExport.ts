import * as React from "react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { VideoExporter, type ExportProgress, type ExportQuality } from "../../../lib/exporter";
import { getAspectRatioValue, type AspectRatio } from "../../../utils/aspectRatioUtils";
import { toFileUrl } from "../../../utils/pathUtils";
import { 
  type ZoomRegion, 
  type TrimRegion, 
  type AnnotationRegion, 
  type AudioRegion,
  type CropRegion 
} from "../types";

interface UseVideoExportProps {
  videoPath: string | null;
  videoPlaybackRef: React.RefObject<any>;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  annotationRegions: AnnotationRegion[];
  audioRegions: AudioRegion[];
  cropRegion: CropRegion;
  aspectRatio: AspectRatio;
  exportQuality: ExportQuality;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled: boolean;
  borderRadius: number;
  padding: number;
  setIsExporting: (exporting: boolean) => void;
  setExportProgress: (progress: ExportProgress | null) => void;
  setExportError: (error: string | null) => void;
  setShowExportDialog: (show: boolean) => void;
  isPlaying: boolean;
}

export function useVideoExport({
  videoPath,
  videoPlaybackRef,
  wallpaper,
  zoomRegions,
  trimRegions,
  annotationRegions,
  audioRegions,
  cropRegion,
  aspectRatio,
  exportQuality,
  shadowIntensity,
  showBlur,
  motionBlurEnabled,
  borderRadius,
  padding,
  setIsExporting,
  setExportProgress,
  setExportError,
  setShowExportDialog,
  isPlaying,
}: UseVideoExportProps) {
  const exporterRef = useRef<VideoExporter | null>(null);

  const handleExport = useCallback(async () => {
    if (!videoPath) {
      toast.error('No video loaded');
      return;
    }

    const video = videoPlaybackRef.current?.video;
    if (!video) {
      toast.error('Video not ready');
      return;
    }

    setShowExportDialog(true);
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);

    try {
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        videoPlaybackRef.current?.pause();
      }

      const aspectRatioValue = getAspectRatioValue(aspectRatio);
      const sourceWidth = video.videoWidth || 1920;
      const sourceHeight = video.videoHeight || 1080;

      let exportWidth: number;
      let exportHeight: number;
      let bitrate: number;

      if (exportQuality === 'source') {
        exportWidth = sourceWidth;
        exportHeight = sourceHeight;
        if (aspectRatioValue === 1) {
          const baseDimension = Math.floor(Math.min(sourceWidth, sourceHeight) / 2) * 2;
          exportWidth = baseDimension;
          exportHeight = baseDimension;
        } else if (aspectRatioValue > 1) {
          const baseWidth = Math.floor(sourceWidth / 2) * 2;
          let found = false;
          for (let w = baseWidth; w >= 100 && !found; w -= 2) {
            const h = Math.round(w / aspectRatioValue);
            if (h % 2 === 0 && Math.abs((w / h) - aspectRatioValue) < 0.0001) {
              exportWidth = w; exportHeight = h; found = true;
            }
          }
          if (!found) { exportWidth = baseWidth; exportHeight = Math.floor((baseWidth / aspectRatioValue) / 2) * 2; }
        } else {
          const baseHeight = Math.floor(sourceHeight / 2) * 2;
          let found = false;
          for (let h = baseHeight; h >= 100 && !found; h -= 2) {
            const w = Math.round(h * aspectRatioValue);
            if (w % 2 === 0 && Math.abs((w / h) - aspectRatioValue) < 0.0001) {
              exportWidth = w; exportHeight = h; found = true;
            }
          }
          if (!found) { exportHeight = baseHeight; exportWidth = Math.floor((baseHeight * aspectRatioValue) / 2) * 2; }
        }

        const totalPixels = exportWidth * exportHeight;
        bitrate = 30_000_000;
        if (totalPixels > 1920 * 1080 && totalPixels <= 2560 * 1440) bitrate = 50_000_000;
        else if (totalPixels > 2560 * 1440) bitrate = 80_000_000;
      } else {
        const targetHeight = exportQuality === 'medium' ? 720 : 1080;
        exportHeight = Math.floor(targetHeight / 2) * 2;
        exportWidth = Math.floor((exportHeight * aspectRatioValue) / 2) * 2;
        const totalPixels = exportWidth * exportHeight;
        if (totalPixels <= 1280 * 720) bitrate = 10_000_000;
        else if (totalPixels <= 1920 * 1080) bitrate = 20_000_000;
        else bitrate = 30_000_000;
      }

      const playbackRef = videoPlaybackRef.current;
      const containerElement = playbackRef?.containerRef?.current;
      const previewWidth = containerElement?.clientWidth || 1920;
      const previewHeight = containerElement?.clientHeight || 1080;

      const exporter = new VideoExporter({
        videoUrl: toFileUrl(videoPath),
        width: exportWidth,
        height: exportHeight,
        frameRate: 30, // 30fps is much faster and usually sufficient
        bitrate: Math.min(bitrate, 15_000_000), // Cap bitrate for better compatibility
        wallpaper,
        zoomRegions,
        trimRegions,
        annotationRegions,
        audioRegions,
        showShadow: shadowIntensity > 0,
        shadowIntensity,
        showBlur,
        motionBlurEnabled,
        borderRadius,
        padding,
        cropRegion,
        previewWidth,
        previewHeight,
        onProgress: (progress: ExportProgress) => setExportProgress(progress),
      });

      exporterRef.current = exporter;
      const result = await exporter.export();

      if (result.success && result.blob) {
        const arrayBuffer = await result.blob.arrayBuffer();
        const fileName = `export-${Date.now()}.mp4`;
        const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);
        if (saveResult.cancelled) toast.info('Export cancelled');
        else if (saveResult.success) toast.success(`Video exported successfully to ${saveResult.path}`);
        else { setExportError(saveResult.message || 'Failed to save video'); toast.error(saveResult.message || 'Failed to save video'); }
      } else {
        setExportError(result.error || 'Export failed');
        toast.error(result.error || 'Export failed');
      }

      if (wasPlaying) videoPlaybackRef.current?.play();
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportError(errorMessage);
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
      exporterRef.current = null;
    }
  }, [videoPath, wallpaper, zoomRegions, trimRegions, shadowIntensity, showBlur, motionBlurEnabled, borderRadius, padding, cropRegion, annotationRegions, isPlaying, aspectRatio, exportQuality, videoPlaybackRef, setIsExporting, setExportProgress, setExportError, setShowExportDialog]);

  const handleCancelExport = useCallback(() => {
    if (exporterRef.current) {
      exporterRef.current.cancel();
      toast.info('Export cancelled');
      setShowExportDialog(false);
      setIsExporting(false);
      setExportProgress(null);
      setExportError(null);
    }
  }, [setShowExportDialog, setIsExporting, setExportProgress, setExportError]);

  return { handleExport, handleCancelExport };
}
