import React, { useState, useRef } from "react";
import { 
  DEFAULT_CROP_REGION, 
  type ZoomRegion, 
  type TrimRegion, 
  type AnnotationRegion, 
  type CropRegion,
} from "../types";
import { type AspectRatio } from "../../../utils/aspectRatioUtils";
import { type ExportProgress, type ExportQuality } from "../../../lib/exporter";

const WALLPAPER_COUNT = 18;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export function useEditorState() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string>(WALLPAPER_PATHS[0]);
  const [shadowIntensity, setShadowIntensity] = useState(0.6);
  const [showBlur, setShowBlur] = useState(false);
  const [motionBlurEnabled, setMotionBlurEnabled] = useState(true);
  const [borderRadius, setBorderRadius] = useState(20);
  const [padding, setPadding] = useState(60);
  const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
  const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [annotationRegions, setAnnotationRegions] = useState<AnnotationRegion[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('good');
  const [isFullScreenBinding, setIsFullScreenBinding] = useState(true);

  // Refs
  const nextZoomIdRef = useRef(1);
  const nextTrimIdRef = useRef(1);
  const nextAnnotationIdRef = useRef(1);
  const nextAnnotationZIndexRef = useRef(1);

  return {
    // Basic Info
    videoPath, setVideoPath,
    loading, setLoading,
    error, setError,
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    
    // Visual Styles
    wallpaper, setWallpaper,
    shadowIntensity, setShadowIntensity,
    showBlur, setShowBlur,
    motionBlurEnabled, setMotionBlurEnabled,
    borderRadius, setBorderRadius,
    padding, setPadding,
    aspectRatio, setAspectRatio,
    isFullScreenBinding, setIsFullScreenBinding,
    
    // Regions
    cropRegion, setCropRegion,
    zoomRegions, setZoomRegions,
    selectedZoomId, setSelectedZoomId,
    trimRegions, setTrimRegions,
    selectedTrimId, setSelectedTrimId,
    annotationRegions, setAnnotationRegions,
    selectedAnnotationId, setSelectedAnnotationId,
    
    // Export State
    isExporting, setIsExporting,
    exportProgress, setExportProgress,
    exportError, setExportError,
    showExportDialog, setShowExportDialog,
    exportQuality, setExportQuality,

    // ID Counters (Refs)
    nextZoomIdRef,
    nextTrimIdRef,
    nextAnnotationIdRef,
    nextAnnotationZIndexRef,

    // Constants
    WALLPAPER_PATHS
  };
}
