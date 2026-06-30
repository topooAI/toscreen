import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import VideoPlayback, { type VideoPlaybackRef } from "./VideoPlayback";
import TimelineEditor from "./timeline/TimelineEditor";
import { Sidebar } from "./sidebar/Sidebar";
import { ExportDialog } from "./ExportDialog";

import type { Span } from "dnd-timeline";
import { useAudioMixer } from "./hooks/useAudioMixer";
import {
  DEFAULT_ZOOM_DEPTH,
  clampFocusToDepth,
  DEFAULT_CROP_REGION,
  DEFAULT_ANNOTATION_POSITION,
  DEFAULT_ANNOTATION_SIZE,
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_FIGURE_DATA,
  type ZoomDepth,
  type ZoomFocus,
  type ZoomRegion,
  type TrimRegion,
  type AnnotationRegion,
  type CropRegion,
  type FigureData,
  type AudioRegion,
  type VolumeKeyframe,
} from "./types";
import { generateAutoZooms } from "@/lib/autoZoom/generator";
import { VideoExporter, type ExportProgress, type ExportQuality } from "@/lib/exporter";
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { getAssetPath } from "@/lib/assetPath";
import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
} from "./project";

const WALLPAPER_COUNT = 18;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [originalVideoPath, setOriginalVideoPath] = useState<string | null>(null);
  const [companionAudioPath, setCompanionAudioPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);

  // HEALER: Automatically fix corrupted audio regions trapped in memory
  useEffect(() => {
    if (audioRegions && audioRegions.length > 0) {
      let needsFix = false;
      const fixedRegions = audioRegions.map(r => {
        let newR = { ...r };
        if (newR.startMs < 0 || newR.startMs > 10000000 || isNaN(newR.startMs)) {
          newR.startMs = 0;
          newR.endMs = 5000;
          needsFix = true;
        }
        if (newR.endMs < newR.startMs || isNaN(newR.endMs)) {
          newR.endMs = newR.startMs + 5000;
          needsFix = true;
        }
        
        // Dynamically fix isOriginal: original companion audio has path matching companionAudioPath or recorded pattern
        const isActuallyOriginal = companionAudioPath 
          ? (newR.path === companionAudioPath)
          : (newR.isOriginal === true && (newR.name?.startsWith('temp_audio_') || newR.name === 'Recorded Audio'));

        if (newR.isOriginal !== isActuallyOriginal) {
          newR.isOriginal = isActuallyOriginal;
          needsFix = true;
        }

        if (newR.isDetached === undefined) {
          newR.isDetached = false;
          needsFix = true;
        }
        
        return newR;
      });

      if (needsFix) {
        setAudioRegions(fixedRegions);
      }
    }
  }, [audioRegions, companionAudioPath]);

  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const handleSeparateAudio = useCallback(() => {
    const originalAudio = audioRegions.find(r => r.isOriginal && !r.isDetached);
    if (!originalAudio) {
      toast.error("没有可分离的原声轨");
      return;
    }

    const totalMs = Math.max(0, Math.round(duration * 1000));
    if (totalMs <= 0) return;

    // Helper: Map source time to effective timeline
    const mapSourceToEffective = (sourceMs: number) => {
      const sorted = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
      let activeTrimMs = 0;
      for (const trim of sorted) {
        if (sourceMs <= trim.startMs) break;
        if (sourceMs >= trim.endMs) {
          activeTrimMs += (trim.endMs - trim.startMs);
        } else {
          activeTrimMs += (sourceMs - trim.startMs);
        }
      }
      return Math.max(0, sourceMs - activeTrimMs);
    };

    // Calculate active clips based on trimRegions (like mainClips in TimelineEditor)
    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
    const clips: { start: number; end: number }[] = [];
    let currentSourceStart = 0;

    sortedTrims.forEach((trim) => {
      if (currentSourceStart < trim.startMs) {
        clips.push({ start: currentSourceStart, end: trim.startMs });
      }
      currentSourceStart = trim.endMs;
    });

    if (currentSourceStart < totalMs) {
      clips.push({ start: currentSourceStart, end: totalMs });
    }

    // Generate detached clips
    const newDetachedClips: AudioRegion[] = clips.map((clip, index) => {
      const clipDuration = clip.end - clip.start;
      
      // Filter keyframes that fall within this clip's time range, and re-offset/scale them to new ratio
      const clipKeyframes = (originalAudio.volumeKeyframes || [])
        .map(kf => {
          const absoluteTimeMs = kf.timeRatio * (originalAudio.totalDurationMs || totalMs);
          return { kf, absoluteTimeMs };
        })
        .filter(({ absoluteTimeMs }) => absoluteTimeMs >= clip.start && absoluteTimeMs <= clip.end)
        .map(({ kf, absoluteTimeMs }) => ({
          ...kf,
          timeRatio: clipDuration > 0 ? (absoluteTimeMs - clip.start) / clipDuration : 0
        }));

      return {
        id: crypto.randomUUID(),
        startMs: mapSourceToEffective(clip.start),
        endMs: mapSourceToEffective(clip.end),
        sourceStartMs: clip.start,
        sourceEndMs: clip.end,
        totalDurationMs: originalAudio.totalDurationMs || totalMs,
        sourceUrl: originalAudio.sourceUrl,
        volume: originalAudio.volume,
        volumeKeyframes: clipKeyframes,
        name: clips.length > 1 ? `原声片段 ${index + 1}` : "分离原声",
        path: originalAudio.path,
        isOriginal: true,
        isDetached: true,
      };
    });

    // Replace the old original audio with new detached clips
    setAudioRegions(prev => [
      ...prev.filter(r => !(r.isOriginal && !r.isDetached)),
      ...newDetachedClips
    ]);

    toast.success(clips.length > 1 ? `原声成功裂变分离为 ${clips.length} 个片段并下沉` : "原声音频已成功分离并下沉至独立音轨");
    setSelectedVideoId(null);
  }, [audioRegions, duration, trimRegions]);

  // Premium Cursor Customization Settings (Screen Studio parity)
  const [cursorSize, setCursorSize] = useState(1.5);
  const [cursorSmoothing, setCursorSmoothing] = useState(true);
  const [showVectorCursor, setShowVectorCursor] = useState(true);
  const [cursorOffset, setCursorOffset] = useState(-180);
  const [cursorData, setCursorData] = useState<any[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [exportQuality, setExportQuality] = useState<ExportQuality>('good');
  const [isFullScreenBinding, setIsFullScreenBinding] = useState(true);

  const projectDuration = useMemo(() => Math.max(
    duration,
    ...annotationRegions.map((region) => region.endMs / 1000),
    ...audioRegions
      .filter((region) => !region.isOriginal || region.isDetached)
      .map((region) => region.endMs / 1000),
  ), [duration, annotationRegions, audioRegions]);

  const currentProjectModel = useMemo(() => createProjectFromLegacyEditorState({
    videoPath,
    originalVideoPath,
    companionAudioPath,
    durationSeconds: duration,
    projectDurationSeconds: projectDuration,
    zoomRegions,
    trimRegions,
    annotationRegions,
    audioRegions,
    cursorData,
    cursorSize,
    cursorSmoothing,
    showVectorCursor,
    cursorOffset,
    cropRegion,
    wallpaper,
    shadowIntensity,
    showBlur,
    motionBlurEnabled,
    borderRadius,
    padding,
    aspectRatio,
    exportQuality,
  }), [
    videoPath,
    originalVideoPath,
    companionAudioPath,
    duration,
    projectDuration,
    zoomRegions,
    trimRegions,
    annotationRegions,
    audioRegions,
    cursorData,
    cursorSize,
    cursorSmoothing,
    showVectorCursor,
    cursorOffset,
    cropRegion,
    wallpaper,
    shadowIntensity,
    showBlur,
    motionBlurEnabled,
    borderRadius,
    padding,
    aspectRatio,
    exportQuality,
  ]);

  const currentRenderSettings = useMemo(
    () => getProjectRenderSettings(currentProjectModel),
    [currentProjectModel],
  );

  const currentTimeStateRef = useRef(currentTime);
  const timelineResizeLockRef = useRef(0);
  const projectClockRef = useRef<number | null>(null);
  const projectClockBaseRef = useRef({ startedAt: 0, startTime: 0 });

  useEffect(() => {
    currentTimeStateRef.current = currentTime;
  }, [currentTime]);

  const handleTimelineResizeStart = useCallback(() => {
    timelineResizeLockRef.current += 1;
  }, []);

  const handleTimelineResizeEnd = useCallback(() => {
    timelineResizeLockRef.current = Math.max(0, timelineResizeLockRef.current - 1);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (projectClockRef.current !== null) {
        cancelAnimationFrame(projectClockRef.current);
        projectClockRef.current = null;
      }
      return;
    }

    const startTime = Math.min(Math.max(currentTimeStateRef.current, 0), Math.max(projectDuration, 0));
    projectClockBaseRef.current = {
      startedAt: performance.now(),
      startTime,
    };

    const tick = () => {
      const { startedAt, startTime } = projectClockBaseRef.current;
      const nextTime = startTime + (performance.now() - startedAt) / 1000;
      const clampedTime = Math.min(nextTime, projectDuration);

      setCurrentTime(clampedTime);

      const video = videoPlaybackRef.current?.video;
      if (video && duration > 0 && clampedTime < duration && video.paused) {
        videoPlaybackRef.current?.play().catch(() => {});
      }

      if (clampedTime >= projectDuration) {
        setIsPlaying(false);
        videoPlaybackRef.current?.pause();
        projectClockRef.current = null;
        return;
      }

      projectClockRef.current = requestAnimationFrame(tick);
    };

    projectClockRef.current = requestAnimationFrame(tick);

    return () => {
      if (projectClockRef.current !== null) {
        cancelAnimationFrame(projectClockRef.current);
        projectClockRef.current = null;
      }
    };
  }, [isPlaying, projectDuration, duration]);

  // Web Audio Mixer for additional audio tracks
  useAudioMixer({ 
    audioRegions, 
    isPlaying, 
    currentTime 
  });

  const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
  // Stable ref to the underlying <video> element for direct DOM reads (perf: bypasses React state)
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const nextZoomIdRef = useRef(1);
  const nextTrimIdRef = useRef(1);
  const nextAnnotationIdRef = useRef(1);
  const nextAnnotationZIndexRef = useRef(1); // Track z-index for stacking order
  // const nextAudioIdRef = useRef(1);
  const exporterRef = useRef<VideoExporter | null>(null);

  // Helper to convert file path to proper file:// URL
  const toFileUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) return path;
    const normalized = path.replace(/\\/g, '/');
    const full = `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
    return encodeURI(full);
  };

  const applyLoadedProject = useCallback((project: any) => {
    if (project.projectModel) {
      const validation = validateVideoEditorProject(project.projectModel);
      if (validation.valid) {
        const restored = restoreLegacyEditorStateFromProjectModel(project.projectModel);
        setZoomRegions(restored.zoomRegions);
        setTrimRegions(restored.trimRegions);
        setAnnotationRegions(restored.annotationRegions);
        setAudioRegions(restored.audioRegions);
        setCropRegion(restored.cropRegion);
        setWallpaper(restored.wallpaper);
        setShadowIntensity(restored.shadowIntensity);
        setShowBlur(restored.showBlur);
        if (restored.motionBlurEnabled !== undefined) setMotionBlurEnabled(restored.motionBlurEnabled);
        setBorderRadius(restored.borderRadius);
        setPadding(restored.padding);
        setAspectRatio(restored.aspectRatio);
        setExportQuality(restored.exportQuality);
        if (restored.companionAudioPath !== undefined) {
          setCompanionAudioPath(restored.companionAudioPath);
        }
        if (restored.cursorData) setCursorData(restored.cursorData);
        if (restored.cursorSize !== undefined) setCursorSize(restored.cursorSize);
        if (restored.cursorSmoothing !== undefined) setCursorSmoothing(restored.cursorSmoothing);
        if (restored.showVectorCursor !== undefined) setShowVectorCursor(restored.showVectorCursor);
        if (restored.cursorOffset !== undefined) setCursorOffset(restored.cursorOffset);
        return "projectModel";
      }
      console.warn("[ProjectModel] Invalid saved sidecar; falling back to legacy project fields", validation.errors);
    }

    if (project.zoomRegions) setZoomRegions(project.zoomRegions);
    if (project.trimRegions) setTrimRegions(project.trimRegions);
    if (project.annotationRegions) setAnnotationRegions(project.annotationRegions);
    if (project.audioRegions) {
      const restoredAudio = project.audioRegions.map((ar: any) => ({
        ...ar,
        sourceUrl: ar.path ? `file://${ar.path.replace(/\\/g, '/')}` : ar.sourceUrl,
        isOriginal: ar.isOriginal !== undefined ? ar.isOriginal : true,
        isDetached: ar.isDetached !== undefined ? ar.isDetached : false,
      }));
      setAudioRegions(restoredAudio);
      const originalAudioPath = restoredAudio.find((ar: any) => ar.isOriginal && !ar.isDetached)?.path;
      if (originalAudioPath) setCompanionAudioPath(originalAudioPath);
    }
    if (project.cropRegion) setCropRegion(project.cropRegion);
    if (project.wallpaper) setWallpaper(project.wallpaper);
    if (project.shadowIntensity !== undefined) setShadowIntensity(project.shadowIntensity);
    if (project.showBlur !== undefined) setShowBlur(project.showBlur);
    if (project.motionBlurEnabled !== undefined) setMotionBlurEnabled(project.motionBlurEnabled);
    if (project.borderRadius !== undefined) setBorderRadius(project.borderRadius);
    if (project.padding !== undefined) setPadding(project.padding);
    if (project.aspectRatio) setAspectRatio(project.aspectRatio);
    if (project.exportQuality) setExportQuality(project.exportQuality);
    if (project.cursorData) setCursorData(project.cursorData);
    if (project.cursorSize !== undefined) setCursorSize(project.cursorSize);
    if (project.cursorSmoothing !== undefined) setCursorSmoothing(project.cursorSmoothing);
    if (project.showVectorCursor !== undefined) setShowVectorCursor(project.showVectorCursor);
    if (project.cursorOffset !== undefined) setCursorOffset(project.cursorOffset);
    return "legacy";
  }, []);

  useEffect(() => {
    async function loadVideo() {
      try {
        // 1. Try to get the "active" video path (e.g. just recorded)
        let result = await window.electronAPI.getCurrentVideoPath();

        // 2. Fallback to the latest video in the recordings directory
        if (!result.success || !result.path) {
          result = await window.electronAPI.getRecordedVideoPath();
        }

        if (result.success && result.path) {
          // Reset all regions and selection states to prevent stale state leak from previous sessions
          setZoomRegions([]);
          setTrimRegions([]);
          setAnnotationRegions([]);
          setAudioRegions([]);
          setSelectedZoomId(null);
          setSelectedTrimId(null);
          setSelectedAnnotationId(null);
          setSelectedAudioId(null);
          
          if ((result as any).audioPath) {
            setCompanionAudioPath((result as any).audioPath);
          } else {
            setCompanionAudioPath(null);
          }

          // If proxy is available, use it for UI playback. Always keep original for export.
          setVideoPath((result as any).proxyPath || result.path);
          setOriginalVideoPath(result.path);
          setError(null);
          
          // Try to load auto-saved project
          const projectResult = await window.electronAPI.loadProject(result.path);
          if (projectResult.success && projectResult.project) {
            const restoredFrom = applyLoadedProject(projectResult.project);
            toast.success("工程已自动恢复");
            console.info(`[ProjectModel] Auto-restored project via ${restoredFrom}`, {
              projectPath: projectResult.projectPath,
              companionAudioPath: projectResult.project?.projectModel
                ? restoreLegacyEditorStateFromProjectModel(projectResult.project.projectModel).companionAudioPath
                : (result as any).audioPath,
            });
          } else {
            // New recording project! Auto-load the companion recorded audio track if available
            if ((result as any).audioPath) {
              const audioUrl = `file://${(result as any).audioPath.replace(/\\/g, '/')}`;
              const tempAudio = new Audio(audioUrl);
              tempAudio.addEventListener('loadedmetadata', () => {
                const durationMs = Math.round(tempAudio.duration * 1000);
                const audioName = (result as any).audioPath.split(/[/\\]/).pop() || "Recorded Audio";
                
                const newAudioRegion = {
                  id: crypto.randomUUID(),
                  startMs: 0,
                  endMs: durationMs,
                  sourceUrl: audioUrl,
                  volume: 1.0,
                  name: audioName,
                  path: (result as any).audioPath,
                  totalDurationMs: durationMs,
                  sourceStartMs: 0,
                  sourceEndMs: durationMs,
                  isOriginal: true,
                  isDetached: false,
                };
                
                setAudioRegions([newAudioRegion]);
                console.log("[Auto-Load] Successfully loaded and attached recorded system audio track:", newAudioRegion);
              });
            }
          }
        } else {
          setError('No recordings found. Please start a new recording to begin editing.');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, [applyLoadedProject]);

  // Initialize default wallpaper with resolved asset path
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolvedPath = await getAssetPath('wallpapers/wallpaper1.jpg');
        if (mounted) {
          setWallpaper(resolvedPath);
        }
      } catch (err) {
        // If resolution fails, keep the fallback
        console.warn('Failed to resolve default wallpaper path:', err);
      }
    })();



    return () => { mounted = false };
  }, []);

  // Auto-save project debounced
  useEffect(() => {
    if (!originalVideoPath) return;
    const timeout = setTimeout(() => {
      // Create serialized copies (stripping 'file' object from audioRegions)
      const serializedAudioRegions = audioRegions.map(ar => {
        const { file, ...rest } = ar;
        return rest;
      });
      const projectModel = currentProjectModel;
      const projectModelValidation = validateVideoEditorProject(projectModel);
      if (!projectModelValidation.valid) {
        console.warn("[ProjectModel] Generated invalid sidecar model", projectModelValidation.errors);
      } else if (projectModelValidation.warnings.length > 0) {
        console.info("[ProjectModel] Sidecar model warnings", projectModelValidation.warnings);
      }
      const projectData = {
        zoomRegions,
        trimRegions,
        annotationRegions,
        audioRegions: serializedAudioRegions,
        projectModel,
        cropRegion,
        wallpaper,
        shadowIntensity,
        showBlur,
        motionBlurEnabled,
        borderRadius,
        padding,
        aspectRatio,
        exportQuality,
        cursorData,
        cursorSize,
        cursorSmoothing,
        showVectorCursor,
        cursorOffset,
      };
      window.electronAPI.saveProject(originalVideoPath, projectData).catch(e => {
        console.error("Auto-save failed", e);
      });
    }, 1000); // 1s debounce
    return () => clearTimeout(timeout);
  }, [
    currentProjectModel,
    videoPath, originalVideoPath,
    zoomRegions, trimRegions, audioRegions, annotationRegions, cursorData,
    cursorSize, cursorSmoothing, showVectorCursor, cursorOffset,
    cropRegion, wallpaper, shadowIntensity, showBlur, motionBlurEnabled,
    borderRadius, padding, aspectRatio, exportQuality
  ]);

  const handleDurationChange = useCallback((dur: number) => {
    setDuration(dur);
    // Sync videoElementRef when duration is first reported (video element is definitely ready)
    if (videoPlaybackRef.current?.video) {
      videoElementRef.current = videoPlaybackRef.current.video;
    }
  }, []);

  function togglePlayPause() {
    const playback = videoPlaybackRef.current;
    const video = playback?.video;

    if (isPlaying) {
      playback?.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= projectDuration) {
        handleSeek(0);
      }

      if (playback && video && currentTime < duration - 0.05) {
        playback.play().catch(err => {
          console.error('Video play failed:', err);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    }
  }

  function handleSeek(time: number) {
    const nextTime = Math.max(0, Math.min(time, projectDuration || time));
    setCurrentTime(nextTime);
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    
    if (duration > 0 && nextTime < duration) {
      video.currentTime = nextTime;
    } else {
      video.pause();
      video.currentTime = Math.max(0, duration - 0.001);
    }
  }

  const handleSelectZoom = useCallback((id: string | null) => {
    setSelectedZoomId(id);
    if (id) {
      setSelectedTrimId(null);
      setSelectedAnnotationId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectTrim = useCallback((id: string | null) => {
    setSelectedTrimId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedAnnotationId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedTrimId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectAudio = useCallback((id: string | null) => {
    setSelectedAudioId(id);
    if (id) {
      setSelectedZoomId(null);
      setSelectedTrimId(null);
      setSelectedAnnotationId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleZoomAdded = useCallback((span: Span) => {
    const id = `zoom-${nextZoomIdRef.current++}`;
    const newRegion: ZoomRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      depth: DEFAULT_ZOOM_DEPTH,
      focus: { cx: 0.5, cy: 0.5 },
    };
    setZoomRegions((prev) => [...prev, newRegion]);
    setSelectedZoomId(id);
    setSelectedTrimId(null);
    setSelectedAnnotationId(null);
  }, []);

  const handleTrimAdded = useCallback((span: Span) => {
    const id = `trim-${nextTrimIdRef.current++}`;
    const newRegion: TrimRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
    };
    setTrimRegions((prev) => [...prev, newRegion]);
    setSelectedTrimId(id);
    setSelectedZoomId(null);
    setSelectedAnnotationId(null);
  }, []);

  const handleZoomSpanChange = useCallback((id: string, span: Span) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
            ...region,
            startMs: Math.round(span.start),
            endMs: Math.round(span.end),
          }
          : region,
      ),
    );
  }, []);

  const handleZoomSplit = useCallback((id: string, splitAtMs: number) => {
    setZoomRegions((prev) => {
      const region = prev.find(r => r.id === id);
      if (!region) return prev;

      const newId = `zoom-${nextZoomIdRef.current++}`;
      const firstHalf: ZoomRegion = { ...region, endMs: splitAtMs };
      const secondHalf: ZoomRegion = { ...region, id: newId, startMs: splitAtMs };

      const newRegions = prev.filter(r => r.id !== id);
      newRegions.push(firstHalf, secondHalf);
      return newRegions;
    });
  }, []);

  const handleTrimSpanChange = useCallback((id: string, span: Span) => {
    setTrimRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
            ...region,
            startMs: Math.round(span.start),
            endMs: Math.round(span.end),
          }
          : region,
      ),
    );
  }, []);

  const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
            ...region,
            focus: clampFocusToDepth(focus, region.depth),
          }
          : region,
      ),
    );
  }, []);

  const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {
    if (!selectedZoomId) return;
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === selectedZoomId
          ? {
            ...region,
            depth,
            focus: clampFocusToDepth(region.focus, depth),
          }
          : region,
      ),
    );
  }, [selectedZoomId]);

  const handleZoomDelete = useCallback((id: string) => {
    setZoomRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedZoomId === id) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId]);

  const handleTrimDelete = useCallback((id: string) => {
    setTrimRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedTrimId === id) {
      setSelectedTrimId(null);
    }
  }, [selectedTrimId]);

  const handleAnnotationAdded = useCallback((span: Span) => {
    const id = `annotation-${nextAnnotationIdRef.current++}`;
    const zIndex = nextAnnotationZIndexRef.current++; // Assign z-index based on creation order
    const newRegion: AnnotationRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      type: 'text',
      content: 'Enter text...',
      position: { ...DEFAULT_ANNOTATION_POSITION },
      size: { ...DEFAULT_ANNOTATION_SIZE },
      style: { ...DEFAULT_ANNOTATION_STYLE },
      zIndex,
    };
    setAnnotationRegions((prev) => [...prev, newRegion]);
    setSelectedAnnotationId(id);
    setSelectedZoomId(null);
    setSelectedTrimId(null);
  }, []);

  const handleAnnotationSpanChange = useCallback((id: string, span: Span) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
            ...region,
            startMs: Math.round(span.start),
            endMs: Math.round(span.end),
          }
          : region,
      ),
    );
  }, []);

  const handleAnnotationDelete = useCallback((id: string) => {
    setAnnotationRegions(prev => prev.filter(r => r.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  }, [setAnnotationRegions, selectedAnnotationId, setSelectedAnnotationId]);

  // Audio Handlers
  const handleAudioAdded = useCallback((region: AudioRegion) => {
    // 异步加载音频时长
    const audio = new Audio(region.sourceUrl);
    audio.addEventListener('loadedmetadata', () => {
      const durationMs = Math.round(audio.duration * 1000);
      setAudioRegions(prev => prev.map(r => r.id === region.id ? { 
        ...r, 
        totalDurationMs: durationMs,
        endMs: r.startMs + durationMs,
        sourceEndMs: durationMs
      } : r));
    });
    
    const newRegion = {
      isOriginal: false,
      isDetached: false,
      ...region
    };
    
    setAudioRegions(prev => [...prev, newRegion]);
    setSelectedAudioId(region.id);
  }, [setAudioRegions, setSelectedAudioId]);

  const handleAudioSpanChange = useCallback((id: string, newSpan: { start: number; end: number }) => {
    setAudioRegions(prev => prev.map(r => {
      if (r.id === id) {
        const deltaStart = newSpan.start - r.startMs;
        const deltaEnd = newSpan.end - r.endMs;
        let newSourceStart = r.sourceStartMs ?? 0;
        let newSourceEnd = r.sourceEndMs ?? (r.endMs - r.startMs);

        // 如果只有左边动了，说明是修剪开头
        if (deltaStart !== 0 && deltaEnd === 0) {
           newSourceStart += deltaStart;
           if (newSourceStart < 0) {
              const excess = -newSourceStart;
              newSourceStart = 0;
              newSpan.start += excess;
           }
        } 
        // 如果只有右边动了，说明是修剪结尾
        else if (deltaEnd !== 0 && deltaStart === 0) {
           newSourceEnd += deltaEnd;
           if (r.totalDurationMs && newSourceEnd > r.totalDurationMs) {
              const excess = newSourceEnd - r.totalDurationMs;
              newSourceEnd = r.totalDurationMs;
              newSpan.end -= excess;
           }
        }
        
        return { 
          ...r, 
          startMs: newSpan.start, 
          endMs: newSpan.end,
          sourceStartMs: Math.max(0, newSourceStart),
          sourceEndMs: Math.max(0, newSourceEnd)
        };
      }
      return r;
    }));
  }, [setAudioRegions]);

  const handleAudioTrackChange = useCallback((id: string, newTrackIndex: number) => {
    setAudioRegions(prev => prev.map(r => r.id === id ? { ...r, trackIndex: newTrackIndex } : r));
  }, [setAudioRegions]);

  const handleAudioVolumeChange = useCallback((id: string, volume: number) => {
    setAudioRegions(prev => prev.map(r => r.id === id ? { ...r, volume } : r));
  }, [setAudioRegions]);

  const handleAudioVolumeKeyframesChange = useCallback((id: string, keyframes: VolumeKeyframe[]) => {
    setAudioRegions(prev => prev.map(r => r.id === id ? { ...r, volumeKeyframes: keyframes } : r));
  }, [setAudioRegions]);

  const handleAudioDelete = useCallback((id: string) => {
    setAudioRegions(prev => prev.filter(r => r.id !== id));
    if (selectedAudioId === id) setSelectedAudioId(null);
  }, [setAudioRegions, selectedAudioId, setSelectedAudioId]);

  const handleAnnotationContentChange = useCallback((id: string, content: string) => {
    setAnnotationRegions((prev) => {
      const updated = prev.map((region) => {
        if (region.id !== id) return region;

        // Store content in type-specific fields
        if (region.type === 'text') {
          return { ...region, content, textContent: content };
        } else if (region.type === 'image') {
          return { ...region, content, imageContent: content };
        } else {
          return { ...region, content };
        }
      });
      return updated;
    });
  }, []);;

  const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion['type']) => {
    setAnnotationRegions((prev) => {
      const updated = prev.map((region) => {
        if (region.id !== id) return region;

        const updatedRegion = { ...region, type };

        // Restore content from type-specific storage
        if (type === 'text') {
          updatedRegion.content = region.textContent || 'Enter text...';
        } else if (type === 'image') {
          updatedRegion.content = region.imageContent || '';
        } else if (type === 'figure') {
          updatedRegion.content = '';
          if (!region.figureData) {
            updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
          }
        }

        return updatedRegion;
      });
      return updated;
    });
  }, []);

  const handleAnnotationStyleChange = useCallback((id: string, style: Partial<AnnotationRegion['style']>) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? { ...region, style: { ...region.style, ...style } }
          : region,
      ),
    );
  }, []);

  const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? { ...region, figureData }
          : region,
      ),
    );
  }, []);

  const handleAnnotationPositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? { ...region, position }
          : region,
      ),
    );
  }, []);

  const handleAnnotationSizeChange = useCallback((id: string, size: { width: number; height: number }) => {
    setAnnotationRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? { ...region, size }
          : region,
      ),
    );
  }, []);

  // Global Tab prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        // Allow tab only in inputs/textareas
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
      }

      if (e.key === ' ' || e.code === 'Space') {
        // Allow space only in inputs/textareas
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();

        togglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [togglePlayPause]);

  useEffect(() => {
    if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId, zoomRegions]);

  useEffect(() => {
    if (selectedTrimId && !trimRegions.some((region) => region.id === selectedTrimId)) {
      setSelectedTrimId(null);
    }
  }, [selectedTrimId, trimRegions]);

  useEffect(() => {
    if (selectedAnnotationId && !annotationRegions.some((region) => region.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId, annotationRegions]);



  const handleAutoZoom = useCallback(async () => {
    if (!originalVideoPath) {
      toast.error("No original video path currently loaded.");
      return;
    }

    try {
      setLoading(true);
      // Read the clicks.json associated with this video
      const result = await window.electronAPI.readClicksJson(originalVideoPath);
      console.log("[AutoZoom] Read clicks result:", result);

      if (!result.success || !result.clicks || result.clicks.length === 0) {
        toast.warning("No mouse tracking data found.", {
          description: "Check if the clicks.json exists next to your video.",
          duration: 6000,
        });
        setLoading(false);
        return;
      }

      // Generate zoom regions
      const newRegions = generateAutoZooms(result.clicks);

      if (newRegions.length === 0) {
        toast.info("No zoom regions generated.", {
          description: "Try adjusting the debounce settings or recording more distinct clicks.",
        });
      } else {
        setZoomRegions(newRegions);
        toast.success(`Generated ${newRegions.length} auto-zoom regions!`, {
          description: "You can adjust or delete them in the timeline."
        });
      }
    } catch (err) {
      console.error("Auto-zoom generation failed:", err);
      toast.error("Failed to generate auto-zooms.", {
        description: "Check the console for details."
      });
    } finally {
      setLoading(false);
    }
  }, [originalVideoPath]);

  // Check for available auto-zoom data when video loads
  useEffect(() => {
    if (!originalVideoPath) return;

    let mounted = true;
    const checkAutoZoomData = async () => {
      try {
        const result = await window.electronAPI.readClicksJson(originalVideoPath);
        if (mounted && result.success && result.clicks && result.clicks.length > 0) {
          console.log(`[AutoZoom] Found ${result.clicks.length} clicks, applying automatically.`);
          setCursorData(result.clicks); // Save actual cursor coordinates array

          // Generate regions immediately
          const newRegions = generateAutoZooms(result.clicks);
          console.log(`[AutoZoom] Generated ${newRegions.length} regions:`, newRegions);

          if (newRegions.length > 0) {
            setZoomRegions(newRegions);
            toast.success("✨ Auto-Zoom Applied", {
              description: `Automatically created ${newRegions.length} zoom regions based on your clicks.`,
              duration: 4000,
            });
          }
        } else {
          if (mounted) {
            setCursorData([]);
          }
        }
      } catch (err) {
        console.error("Failed to check for auto-zoom data:", err);
      }
    };

    checkAutoZoomData();
    return () => { mounted = false; };
  }, [originalVideoPath]); 

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

      // Get actual video dimensions to match recording resolution
      const video = videoPlaybackRef.current?.video;
      if (!video) {
        toast.error('Video not ready');
        return;
      }

      const exportProjectValidation = validateVideoEditorProject(currentProjectModel);
      if (!exportProjectValidation.valid) {
        console.warn("[ProjectModel] Export render settings source is invalid", exportProjectValidation.errors);
      }
      const renderSettings = currentRenderSettings;

      const aspectRatioValue = getAspectRatioValue(renderSettings.canvas.aspectRatio);
      const sourceWidth = video.videoWidth || 1920;
      const sourceHeight = video.videoHeight || 1080;

      let exportWidth: number;
      let exportHeight: number;
      let bitrate: number;

      if (renderSettings.exportSettings.quality === 'source') {
        // Use source resolution
        exportWidth = sourceWidth;
        exportHeight = sourceHeight;
        bitrate = 30_000_000;
      } else {
        // Use quality-based target resolution
        const targetHeight = renderSettings.exportSettings.quality === 'medium' ? 720 : 1080;

        // Calculate dimensions maintaining aspect ratio
        exportHeight = Math.floor(targetHeight / 2) * 2; // Ensure even
        exportWidth = Math.floor((exportHeight * aspectRatioValue) / 2) * 2; // Ensure even

        // Adjust bitrate for lower resolutions
        const totalPixels = exportWidth * exportHeight;
        if (totalPixels <= 1280 * 720) {
          bitrate = 10_000_000; // 10 Mbps for 720p
        } else if (totalPixels <= 1920 * 1080) {
          bitrate = 20_000_000; // 20 Mbps for 1080p
        } else {
          bitrate = 30_000_000;
        }
      }

      // Get preview CONTAINER dimensions for scaling
      // Annotations render in HTML overlay matching container, not PixiJS canvas
      const playbackRef = videoPlaybackRef.current;
      const containerElement = playbackRef?.containerRef?.current;
      const previewWidth = containerElement?.clientWidth || 1920;
      const previewHeight = containerElement?.clientHeight || 1080;



      const exporter = new VideoExporter({
        videoUrl: originalVideoPath ? toFileUrl(originalVideoPath) : (videoPath ? toFileUrl(videoPath) : ''),
        width: exportWidth,
        height: exportHeight,
        frameRate: 30, // Optimized for speed
        bitrate: Math.min(bitrate, 15_000_000),
        wallpaper: renderSettings.canvas.wallpaper,
        zoomRegions: renderSettings.timeline.zoomRegions,
        trimRegions: renderSettings.timeline.trimRegions,
        annotationRegions: renderSettings.timeline.annotationRegions,
        audioRegions,
        showShadow: renderSettings.canvas.shadowIntensity > 0,
        shadowIntensity: renderSettings.canvas.shadowIntensity,
        showBlur: renderSettings.canvas.showBlur,
        motionBlurEnabled: renderSettings.effects.motionBlurEnabled,
        borderRadius: renderSettings.canvas.borderRadius,
        padding: renderSettings.canvas.padding,
        cropRegion: renderSettings.canvas.cropRegion,
        previewWidth,
        previewHeight,
        cursorData: renderSettings.cursor.data,
        cursorSize: renderSettings.cursor.size,
        cursorSmoothing: renderSettings.cursor.smoothing,
        showVectorCursor: renderSettings.cursor.showVectorCursor,
        cursorOffset: renderSettings.cursor.offsetMs,
        onProgress: (progress: ExportProgress) => {
          setExportProgress(progress);
        },
      });

      exporterRef.current = exporter;
      const result = await exporter.export();

      if (result.success && result.blob) {
        const arrayBuffer = await result.blob.arrayBuffer();
        const timestamp = Date.now();
        const fileName = `export-${timestamp}.mp4`;

        const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);

        if (saveResult.cancelled) {
          toast.info('Export cancelled');
        } else if (saveResult.success) {
          toast.success(`Video exported successfully to ${saveResult.path}`);
        } else {
          setExportError(saveResult.message || 'Failed to save video');
          toast.error(saveResult.message || 'Failed to save video');
        }
      } else {
        setExportError(result.error || 'Export failed');
        toast.error(result.error || 'Export failed');
      }

      if (wasPlaying) {
        videoPlaybackRef.current?.play();
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportError(errorMessage);
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
      exporterRef.current = null;
    }
  }, [videoPath, originalVideoPath, audioRegions, isPlaying, currentProjectModel, currentRenderSettings]);

  const handleCancelExport = useCallback(() => {
    if (exporterRef.current) {
      exporterRef.current.cancel();
      toast.info('Export cancelled');
      setShowExportDialog(false);
      setIsExporting(false);
      setExportProgress(null);
      setExportError(null);
    }
  }, []);

  const memoizedSidebar = useMemo(() => (
          <Sidebar
            selected={wallpaper}
            onWallpaperChange={setWallpaper}
            selectedZoomDepth={selectedZoomId ? zoomRegions.find(z => z.id === selectedZoomId)?.depth : null}
            onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
            selectedZoomId={selectedZoomId}
            onZoomDelete={handleZoomDelete}
            selectedTrimId={selectedTrimId}
            onTrimDelete={handleTrimDelete}
            shadowIntensity={shadowIntensity}
            onShadowChange={setShadowIntensity}
            showBlur={showBlur}
            onBlurChange={setShowBlur}
            motionBlurEnabled={motionBlurEnabled}
            onMotionBlurChange={setMotionBlurEnabled}
            borderRadius={borderRadius}
            onBorderRadiusChange={setBorderRadius}
            padding={padding}
            onPaddingChange={setPadding}
            cropRegion={cropRegion}
            onCropChange={setCropRegion}
            aspectRatio={aspectRatio}
            videoElement={videoPlaybackRef.current?.video || null}
            exportQuality={exportQuality}
            onExportQualityChange={setExportQuality}
            onExport={handleExport}
            selectedAnnotationId={selectedAnnotationId}
            annotationRegions={annotationRegions}
            onAnnotationContentChange={handleAnnotationContentChange}
            onAnnotationTypeChange={handleAnnotationTypeChange}
            onAnnotationStyleChange={handleAnnotationStyleChange}
            onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
            onAnnotationDelete={handleAnnotationDelete}
            onAutoZoom={handleAutoZoom}
            cursorSize={cursorSize}
            onCursorSizeChange={setCursorSize}
            cursorSmoothing={cursorSmoothing}
            onCursorSmoothingChange={setCursorSmoothing}
            showVectorCursor={showVectorCursor}
            onShowVectorCursorChange={setShowVectorCursor}
            cursorOffset={cursorOffset}
            onCursorOffsetChange={setCursorOffset}
            selectedVideoId={selectedVideoId}
            onSelectVideo={setSelectedVideoId}
            isOriginalAudioSelected={audioRegions.some(r => r.id === selectedAudioId && r.isOriginal && !r.isDetached)}
            onSelectAudio={handleSelectAudio}
            onSeparateAudio={handleSeparateAudio}
            hasOriginalAudio={audioRegions.some(r => r.isOriginal && !r.isDetached)}
          />
        ), [
          wallpaper, zoomRegions, selectedZoomId, selectedTrimId, shadowIntensity,
          showBlur, motionBlurEnabled, borderRadius, padding, cropRegion, aspectRatio,
          exportQuality, selectedAnnotationId, annotationRegions, cursorSize,
          cursorSmoothing, showVectorCursor, cursorOffset, selectedVideoId, selectedAudioId, audioRegions,
          handleZoomDepthChange, handleZoomDelete, handleTrimDelete,
          handleExport, handleAnnotationContentChange, handleAnnotationTypeChange,
          handleAnnotationStyleChange, handleAnnotationFigureDataChange, handleAnnotationDelete,
          handleAutoZoom, videoPlaybackRef.current?.video, handleSeparateAudio, handleSelectAudio
        ]);

  if (loading) {
    return (
      <div 
        className="flex flex-col h-screen w-screen bg-[#111111] overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (!file) return;
          const isAudio = file.type.startsWith('audio/') || !!file.name.match(/\.(mp3|m4a|wav|aac|ogg)$/i);
          const isVideo = file.type.startsWith('video/') && !isAudio;
          
          if (isVideo) {
            setVideoPath(file.path || URL.createObjectURL(file));
            setError(null);
          }
        }}
      >
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading your masterpiece...</p>
      </div>
    );
  }







  return (
    <div 
      className="flex flex-col h-screen bg-[#09090b] text-slate-200 overflow-hidden selection:bg-[#34B27B]/30"
      onDragEnter={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        
        const isAudio = file.type.startsWith('audio/') || !!file.name.match(/\.(mp3|m4a|wav|aac|ogg)$/i);
        const isVideo = file.type.startsWith('video/') && !isAudio;

        if (!isAudio && !isVideo) {
          toast.error("未识别的文件格式", {
            description: `文件名: ${file.name}, 类型: ${file.type || '未知'}`
          });
          return;
        }

        if (isVideo) {
          // Reset all regions and selection states on dropping new video
          setZoomRegions([]);
          setTrimRegions([]);
          setAnnotationRegions([]);
          setAudioRegions([]);
          setSelectedZoomId(null);
          setSelectedTrimId(null);
          setSelectedAnnotationId(null);
          setSelectedAudioId(null);
          setCompanionAudioPath(null);

          // Attempt to extract real file path if available, else blob
          const path = (file as any).path || URL.createObjectURL(file);
          setVideoPath(path);
          setOriginalVideoPath(path); // Also update original path
          setError(null);
          
          // Try to load auto-saved project if any
          const projectResult = await window.electronAPI.loadProject(path);
          if (projectResult.success && projectResult.project) {
            const restoredFrom = applyLoadedProject(projectResult.project);
            console.info(`[ProjectModel] Drop-restored project via ${restoredFrom}`, {
              projectPath: projectResult.projectPath,
              companionAudioPath: projectResult.project?.projectModel
                ? restoreLegacyEditorStateFromProjectModel(projectResult.project.projectModel).companionAudioPath
                : null,
            });
          }
        } else if (isAudio) {
          toast.success("成功识别音频", {
            description: `已加载: ${file.name}`
          });
          // Global audio drop support
          // Check if it's a 0-byte or likely an undownloaded iCloud stub
          if (file.size === 0 || file.name.endsWith('.icloud')) {
            toast.error("无法加载该文件", {
              description: "该音频文件可能位于 iCloud 云端且未下载，请先在访达(Finder)中点击下载后再试。",
            });
            return;
          }

          try {
            const slice = file.slice(0, 10);
            await slice.arrayBuffer();
          } catch (err) {
            toast.error("无法读取文件", {
              description: "该文件无法被读取，它似乎仍在 iCloud 中尚未完全下载。请先在访达(Finder)中双击下载它。",
            });
            return;
          }
          
          const url = URL.createObjectURL(file);
          
          // Ensure it drops visibly even if playhead is at the very end
          let startPos = Math.max(0, Math.min(currentTime, duration));
          if (duration - startPos < 1) {
            startPos = Math.max(0, duration - 5);
          }
          
          handleAudioAdded({
            id: crypto.randomUUID(),
            startMs: startPos * 1000,
            endMs: (startPos + 5) * 1000,
            sourceUrl: url,
            file: file,
            path: (file as any).path, // Save path for persistence
            volume: 1.0,
            sourceStartMs: 0,
            sourceEndMs: 5000,
            name: file.name,
          });
        }
      }}
    >
      {error && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b]/90 backdrop-blur-sm">
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center max-w-md pointer-events-auto">
            <div className="text-red-500 font-bold mb-2">Failed to load video</div>
            <div className="text-red-400/60 text-sm mb-4">{error}</div>
            <p className="text-slate-300 mb-6 font-medium">Or simply drag & drop any video file here</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      <div
        className="h-10 flex-shrink-0 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1" />
      </div>

      <div className="flex-1 p-5 gap-4 flex min-h-0 relative">
        {/* Left Column - Video & Timeline */}
        <div className="flex-[7] flex flex-col gap-3 min-w-0 h-full">
          <PanelGroup direction="vertical" className="gap-3">
            {/* Top section: video preview and controls */}
            <Panel defaultSize={70} minSize={40}>
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
                {/* Video preview */}
                <div className="w-full flex justify-center items-center" style={{ flex: '1 1 auto', margin: '6px 0 0' }}>
                  <div className="relative" style={{ width: 'auto', height: '100%', aspectRatio: getAspectRatioValue(currentRenderSettings.canvas.aspectRatio), maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
                    <VideoPlayback
                      aspectRatio={currentRenderSettings.canvas.aspectRatio}
                      ref={videoPlaybackRef}
                      videoPath={videoPath ? toFileUrl(videoPath) : ''}
                      onDurationChange={handleDurationChange}
                      onTimeUpdate={(time) => {
                        if (timelineResizeLockRef.current > 0) {
                          return;
                        }
                        const video = videoPlaybackRef.current?.video;
                        if (
                          duration > 0 &&
                          projectDuration > duration &&
                          currentTimeStateRef.current >= duration - 0.05 &&
                          time < currentTimeStateRef.current - 0.25
                        ) {
                          return;
                        }
                        // 核心修复：如果视频处于暂停状态（说明用户正在拖拽时间轴或点击），
                        // 绝对不能信任底层 video 触发的 timeupdate！
                        // 因为底层的 timeupdate 只能对齐到关键帧，会强制把用户精准拖拽的 currentTime 拉回关键帧时间，造成极大的游标偏移！
                        if (video && video.paused) {
                           return;
                        }
                        setCurrentTime(time);
                      }}
                      currentTime={currentTime}
                      onPlayStateChange={(playing) => {
                        if (
                          !playing &&
                          projectDuration > duration &&
                          currentTimeStateRef.current >= duration - 0.05 &&
                          currentTimeStateRef.current < projectDuration
                        ) {
                          return;
                        }
                        setIsPlaying(playing);
                      }}
                      onError={setError}
                      wallpaper={currentRenderSettings.canvas.wallpaper}
                      zoomRegions={currentRenderSettings.timeline.zoomRegions}
                      selectedZoomId={selectedZoomId}
                      onSelectZoom={handleSelectZoom}
                      onZoomFocusChange={handleZoomFocusChange}
                      isPlaying={isPlaying}
                      showShadow={currentRenderSettings.canvas.shadowIntensity > 0}
                      shadowIntensity={currentRenderSettings.canvas.shadowIntensity}
                      showBlur={currentRenderSettings.canvas.showBlur}
                      motionBlurEnabled={currentRenderSettings.effects.motionBlurEnabled}
                      borderRadius={currentRenderSettings.canvas.borderRadius}
                      padding={currentRenderSettings.canvas.padding}
                      cropRegion={currentRenderSettings.canvas.cropRegion}
                      trimRegions={currentRenderSettings.timeline.trimRegions}
                      annotationRegions={currentRenderSettings.timeline.annotationRegions}
                      selectedAnnotationId={selectedAnnotationId}
                      onSelectAnnotation={handleSelectAnnotation}
                      onAnnotationPositionChange={handleAnnotationPositionChange}
                      onAnnotationSizeChange={handleAnnotationSizeChange}
                      isFullScreenBinding={isFullScreenBinding}
                      cursorSize={currentRenderSettings.cursor.size}
                      cursorSmoothing={currentRenderSettings.cursor.smoothing}
                      showVectorCursor={currentRenderSettings.cursor.showVectorCursor}
                      cursorData={currentRenderSettings.cursor.data}
                      cursorOffset={currentRenderSettings.cursor.offsetMs}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="h-3 bg-[#09090b]/80 hover:bg-[#09090b] transition-colors rounded-full mx-4 flex items-center justify-center">
              <div className="w-8 h-1 bg-white/20 rounded-full"></div>
            </PanelResizeHandle>

            {/* Timeline section */}
            <Panel defaultSize={30} minSize={20}>
              <div className="h-full bg-[#09090b] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col">
                <TimelineEditor
                  videoDuration={projectDuration}
                  sourceVideoDuration={duration}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  videoRef={videoElementRef}
                  zoomRegions={zoomRegions}
                  onZoomAdded={handleZoomAdded}
                  onZoomSpanChange={handleZoomSpanChange}
                  onZoomSplit={handleZoomSplit}
                  onZoomDelete={handleZoomDelete}
                  selectedZoomId={selectedZoomId}
                  onSelectZoom={handleSelectZoom}
                  trimRegions={trimRegions}
                  onTrimAdded={handleTrimAdded}
                  onTrimSpanChange={handleTrimSpanChange}
                  onTrimDelete={handleTrimDelete}
                  selectedTrimId={selectedTrimId}
                  onSelectTrim={handleSelectTrim}
                  annotationRegions={annotationRegions}
                  onAnnotationAdded={handleAnnotationAdded}
                  onAnnotationSpanChange={handleAnnotationSpanChange}
                  onAnnotationDelete={handleAnnotationDelete}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={handleSelectAnnotation}
                  onAudioAdded={handleAudioAdded as any}
                  onAudioSpanChange={handleAudioSpanChange}
                  onAudioTrackChange={handleAudioTrackChange}
                  onAudioVolumeChange={handleAudioVolumeChange}
                  onAudioVolumeKeyframesChange={handleAudioVolumeKeyframesChange}
                  onAudioDelete={handleAudioDelete}
                  onTimelineResizeStart={handleTimelineResizeStart}
                  onTimelineResizeEnd={handleTimelineResizeEnd}
                  selectedAudioId={selectedAudioId}
                  onSelectAudio={handleSelectAudio}
                  audioRegions={audioRegions}
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={setAspectRatio}
                  isFullScreenBinding={isFullScreenBinding}
                  onFullScreenBindingChange={setIsFullScreenBinding}
                  isPlaying={isPlaying}
                  onTogglePlayPause={togglePlayPause}
                  selectedVideoId={selectedVideoId}
                  onSelectVideo={setSelectedVideoId}
                  videoPath={videoPath ? toFileUrl(videoPath) : undefined}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>

        {/* Right section: Sidebar */}
        {memoizedSidebar}
      </div>

      <Toaster theme="dark" className="pointer-events-auto" />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        progress={exportProgress}
        isExporting={isExporting}
        error={exportError}
        onCancel={handleCancelExport}
      />
    </div>
  );
}
