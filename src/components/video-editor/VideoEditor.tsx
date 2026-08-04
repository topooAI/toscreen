import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import VideoPlayback, { type VideoPlaybackRef } from "./VideoPlayback";
import TimelineEditor from "./timeline/TimelineEditor";
import { Sidebar } from "./sidebar/Sidebar";
import { PresetControls } from "./sidebar/PresetControls";
import { ExportDialog } from "./ExportDialog";
import { TopooUserPill } from "./TopooUserPill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  type CursorStylePreset,
  type CursorCustomImageMap,
  resolveCursorStyle,
} from "./types";
import {
  clampZoomRegionsToRecordingDuration,
  generateAutoZooms,
} from "@/lib/autoZoom/generator";
import { VideoExporter, type ExportProgress, type ExportQuality } from "@/lib/exporter";
import type {ExportQueueItem} from '@/lib/exportQueue';
import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import { getAssetPath } from "@/lib/assetPath";
import { loadEditorPreferences, type AppTheme } from "@/lib/editorPreferences";
import {
  createProjectFromLegacyEditorState,
  createProjectAutosaveSnapshot,
  getProjectRenderSettings,
  resolveExportAudioRegions,
  resolveRuntimeAudioRegions,
  restoreLegacyEditorStateFromProjectModel,
  migrateLegacyTrimsToEditingDocument,
  validateVideoEditorProject,
} from "./project";
import { createProductCameraRegion } from './videoPlayback/cameraMotion';
import { useEditingSession } from './hooks/useEditingSession';
import { createEditingRenderPlan } from './editing';
import { PresentationToolbar } from './presentation/PresentationToolbar';
import type { PresentationEffectRegion } from './presentation/types';
import { recordedShortcutEffects } from './presentation/presentationEffects';
import { expandPendingPresenterDuration, presenterEffectFromCameraPath } from './project/presenterContract';
import { MediaFeaturesPanel } from './MediaFeaturesPanel';
import { deleteSubtitle, updateSubtitleSpan, type SubtitleRegion } from './mediaFeatures';
import { resolveSourceDurationSeconds, restoredSourceDurationSeconds } from './timeline/timelineMediaAvailability';

const WALLPAPER_COUNT = 18;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);
const EDITOR_SPLIT_HANDLE_HEIGHT_PX = 8;

export default function VideoEditor({ theme }: { theme: AppTheme }) {
  const [editorDefaults] = useState(loadEditorPreferences);
  const [isLayoutResizing, setIsLayoutResizing] = useState(false);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [originalVideoPath, setOriginalVideoPath] = useState<string | null>(null);
  const [companionAudioPath, setCompanionAudioPath] = useState<string | null>(null);
  const [cameraPath, setCameraPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [presets, setPresets] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [defaultPresetId, setDefaultPresetId] = useState('');
  const defaultPresetAppliedRef = useRef(false);
  const restoredSavedProjectRef = useRef(false);
  const [initialProjectLoadComplete, setInitialProjectLoadComplete] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string>(WALLPAPER_PATHS[0]);
  const [shadowIntensity, setShadowIntensity] = useState(editorDefaults.shadowIntensity);
  const [showBlur, setShowBlur] = useState(false);
  const [motionBlurEnabled, setMotionBlurEnabled] = useState(editorDefaults.motionBlurEnabled);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [borderRadius, setBorderRadius] = useState(editorDefaults.borderRadius);
  const [padding, setPadding] = useState(editorDefaults.padding);
  const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
  const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [annotationRegions, setAnnotationRegions] = useState<AnnotationRegion[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [presentationEffects, setPresentationEffects] = useState<PresentationEffectRegion[]>([]);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);
  const [subtitleRegions, setSubtitleRegions] = useState<SubtitleRegion[]>([]);
  const [showMediaFeatures, setShowMediaFeatures] = useState(false);

  // HEALER: Automatically fix corrupted audio regions trapped in memory
  useEffect(() => {
    if (editingSession.document.speedSections.some((section) => section.origin === 'typing')) return;
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
  const [cursorSize, setCursorSize] = useState(editorDefaults.cursorSize);
  const [cursorSmoothing, setCursorSmoothing] = useState(editorDefaults.cursorSmoothing);
  const [showVectorCursor, setShowVectorCursor] = useState(editorDefaults.showVectorCursor);
  const [cursorStyle, setCursorStyle] = useState<CursorStylePreset>(editorDefaults.cursorStyle);
  const [cursorCustomImages, setCursorCustomImages] = useState<CursorCustomImageMap>({});
  const [cursorOffset, setCursorOffset] = useState(0);
  const [cursorData, setCursorData] = useState<any[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'gif'>('mp4');
  const [gifOptions, setGifOptions] = useState({ startMs: 0, endMs: 5000, width: 960, fps: 15, loop: 0 });
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [shareProgress,setShareProgress]=useState<number|null>(null);
  const shareIdRef=useRef<string|null>(null);
  const gifExportIdRef = useRef<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(editorDefaults.aspectRatio);
  const [exportQuality, setExportQuality] = useState<ExportQuality>(editorDefaults.exportQuality);
  const [isFullScreenBinding, setIsFullScreenBinding] = useState(true);
  const handleCursorStyleChange = useCallback((style: CursorStylePreset) => {
    setCursorStyle(style);
    setShowVectorCursor(style !== 'system');
  }, []);
  const handleCursorCustomImagesChange = useCallback((images: CursorCustomImageMap) => {
    setCursorCustomImages(images);
    if (Object.keys(images).length === 0) {
      setCursorStyle((style) => style === 'custom' ? 'toscreen' : style);
    }
  }, []);
  const recordingDurationMs = useMemo(
    () => Math.max(0, Math.round(duration * 1000)),
    [duration],
  );
  const editingSession = useEditingSession(recordingDurationMs);
  const editingRenderPlan = useMemo(
    () => createEditingRenderPlan(editingSession.document, recordingDurationMs),
    [editingSession.document, recordingDurationMs],
  );
  const mainTrackDuration = editingRenderPlan.durationMs / 1000;
  useEffect(() => {
    const typingEvents = cursorData
      .filter((point) => point.type === 'keydown')
      .map((point) => {
        const projectTime = editingSession.timeMap.mapSourceToProject(point.timestamp);
        return projectTime === null ? null : { timestamp: projectTime, type: 'keydown' };
      })
      .filter((event): event is { timestamp: number; type: string } => event !== null);
    if (typingEvents.length > 0) {
      editingSession.execute({ type: 'replace-typing-speed', events: typingEvents });
    }
  }, [cursorData, editingSession.document.speedSections, editingSession.execute, recordingDurationMs]);

  const projectDuration = useMemo(() => Math.max(
    editingRenderPlan.durationMs / 1000,
    ...zoomRegions.map((region) => (editingRenderPlan.timeMap.mapSourceToEffective(region.endMs) ?? 0) / 1000),
    ...annotationRegions.map((region) => (editingRenderPlan.timeMap.mapSourceToEffective(region.endMs) ?? 0) / 1000),
    ...audioRegions.filter((region) => !region.isOriginal || region.isDetached).map((region) => region.endMs / 1000),
    ...presentationEffects.map((region) => region.endMs / 1000),
    ...subtitleRegions.map((region) => region.endMs / 1000),
  ), [editingRenderPlan, zoomRegions, annotationRegions, audioRegions, presentationEffects, subtitleRegions]);

  const currentProjectModel = useMemo(() => createProjectFromLegacyEditorState({
    projectName,
    videoPath,
    originalVideoPath,
    companionAudioPath,
    cameraPath,
    durationSeconds: duration,
    projectDurationSeconds: projectDuration,
    zoomRegions,
    trimRegions,
    annotationRegions,
    audioRegions,
    subtitleRegions,
    cursorData,
    cursorSize,
    cursorSmoothing,
    showVectorCursor,
    cursorStyle,
    cursorCustomImages,
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
    editingDocument: editingSession.document,
    presentationEffects,
    autoFocusEnabled,
  }), [
    videoPath,
    originalVideoPath,
    companionAudioPath,
    cameraPath,
    duration,
    projectDuration,
    zoomRegions,
    trimRegions,
    annotationRegions,
    audioRegions,
    subtitleRegions,
    cursorData,
    cursorSize,
    cursorSmoothing,
    showVectorCursor,
    cursorStyle,
    cursorCustomImages,
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
    editingSession.document,
    presentationEffects,
    projectName,
  ]);

  const currentRenderSettings = useMemo(
    () => getProjectRenderSettings(currentProjectModel),
    [currentProjectModel],
  );
  const updatePresentationEffect = useCallback((id: string, patch: Partial<PresentationEffectRegion>) => setPresentationEffects(current => current.map(effect => effect.id === id ? ({ ...effect, ...patch } as PresentationEffectRegion) : effect)), []);
  const deletePresentationEffect = useCallback((id: string) => { setPresentationEffects(current => current.filter(effect => effect.id !== id)); setSelectedPresentationId(current => current === id ? null : current); }, []);
  const changePresentationSpan = useCallback((id: string, span: Span) => updatePresentationEffect(id, { startMs: Math.round(span.start), endMs: Math.round(span.end) } as Partial<PresentationEffectRegion>), [updatePresentationEffect]);

  const refreshPresets = useCallback(async () => {
    const result = await window.electronAPI.listPresets();
    if (result.success) { setPresets(result.presets || []); setDefaultPresetId(result.defaultPresetId || ''); }
  }, []);
  useEffect(() => { void refreshPresets() }, [refreshPresets]);

  const saveSnapshot = useCallback(() => createProjectAutosaveSnapshot(currentProjectModel, audioRegions), [currentProjectModel, audioRegions]);
  const handleSaveProject = useCallback(async () => {
    if (!originalVideoPath) return;
    setSaveStatus('saving');
    const result = await window.electronAPI.saveProject(originalVideoPath, saveSnapshot());
    setSaveStatus(result.success ? 'saved' : 'error');
    if (!result.success) toast.error('Save failed', { description: result.error || result.message });
  }, [originalVideoPath, saveSnapshot]);
  const handleSaveAsProject = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const result = await window.electronAPI.saveProjectAs(saveSnapshot());
      if (result.cancelled) { setSaveStatus('saved'); return; }
      if (!result.success) throw new Error(result.error || 'Save As failed');
      setProjectName(result.name); setSaveStatus('saved'); toast.success(`Saved as ${result.name}`);
    } catch (error) { setSaveStatus('error'); toast.error('Save As failed', { description: String(error) }); }
  }, [saveSnapshot]);

  const handleCreatePreset = useCallback(async () => {
    const name = window.prompt('Preset name'); if (!name?.trim()) return;
    const result = await window.electronAPI.savePreset(name, currentProjectModel);
    if (result.success) { setSelectedPresetId(result.preset.id); await refreshPresets(); toast.success('Preset saved'); }
  }, [currentProjectModel, refreshPresets]);
  const handleUpdatePreset = useCallback(async () => {
    const selected = presets.find((preset) => preset.id === selectedPresetId);
    if (!selected) return;
    await window.electronAPI.savePreset(selected.name, currentProjectModel, selected.id);
    await refreshPresets();
    toast.success('Preset updated');
  }, [currentProjectModel, presets, refreshPresets, selectedPresetId]);
  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetId || !window.confirm('Delete this preset?')) return;
    await window.electronAPI.deletePreset(selectedPresetId);
    setSelectedPresetId('');
    await refreshPresets();
  }, [refreshPresets, selectedPresetId]);
  const handleSetDefaultPreset = useCallback(async () => {
    if (!selectedPresetId) return;
    await window.electronAPI.setDefaultPreset(selectedPresetId);
    setDefaultPresetId(selectedPresetId);
    toast.success('Default preset updated');
  }, [selectedPresetId]);
  const handleImportPreset = useCallback(async () => {
    const result = await window.electronAPI.importPreset();
    if (result.success) {
      setSelectedPresetId(result.preset.id);
      await refreshPresets();
    } else if (!result.cancelled) {
      toast.error(result.error || 'Preset import failed');
    }
  }, [refreshPresets]);
  const handleExportPreset = useCallback(async () => {
    if (!selectedPresetId) return;
    const result = await window.electronAPI.exportPreset(selectedPresetId);
    if (result.success) toast.success('Preset exported');
  }, [selectedPresetId]);


  const runtimeAudioRegions = useMemo(
    () => resolveRuntimeAudioRegions(currentRenderSettings.timeline.audioRegions, audioRegions),
    [currentRenderSettings.timeline.audioRegions, audioRegions],
  );

  const currentTimeStateRef = useRef(currentTime);
  const timelineResizeLockRef = useRef(0);
  const verticalEditorSplitRef = useRef<HTMLDivElement | null>(null);
  const canvasWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const [presentationToolbarPlacement, setPresentationToolbarPlacement] = useState<'right' | 'top'>('right');
  const verticalSplitCleanupRef = useRef<(() => void) | null>(null);
  const panelLayoutResizeRef = useRef(false);
  const windowLayoutResizeRef = useRef(false);
  const windowResizeTimerRef = useRef<number | null>(null);
  const projectClockRef = useRef<number | null>(null);
  const projectClockBaseRef = useRef({ startedAt: 0, startTime: 0 });

  useEffect(() => {
    currentTimeStateRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const workspace = canvasWorkspaceRef.current;
    const frame = canvasFrameRef.current;
    if (!workspace || !frame) return;

    const updatePlacement = () => {
      const workspaceRect = workspace.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const horizontalSpace = Math.max(0, (workspaceRect.width - frameRect.width) / 2);
      const verticalSpace = Math.max(0, (workspaceRect.height - frameRect.height) / 2);
      setPresentationToolbarPlacement(horizontalSpace >= 44 || verticalSpace < 36 ? 'right' : 'top');
    };

    const observer = new ResizeObserver(updatePlacement);
    observer.observe(workspace);
    observer.observe(frame);
    updatePlacement();
    return () => observer.disconnect();
  }, [aspectRatio, loading]);

  const handleTimelineResizeStart = useCallback(() => {
    timelineResizeLockRef.current += 1;
  }, []);

  const handleTimelineResizeEnd = useCallback(() => {
    timelineResizeLockRef.current = Math.max(0, timelineResizeLockRef.current - 1);
  }, []);

  const handlePanelLayoutResize = useCallback((isDragging: boolean) => {
    panelLayoutResizeRef.current = isDragging;
    setIsLayoutResizing(isDragging || windowLayoutResizeRef.current);
  }, []);

  const handleVerticalSplitPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = verticalEditorSplitRef.current;
    if (!container) return;

    event.preventDefault();
    verticalSplitCleanupRef.current?.();
    handlePanelLayoutResize(true);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const updateSplit = (clientY: number) => {
      const bounds = container.getBoundingClientRect();
      const handleHeight = EDITOR_SPLIT_HANDLE_HEIGHT_PX;
      const usableHeight = Math.max(1, bounds.height);
      const previewHeight = clientY - bounds.top - handleHeight / 2;
      const ratio = Math.max(0.35, Math.min(0.65, previewHeight / usableHeight));

      container.style.setProperty('--preview-panel-fr', `${ratio * 100}fr`);
      container.style.setProperty('--timeline-panel-fr', `${(1 - ratio) * 100}fr`);
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      updateSplit(pointerEvent.clientY);
    };

    const finishDragging = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDragging);
      window.removeEventListener('pointercancel', finishDragging);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      verticalSplitCleanupRef.current = null;
      handlePanelLayoutResize(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDragging);
    window.addEventListener('pointercancel', finishDragging);
    verticalSplitCleanupRef.current = finishDragging;
    updateSplit(event.clientY);
  }, [handlePanelLayoutResize]);

  useEffect(() => {
    return () => verticalSplitCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      windowLayoutResizeRef.current = true;
      setIsLayoutResizing(true);

      if (windowResizeTimerRef.current !== null) {
        window.clearTimeout(windowResizeTimerRef.current);
      }

      windowResizeTimerRef.current = window.setTimeout(() => {
        windowResizeTimerRef.current = null;
        windowLayoutResizeRef.current = false;
        setIsLayoutResizing(panelLayoutResizeRef.current);
      }, 120);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (windowResizeTimerRef.current !== null) {
        window.clearTimeout(windowResizeTimerRef.current);
        windowResizeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (projectClockRef.current !== null) {
        cancelAnimationFrame(projectClockRef.current);
        projectClockRef.current = null;
      }
      return;
    }

    let projectTailStarted = false;

    const tick = () => {
      const video = videoPlaybackRef.current?.video;
      const sourceVideoIsPlaying = Boolean(
        video
        && duration > 0
        && !video.paused
        && video.currentTime < duration - 0.05
      );

      // The media clock is authoritative while recorded video is active.
      // The project clock only takes over for independent content after it.
      if (sourceVideoIsPlaying) {
        projectTailStarted = false;
        projectClockRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!projectTailStarted) {
        const sourceTime = editingRenderPlan
          ? currentTimeStateRef.current
          : video && Number.isFinite(video.currentTime)
          ? video.currentTime
          : currentTimeStateRef.current;
        const startTime = Math.min(
          Math.max(currentTimeStateRef.current, sourceTime, 0),
          Math.max(projectDuration, 0),
        );
        projectClockBaseRef.current = {
          startedAt: performance.now(),
          startTime,
        };
        projectTailStarted = true;
      }

      const { startedAt, startTime } = projectClockBaseRef.current;
      const nextTime = startTime + (performance.now() - startedAt) / 1000;
      const clampedTime = Math.min(nextTime, projectDuration);

      setCurrentTime(clampedTime);

      if (video && mainTrackDuration > 0 && clampedTime < mainTrackDuration && video.paused) {
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
  }, [editingRenderPlan, isPlaying, mainTrackDuration, projectDuration, duration]);

  // Web Audio Mixer for additional audio tracks
  useAudioMixer({ 
    audioRegions: runtimeAudioRegions,
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
        setProjectName(project.projectModel.name || 'Untitled Project');
        const restored = restoreLegacyEditorStateFromProjectModel(project.projectModel);
        const persistedSourceDurationSeconds = restoredSourceDurationSeconds(project.projectModel);
        const persistedSourceDurationMs = persistedSourceDurationSeconds * 1000;
        // Recent and portable projects hydrate their media path before the
        // hidden video element reports metadata. Seed the source clock from
        // the validated clip; loadedmetadata remains authoritative.
        if (persistedSourceDurationSeconds > 0) setDuration(persistedSourceDurationSeconds);
        setZoomRegions(
          clampZoomRegionsToRecordingDuration(
            restored.zoomRegions,
            persistedSourceDurationMs,
          ),
        );
        setTrimRegions(restored.trimRegions);
        editingSession.restore(restored.editingDocument);
        setAnnotationRegions(restored.annotationRegions);
        const restoredPresentation = restored.presentationEffects ?? [];
        const cameraAsset = project.projectModel.assets?.find((asset: any) => asset.metadata?.role === 'camera' || asset.metadata?.role === 'presenter-camera' || asset.metadata?.sourceKind === 'camera');
        setPresentationEffects(cameraAsset && !restoredPresentation.some(effect => effect.kind === 'presenter') ? [...restoredPresentation, { id: `presenter-${cameraAsset.id}`, kind: 'presenter', startMs: 0, endMs: project.projectModel.durationMs, sourceUrl: cameraAsset.filePath ? toFileUrl(cameraAsset.filePath) : cameraAsset.sourceUrl, posterDataUrl: cameraAsset.metadata?.posterDataUrl, sourceStartMs: Number(cameraAsset.metadata?.sourceStartMs ?? 0), shape: 'circle', bounds: { x: 76, y: 68, width: 18, height: 24 }, visible: true, opacity: 1, fit: 'cover' } as PresentationEffectRegion] : restoredPresentation);
        setAudioRegions(restored.audioRegions);
        setSubtitleRegions(restored.subtitleRegions || []);
        setCropRegion(restored.cropRegion);
        setWallpaper(restored.wallpaper);
        setShadowIntensity(restored.shadowIntensity);
        setShowBlur(restored.showBlur);
        if (restored.motionBlurEnabled !== undefined) setMotionBlurEnabled(restored.motionBlurEnabled);
        if (restored.autoFocusEnabled !== undefined) setAutoFocusEnabled(restored.autoFocusEnabled);
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
        if (restored.cursorStyle !== undefined) setCursorStyle(restored.cursorStyle);
        if (restored.cursorCustomImages !== undefined) {
          setCursorCustomImages(restored.cursorCustomImages);
        } else if (restored.cursorCustomImage) {
          setCursorCustomImages({ default: restored.cursorCustomImage });
        }
        if (restored.cursorOffset !== undefined) setCursorOffset(restored.cursorOffset);
        return "projectModel";
      }
      console.warn("[ProjectModel] Invalid saved sidecar; falling back to legacy project fields", validation.errors);
    }

    if (project.zoomRegions) setZoomRegions(project.zoomRegions);
    if (project.trimRegions) {
      setTrimRegions(project.trimRegions);
      const legacySourceDurationMs = Math.max(0, Number(project.duration ?? duration) * 1000);
      editingSession.restore(migrateLegacyTrimsToEditingDocument(project.trimRegions, legacySourceDurationMs));
    }
    if (project.annotationRegions) setAnnotationRegions(project.annotationRegions);
    if (Array.isArray(project.presentationEffects)) setPresentationEffects(project.presentationEffects);
    else if (project.cameraSourceUrl || project.cameraPosterDataUrl) setPresentationEffects([{ id: 'presenter-recording', kind: 'presenter', startMs: 0, endMs: Math.round((project.projectDurationSeconds ?? project.duration ?? 0) * 1000), sourceUrl: project.cameraSourceUrl, posterDataUrl: project.cameraPosterDataUrl, sourceStartMs: Number(project.cameraSourceStartMs ?? 0), shape: 'circle', bounds: { x: 76, y: 68, width: 18, height: 24 }, visible: true, opacity: 1, fit: 'cover' }]);
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
    setCursorStyle(resolveCursorStyle(project.cursorStyle, project.showVectorCursor ?? true));
    setCursorCustomImages(
      project.cursorCustomImages && typeof project.cursorCustomImages === 'object'
        ? project.cursorCustomImages
        : typeof project.cursorCustomImage === 'string'
          ? { default: project.cursorCustomImage }
          : {},
    );
    if (project.cursorOffset !== undefined) setCursorOffset(project.cursorOffset);
    if (project.cameraPath !== undefined) setCameraPath(project.cameraPath);
    return "legacy";
  }, [duration, editingSession.restore]);

  const handleApplyPreset = useCallback(async () => {
    if (!selectedPresetId) return;
    const result = await window.electronAPI.applyPreset(currentProjectModel, selectedPresetId);
    if (result.success) { applyLoadedProject({ projectModel: result.project }); toast.success('Preset applied; media and timeline kept'); }
  }, [applyLoadedProject, currentProjectModel, selectedPresetId]);

  useEffect(() => {
    if (!originalVideoPath || !defaultPresetId || defaultPresetAppliedRef.current || restoredSavedProjectRef.current) return;
    defaultPresetAppliedRef.current = true;
    void window.electronAPI.applyPreset(currentProjectModel, defaultPresetId).then(result => {
      if (result.success) applyLoadedProject({ projectModel: result.project });
    });
  }, [applyLoadedProject, currentProjectModel, defaultPresetId, originalVideoPath]);

  useEffect(() => {
    async function loadVideo() {
      setInitialProjectLoadComplete(false);
      restoredSavedProjectRef.current = false;
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
          setCursorData([]);
          setSelectedZoomId(null);
          setSelectedTrimId(null);
          setSelectedAnnotationId(null);
          setSelectedAudioId(null);
          
          if ((result as any).audioPath) {
            setCompanionAudioPath((result as any).audioPath);
          } else {
            setCompanionAudioPath(null);
          }
          setCameraPath((result as any).cameraPath || null);

          // If proxy is available, use it for UI playback. Always keep original for export.
          setVideoPath((result as any).proxyPath || result.path);
          setOriginalVideoPath(result.path);
          setError(null);
          
          // Try to load auto-saved project
          const projectResult = await window.electronAPI.loadProject(result.path);
          if (projectResult.success && projectResult.project) {
            restoredSavedProjectRef.current = true;
            const restoredFrom = applyLoadedProject(projectResult.project);
            toast.success("工程已自动恢复");
            console.info(`[ProjectModel] Auto-restored project via ${restoredFrom}`, {
              projectPath: projectResult.projectPath,
              companionAudioPath: projectResult.project?.projectModel
                ? restoreLegacyEditorStateFromProjectModel(projectResult.project.projectModel).companionAudioPath
                : (result as any).audioPath,
            });
          } else {
            restoredSavedProjectRef.current = false;
            // New recording project! Auto-load the companion recorded audio track if available
            if ((result as any).audioPath) {
              const audioUrl = `file://${(result as any).audioPath.replace(/\\/g, '/')}`;
              const tempAudio = new Audio(audioUrl);
              tempAudio.addEventListener('loadedmetadata', () => {
                const durationMs = Math.round(tempAudio.duration * 1000);
                const audioName = "System Audio";
                
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
                  role: 'system-audio' as const,
                };
                
                setAudioRegions([newAudioRegion]);
                console.log("[Auto-Load] Successfully loaded and attached recorded system audio track:", newAudioRegion);
              });
            }
            if ((result as any).microphonePath) {
              const microphonePath = (result as any).microphonePath as string;
              const microphoneUrl = `file://${microphonePath.replace(/\\/g, '/')}`;
              const microphoneAudio = new Audio(microphoneUrl);
              microphoneAudio.addEventListener('loadedmetadata', () => {
                const durationMs = Math.round(microphoneAudio.duration * 1000);
                setAudioRegions(current => [...current, {
                  id: crypto.randomUUID(), startMs: 0, endMs: durationMs, sourceUrl: microphoneUrl,
                  volume: 1, name: 'Microphone', path: microphonePath, totalDurationMs: durationMs,
                  sourceStartMs: 0, sourceEndMs: durationMs, isOriginal: false, isDetached: true, role: 'microphone' as const,
                }]);
              });
            }
          }
          const livePresenter = presenterEffectFromCameraPath((result as any).cameraPath, Number((result as any).durationMs ?? (result as any).cameraDurationMs ?? 1), []);
          if (livePresenter) setPresentationEffects(current => {
            const deduped = presenterEffectFromCameraPath((result as any).cameraPath, livePresenter.endMs, current);
            return deduped ? [...current, deduped] : current;
          });
        } else {
          setError('No recordings found. Please start a new recording to begin editing.');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setInitialProjectLoadComplete(true);
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
    if (!originalVideoPath || !initialProjectLoadComplete) return;
    const timeout = setTimeout(() => {
      setSaveStatus('saving');
      const projectModel = currentProjectModel;
      const projectModelValidation = validateVideoEditorProject(projectModel);
      if (!projectModelValidation.valid) {
        console.warn("[ProjectModel] Generated invalid sidecar model", projectModelValidation.errors);
      } else if (projectModelValidation.warnings.length > 0) {
        console.info("[ProjectModel] Sidecar model warnings", projectModelValidation.warnings);
      }
      const projectData = createProjectAutosaveSnapshot(projectModel, audioRegions);
      window.electronAPI.saveProject(originalVideoPath, projectData).then(result => {
        if (!result.success) throw new Error(result.error || result.message || 'Save failed');
        setSaveStatus('saved');
      }).catch(e => { setSaveStatus('error'); console.error("Auto-save failed", e); toast.error('Auto-save failed', { description: String(e) }); });
    }, 1000); // 1s debounce
    return () => clearTimeout(timeout);
  }, [
    currentProjectModel,
    videoPath, originalVideoPath,
    audioRegions,
    initialProjectLoadComplete,
  ]);

  const handleDurationChange = useCallback((dur: number) => {
    // Chromium can emit durationchange with 0/NaN/Infinity while a restored
    // file source is attaching. Never let that transient metadata erase the
    // validated duration seeded from the project model.
    if (!Number.isFinite(dur) || dur <= 0) return;
    setDuration(current => resolveSourceDurationSeconds(current, dur));
    setPresentationEffects(current => expandPendingPresenterDuration(current, dur * 1000));
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
      if (currentTime >= Math.max(0, projectDuration - 0.05)) {
        handleSeek(0);
        if (playback && video && duration > 0) {
          let replayStarted = false;
          const startReplay = () => {
            if (replayStarted) return;
            replayStarted = true;
            video.removeEventListener('seeked', startReplay);
            playback.play().catch(err => {
              console.error('Video replay failed:', err);
              setIsPlaying(false);
            });
          };
          video.addEventListener('seeked', startReplay, { once: true });
          requestAnimationFrame(() => {
            if (!video.seeking) startReplay();
          });
        } else {
          setIsPlaying(true);
        }
        return;
      }

      if (playback && video && currentTime < mainTrackDuration - 0.05) {
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
    
    const sourceTime = editingRenderPlan.timeMap.mapEffectiveToSource(nextTime * 1000) / 1000;
    if (duration > 0 && sourceTime < duration) {
      video.currentTime = sourceTime;
    } else {
      video.pause();
      video.currentTime = Math.max(0, duration - 0.001);
    }
  }

  const handleSelectZoom = useCallback((id: string | null) => {
    setSelectedZoomId(id);
    if (id) {
      setSelectedPresentationId(null);
      setSelectedSubtitleId(null);
      setSelectedTrimId(null);
      setSelectedAnnotationId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectTrim = useCallback((id: string | null) => {
    setSelectedTrimId(id);
    if (id) {
      setSelectedPresentationId(null);
      setSelectedSubtitleId(null);
      setSelectedZoomId(null);
      setSelectedAnnotationId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectAnnotation = useCallback((id: string | null) => {
    setSelectedAnnotationId(id);
    if (id) {
      setSelectedPresentationId(null);
      setSelectedSubtitleId(null);
      setSelectedZoomId(null);
      setSelectedTrimId(null);
      setSelectedAudioId(null);
      setSelectedVideoId(null);
    }
  }, []);

  const handleSelectAudio = useCallback((id: string | null) => {
    setSelectedAudioId(id);
    if (id) {
      setSelectedPresentationId(null);
      setSelectedSubtitleId(null);
      setSelectedZoomId(null);
      setSelectedTrimId(null);
      setSelectedAnnotationId(null);
      setSelectedVideoId(null);
    }
  }, []);
  const handleSelectSubtitle = useCallback((id: string | null) => { setSelectedSubtitleId(id); if (id) { setSelectedPresentationId(null); setSelectedZoomId(null); setSelectedTrimId(null); setSelectedAnnotationId(null); setSelectedAudioId(null); setSelectedVideoId(null) } }, []);

  const handleSelectPresentation = useCallback((id: string | null) => {
    setSelectedPresentationId(id);
    if (id) {
      setSelectedSubtitleId(null);
      setSelectedZoomId(null);
      setSelectedTrimId(null);
      setSelectedAnnotationId(null);
      setSelectedAudioId(null);
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
      focusMode: 'manual',
      source: 'manual',
    };
    setZoomRegions((prev) => [...prev, newRegion]);
    setSelectedZoomId(id);
    setSelectedTrimId(null);
    setSelectedAnnotationId(null);
  }, []);

  const handleCameraAdded = useCallback((span: Span) => {
    const region = createProductCameraRegion(Math.round(span.start), Math.round(span.end));
    setZoomRegions((prev) => [...prev, region]);
    setSelectedZoomId(region.id);
    setSelectedTrimId(null);
    setSelectedAnnotationId(null);
  }, []);

  const handleCameraMotionChange = useCallback((cameraMotion: NonNullable<ZoomRegion['cameraMotion']>) => {
    if (!selectedZoomId) return;
    setZoomRegions((prev) => prev.map((region) => (
      region.id === selectedZoomId ? { ...region, cameraMotion } : region
    )));
  }, [selectedZoomId]);

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
  const copySelectedFocus = useCallback(() => {
    const region = zoomRegions.find(item => item.id === selectedZoomId && item.kind !== 'camera'); if (!region) return;
    const portable = { version: 1, type: 'toscreen-focus', durationMs: region.endMs - region.startMs, depth: region.depth, focus: region.focus, focusMode: region.focusMode, source: region.source, transition: region.transition ?? 'smooth' };
    localStorage.setItem('toscreen:focus-clipboard', JSON.stringify(portable));
    void navigator.clipboard?.writeText(JSON.stringify(portable)).catch(() => {}); toast.success('Focus copied');
  }, [selectedZoomId, zoomRegions]);
  const pasteFocus = useCallback(async () => {
    let raw = localStorage.getItem('toscreen:focus-clipboard'); try { raw = await navigator.clipboard?.readText() || raw; } catch { /* local portable fallback */ }
    if (!raw) return; try { const data = JSON.parse(raw); if (data.type !== 'toscreen-focus') return; const startMs = Math.round(currentTime * 1000); const region: ZoomRegion = { id: `focus-${Date.now()}`, startMs, endMs: startMs + Math.max(100, Number(data.durationMs)), depth: data.depth, focus: data.focus, focusMode: data.focusMode, source: data.source, transition: data.transition }; setZoomRegions(current => [...current, region]); setSelectedZoomId(region.id); toast.success('Focus pasted'); } catch { toast.error('Clipboard does not contain a Focus clip'); }
  }, [currentTime]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (!(event.metaKey || event.ctrlKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return; if (event.key.toLowerCase() === 'c' && selectedZoomId) { event.preventDefault(); copySelectedFocus(); } if (event.key.toLowerCase() === 'v') { event.preventDefault(); void pasteFocus(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [copySelectedFocus, pasteFocus, selectedZoomId]);

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
  const handleSubtitleSpanChange = useCallback((id: string, span: Span) => setSubtitleRegions(prev => updateSubtitleSpan(prev, id, span.start, span.end)), []);
  const handleSubtitleDelete = useCallback((id: string) => { setSubtitleRegions(prev => deleteSubtitle(prev, id)); setSelectedSubtitleId(selected => selected === id ? null : selected) }, []);

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
    if (!autoFocusEnabled) { toast.info('Auto Focus is disabled for this project.'); return; }
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
      const newRegions = generateAutoZooms(result.clicks, {
        totalDurationMs: recordingDurationMs,
      });

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
  }, [autoFocusEnabled, originalVideoPath, recordingDurationMs]);

  // Check for available auto-zoom data when video loads
  useEffect(() => {
    if (!originalVideoPath || !initialProjectLoadComplete) return;

    let mounted = true;
    const checkAutoZoomData = async () => {
      try {
        const result = await window.electronAPI.readClicksJson(originalVideoPath);
        if (mounted && result.success && result.clicks && result.clicks.length > 0 && !restoredSavedProjectRef.current) {
          console.log(`[AutoZoom] Found ${result.clicks.length} clicks, applying automatically.`);
          setCursorData(result.clicks); // Save actual cursor coordinates array
          setPresentationEffects((current) => current.length > 0 ? current : recordedShortcutEffects(result.clicks ?? []));
          // Loading telemetry must never overwrite a restored or manually edited timeline.
          // Auto-zoom generation is an explicit command through the sidebar button.
        } else if (mounted && !restoredSavedProjectRef.current) {
          // A new recording without telemetry should start empty, but a missing
          // external sidecar must never erase cursor points restored from the project.
          setCursorData([]);
        }
      } catch (err) {
        console.error("Failed to check for auto-zoom data:", err);
      }
    };

    checkAutoZoomData();
    return () => { mounted = false; };
  }, [initialProjectLoadComplete, originalVideoPath]);

  const handleExport = useCallback(async (override?: { format?: 'mp4' | 'gif'; quality?: ExportQuality; gifOptions?: typeof gifOptions }) => {
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
      const exportAudioRegions = resolveExportAudioRegions(
        renderSettings.timeline.audioRegions,
        runtimeAudioRegions,
      );

      const aspectRatioValue = getAspectRatioValue(renderSettings.canvas.aspectRatio);
      const sourceWidth = video.videoWidth || 1920;
      const sourceHeight = video.videoHeight || 1080;

      let exportWidth: number;
      let exportHeight: number;
      let bitrate: number;

      const effectiveQuality = override?.quality ?? renderSettings.exportSettings.quality;
      const effectiveFormat = override?.format ?? exportFormat;
      const effectiveGifOptions = override?.gifOptions ?? gifOptions;
      if (effectiveQuality === 'source') {
        // Use source resolution
        exportWidth = sourceWidth;
        exportHeight = sourceHeight;
        bitrate = 30_000_000;
      } else {
        // Use quality-based target resolution
        const targetHeight = effectiveQuality === 'medium' ? 720 : 1080;

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
        editingRenderPlan,
        videoUrl: originalVideoPath ? toFileUrl(originalVideoPath) : (videoPath ? toFileUrl(videoPath) : ''),
        projectDurationMs: renderSettings.durationMs,
        width: exportWidth,
        height: exportHeight,
        frameRate: 30, // Optimized for speed
        bitrate: Math.min(bitrate, 15_000_000),
        wallpaper: renderSettings.canvas.wallpaper,
        zoomRegions: renderSettings.timeline.zoomRegions,
        trimRegions: renderSettings.timeline.trimRegions,
        annotationRegions: renderSettings.timeline.annotationRegions,
        audioRegions: exportAudioRegions,
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
        cursorStyle: renderSettings.cursor.style,
        cursorCustomImages: renderSettings.cursor.customImages,
        cursorOffset: renderSettings.cursor.offsetMs,
        presentationEffects: renderSettings.effects.presentation,
        onProgress: (progress: ExportProgress) => {
          setExportProgress(progress);
        },
      });

      exporterRef.current = exporter;
      const result = await exporter.export();

      if (result.success && result.blob) {
        const arrayBuffer = await result.blob.arrayBuffer();
        const timestamp = Date.now();
        let saveResult: any;
        if (effectiveFormat === 'gif') {
          const id = crypto.randomUUID(); gifExportIdRef.current = id;
          const removeProgress = window.electronAPI.onGifProgress(value => { if (value.id === id) setExportProgress(current => ({ currentFrame: value.percentage, totalFrames: 100, percentage: value.percentage, estimatedTimeRemaining: current?.estimatedTimeRemaining ?? 0 })); });
          try { saveResult = await window.electronAPI.exportGif(id, arrayBuffer, { ...effectiveGifOptions, endMs: Math.min(effectiveGifOptions.endMs, renderSettings.durationMs) }); } finally { removeProgress(); gifExportIdRef.current = null; }
        } else saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, `export-${timestamp}.mp4`);

        if (saveResult.cancelled) {
          toast.info('Export cancelled');
        } else if (saveResult.success) {
          setLastExportPath(saveResult.path ?? null);
          setExportProgress({ currentFrame: 100, totalFrames: 100, percentage: 100, estimatedTimeRemaining: 0 });
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
  }, [videoPath, originalVideoPath, runtimeAudioRegions, isPlaying, currentProjectModel, currentRenderSettings, exportFormat, gifOptions]);

  const handleCancelExport = useCallback(() => {
    if (exporterRef.current) {
      exporterRef.current.cancel();
      toast.info('Export cancelled');
      setShowExportDialog(false);
      setIsExporting(false);
      setExportProgress(null);
      setExportError(null);
    }
    if (gifExportIdRef.current) void window.electronAPI.cancelGif(gifExportIdRef.current);
  }, []);

  const handleExtractOriginals = useCallback(async () => {
    const roles=new Map<string,string>([['screen-recording','screen-original'],['system-audio','system-audio'],['microphone','microphone'],['presenter-camera','presenter-camera'],['cursor-data','raw-cursor-sidecar']]);
    const sources=currentProjectModel.assets.flatMap(asset=>{const role=String(asset.metadata?.role??asset.metadata?.sourceKind??asset.type);const kind=roles.get(role);if(!kind||!asset.filePath)return[];return[{kind,path:asset.filePath,required:kind==='screen-original',classification:kind.includes('sidecar')?'sidecar' as const:'original' as const}];});
    if(originalVideoPath&&!sources.some(source=>source.kind==='screen-original'))sources.unshift({kind:'screen-original',path:originalVideoPath,required:true,classification:'original'});
    const result = await window.electronAPI.extractOriginals(sources, currentProjectModel,originalVideoPath); if (result.cancelled) return; const missing = result.items.filter((item: any) => item.status !== 'copied'); toast.success(`Extracted ${result.items.length - missing.length} files${missing.length ? `; ${missing.length} missing` : ''}`); if (result.destination) void window.electronAPI.openLocalPath(result.destination);
  }, [currentProjectModel, originalVideoPath]);

  const handleQuickShare = useCallback(async (visibility: 'public' | 'unlisted' | 'private',expiresAt:string|null) => {
    if (!lastExportPath) return;const id=crypto.randomUUID();shareIdRef.current=id;setShareProgress(0);const remove=window.electronAPI.onQuickShareProgress(value=>{if(value.id===id)setShareProgress(value.percentage);});try { const result = await window.electronAPI.quickShare(id,lastExportPath, { title: currentProjectModel.name, visibility, expiresAt, serviceUrl: import.meta.env.VITE_TOPOO_SHARE_URL || 'https://share.topoo.ai' }); toast.success(`Share ready: ${result.url}`); if (result.url) await window.electronAPI.openExternalUrl(result.url); } catch (error) { toast.error(`Upload paused; retry resumes completed parts. ${String(error)}`); }finally{remove();shareIdRef.current=null;setShareProgress(null);}
  }, [currentProjectModel.name, lastExportPath]);

  const runBatchItem=useCallback(async(item:ExportQueueItem,signal:AbortSignal,progress:(value:number)=>void)=>{const raw=item.projectPath?await window.electronAPI.loadSavedProject(item.projectPath):{projectModel:currentProjectModel};const project=raw.projectModel??raw;const validation=validateVideoEditorProject(project);if(!validation.valid)throw new Error(`Invalid saved project: ${validation.errors.join(', ')}`);const settings=getProjectRenderSettings(project);const screenAsset=project.assets.find((asset:any)=>asset.type==='screen-recording'&&asset.filePath);if(!screenAsset?.filePath)throw new Error('Saved project has no original screen asset');const screenClip=project.clips.find((clip:any)=>clip.type==='screen-recording');const sourceDurationMs=Math.max(1,Number(screenClip?.sourceEndMs??settings.durationMs)-Number(screenClip?.sourceStartMs??0));const plan=createEditingRenderPlan(settings.timeline.editingDocument,sourceDurationMs);const exporter=new VideoExporter({editingRenderPlan:plan,videoUrl:toFileUrl(screenAsset.filePath),projectDurationMs:settings.durationMs,width:item.width,height:item.height,frameRate:30,bitrate:item.quality==='medium'?8_000_000:15_000_000,wallpaper:settings.canvas.wallpaper,zoomRegions:settings.timeline.zoomRegions,trimRegions:settings.timeline.trimRegions,annotationRegions:settings.timeline.annotationRegions,audioRegions:resolveExportAudioRegions(settings.timeline.audioRegions,settings.timeline.audioRegions),showShadow:settings.canvas.shadowIntensity>0,shadowIntensity:settings.canvas.shadowIntensity,showBlur:settings.canvas.showBlur,motionBlurEnabled:settings.effects.motionBlurEnabled,borderRadius:settings.canvas.borderRadius,padding:settings.canvas.padding,cropRegion:settings.canvas.cropRegion,cursorData:settings.cursor.data,cursorSize:settings.cursor.size,cursorSmoothing:settings.cursor.smoothing,showVectorCursor:settings.cursor.showVectorCursor,cursorStyle:settings.cursor.style,cursorCustomImages:settings.cursor.customImages,cursorOffset:settings.cursor.offsetMs,presentationEffects:settings.effects.presentation,onProgress:value=>progress(value.percentage)});signal.addEventListener('abort',()=>exporter.cancel(),{once:true});const result=await exporter.export();if(!result.success||!result.blob)throw new Error(result.error||'Batch render failed');const safeName=String(project.name||project.id).replace(/[^a-z0-9_-]+/gi,'-');const base=`${item.outputDirectory}/${safeName}-${item.width}x${item.height}-${item.id.slice(0,6)}`;const data=await result.blob.arrayBuffer();if(item.format==='gif'){const id=crypto.randomUUID();signal.addEventListener('abort',()=>void window.electronAPI.cancelGif(id),{once:true});await window.electronAPI.encodeGifToPath(id,data,{startMs:0,endMs:settings.durationMs,width:item.width,fps:15,loop:0},`${base}.gif`);}else await window.electronAPI.saveBatchOutput(data,`${base}.mp4`);},[currentProjectModel]);

  const memoizedSidebar = useMemo(() => (
          <Sidebar
            selected={wallpaper}
            onWallpaperChange={setWallpaper}
            selectedZoomDepth={selectedZoomId ? zoomRegions.find(z => z.id === selectedZoomId)?.depth : null}
            onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}
            selectedZoomId={selectedZoomId}
            selectedCameraMotion={selectedZoomId ? zoomRegions.find((region) => region.id === selectedZoomId)?.cameraMotion : null}
            onCameraMotionChange={handleCameraMotionChange}
            onZoomDelete={handleZoomDelete}
            selectedZoomInstant={zoomRegions.find(region => region.id === selectedZoomId)?.transition === 'instant'}
            onZoomInstantChange={(instant) => selectedZoomId && setZoomRegions(current => current.map(region => region.id === selectedZoomId ? { ...region, transition: instant ? 'instant' : 'smooth' } : region))}
            onZoomCopy={copySelectedFocus}
            onZoomPaste={() => void pasteFocus()}
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
            onAspectRatioChange={setAspectRatio}
            videoElement={videoPlaybackRef.current?.video || null}
            onExport={() => {
              setExportError(null);
              setExportProgress(null);
              setShowExportDialog(true);
            }}
            selectedAnnotationId={selectedAnnotationId}
            annotationRegions={annotationRegions}
            onAnnotationContentChange={handleAnnotationContentChange}
            onAnnotationTypeChange={handleAnnotationTypeChange}
            onAnnotationStyleChange={handleAnnotationStyleChange}
            onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
            onAnnotationDelete={handleAnnotationDelete}
            cursorSize={cursorSize}
            onCursorSizeChange={setCursorSize}
            cursorSmoothing={cursorSmoothing}
            onCursorSmoothingChange={setCursorSmoothing}
            showVectorCursor={showVectorCursor}
            onShowVectorCursorChange={setShowVectorCursor}
            cursorStyle={cursorStyle}
            onCursorStyleChange={handleCursorStyleChange}
            cursorCustomImages={cursorCustomImages}
            onCursorCustomImagesChange={handleCursorCustomImagesChange}
            cursorOffset={cursorOffset}
            onCursorOffsetChange={setCursorOffset}
            selectedVideoId={selectedVideoId}
            onSelectVideo={setSelectedVideoId}
            isOriginalAudioSelected={audioRegions.some(r => r.id === selectedAudioId && r.isOriginal && !r.isDetached)}
            onSelectAudio={handleSelectAudio}
            onSeparateAudio={handleSeparateAudio}
            hasOriginalAudio={audioRegions.some(r => r.isOriginal && !r.isDetached)}
            selectedPresentation={presentationEffects.find(effect => effect.id === selectedPresentationId) ?? null}
            onPresentationChange={updatePresentationEffect}
            onPresentationDelete={deletePresentationEffect}
            playheadMs={Math.round(currentTime * 1000)}
            mediaFeaturesOpen={showMediaFeatures}
            onOpenMediaFeatures={() => setShowMediaFeatures(true)}
            presetControls={(
              <PresetControls
                presets={presets}
                selectedPresetId={selectedPresetId}
                defaultPresetId={defaultPresetId}
                onSelectedPresetChange={setSelectedPresetId}
                onCreate={() => void handleCreatePreset()}
                onApply={() => void handleApplyPreset()}
                onUpdate={() => void handleUpdatePreset()}
                onDelete={() => void handleDeletePreset()}
                onSetDefault={() => void handleSetDefaultPreset()}
                onImport={() => void handleImportPreset()}
                onExport={() => void handleExportPreset()}
              />
            )}
          />
        ), [
          wallpaper, zoomRegions, selectedZoomId, selectedTrimId, shadowIntensity,
          showBlur, motionBlurEnabled, borderRadius, padding, cropRegion, aspectRatio,
          exportQuality, selectedAnnotationId, annotationRegions, cursorSize,
          cursorSmoothing, showVectorCursor, cursorStyle, cursorCustomImages, cursorOffset, selectedVideoId, selectedAudioId, audioRegions, presentationEffects, selectedPresentationId, currentTime, showMediaFeatures,
          presets, selectedPresetId, defaultPresetId,
          handleZoomDepthChange, handleZoomDelete, handleCameraMotionChange, handleTrimDelete, copySelectedFocus, pasteFocus,
          handleAnnotationContentChange, handleAnnotationTypeChange,
          handleAnnotationStyleChange, handleAnnotationFigureDataChange, handleAnnotationDelete,
          videoPlaybackRef.current?.video, handleSeparateAudio, handleSelectAudio, handleCursorStyleChange, handleCursorCustomImagesChange, updatePresentationEffect, deletePresentationEffect,
          handleCreatePreset, handleApplyPreset, handleUpdatePreset, handleDeletePreset, handleSetDefaultPreset, handleImportPreset, handleExportPreset
        ]);

  if (loading) {
    return (
      <div 
        className="flex h-full w-full flex-col bg-[var(--ui-shell)] text-[var(--ui-text-primary)] overflow-hidden"
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
      className={`flex h-full w-full flex-col bg-[var(--ui-bg)] text-[var(--ui-text-primary)] overflow-hidden selection:bg-[#34B27B]/30${isLayoutResizing ? ' is-layout-resizing' : ''}`}
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
          setInitialProjectLoadComplete(false);
          restoredSavedProjectRef.current = false;
          // Reset all regions and selection states on dropping new video
          setZoomRegions([]);
          setTrimRegions([]);
          setAnnotationRegions([]);
          setAudioRegions([]);
          setCursorData([]);
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
          try {
            const projectResult = await window.electronAPI.loadProject(path);
            if (projectResult.success && projectResult.project) {
              restoredSavedProjectRef.current = true;
              const restoredFrom = applyLoadedProject(projectResult.project);
              console.info(`[ProjectModel] Drop-restored project via ${restoredFrom}`, {
                projectPath: projectResult.projectPath,
                companionAudioPath: projectResult.project?.projectModel
                  ? restoreLegacyEditorStateFromProjectModel(projectResult.project.projectModel).companionAudioPath
                  : null,
              });
            }
          } finally {
            setInitialProjectLoadComplete(true);
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
      <div className="h-10 flex-shrink-0 z-50 flex items-center gap-2 pl-20 pr-3" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <strong className="max-w-48 truncate text-xs">{projectName}</strong>
        <span className={`text-[10px] ${saveStatus === 'error' ? 'text-red-500' : 'text-[var(--ui-text-secondary)]'}`}>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved'}</span>
        <div className="ml-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-7 items-center gap-1 rounded-[5px] px-2 text-[11px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]">
                Project
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="toscreen-dropdown-menu z-[220] min-w-44 rounded-[8px] border-0 p-1.5">
              <DropdownMenuItem disabled={!originalVideoPath} onSelect={() => void handleSaveProject()} className="h-8 rounded-[5px] text-[11px]">
                Save
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleSaveAsProject()} className="h-8 rounded-[5px] text-[11px]">
                Save As…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={async () => { const result = await window.electronAPI.exportProjectPackage(); if (result.success) toast.success(`Package exported with ${result.assetCount} assets`); else if (!result.cancelled) toast.error(result.error || 'Package export failed'); }} className="h-8 rounded-[5px] text-[11px]">
                Export project package…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="ml-auto flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <TopooUserPill />
        </div>
      </div>

      <div className="flex-1 p-1 min-h-0 relative">
        <PanelGroup
          key="editor-horizontal-layout-v1"
          direction="horizontal"
          autoSaveId="toscreen-editor-sidebar-layout"
        >
          <Panel defaultSize={78} minSize={60}>
            {/* Left Column - Video & Timeline */}
            <div className="flex flex-col min-w-0 h-full">
              <div
                ref={verticalEditorSplitRef}
                className="ui-glass-surface grid h-full min-h-0 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-timeline-surface)]"
                style={{
                  gridTemplateRows: 'minmax(0, var(--preview-panel-fr, 55fr)) minmax(0, var(--timeline-panel-fr, 45fr))',
                }}
              >
            {/* Top section: video preview and controls */}
            <div className="min-h-0 overflow-hidden bg-[var(--ui-preview-shell)]">
              <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                {/* Video preview */}
                <div
                  ref={canvasWorkspaceRef}
                  className="relative w-full h-full p-1.5 flex items-center justify-center overflow-hidden"
                  style={{ containerType: 'size' }}
                >
                  <div
                    ref={canvasFrameRef}
                    className="relative shrink-0"
                    style={{
                      width: `min(100cqw, calc(100cqh * ${getAspectRatioValue(currentRenderSettings.canvas.aspectRatio)}))`,
                      maxWidth: '100%',
                      maxHeight: '100%',
                      aspectRatio: getAspectRatioValue(currentRenderSettings.canvas.aspectRatio),
                      boxSizing: 'border-box',
                    }}
                  >
                    <VideoPlayback
                      editingRenderPlan={editingRenderPlan}
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
                          projectDuration > mainTrackDuration &&
                          currentTimeStateRef.current >= mainTrackDuration - 0.05 &&
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
                          projectDuration > mainTrackDuration &&
                          currentTimeStateRef.current >= mainTrackDuration - 0.05 &&
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
                      cursorStyle={currentRenderSettings.cursor.style}
                      cursorCustomImages={currentRenderSettings.cursor.customImages}
                      cursorData={currentRenderSettings.cursor.data}
                      cursorOffset={currentRenderSettings.cursor.offsetMs}
                      isLayoutResizing={isLayoutResizing}
                      presentationEffects={currentRenderSettings.effects.presentation}
                      selectedPresentationId={selectedPresentationId}
                      onSelectPresentation={handleSelectPresentation}
                      onPresentationBoundsChange={(id, bounds) => {
                        const effect = presentationEffects.find(item => item.id === id);
                        if (effect?.kind === 'mask' && effect.follow === 'keyframes') updatePresentationEffect(id, { bounds, followKeyframes: [...effect.followKeyframes.filter(point => Math.abs(point.timeMs - currentTime * 1000) > 1), { timeMs: Math.round(currentTime * 1000), x: bounds.x, y: bounds.y }] } as Partial<PresentationEffectRegion>);
                        else updatePresentationEffect(id, { bounds } as Partial<PresentationEffectRegion>);
                      }}
                    />
                  </div>
                  <PresentationToolbar
                    timeMs={Math.round(currentTime * 1000)}
                    durationMs={Math.round(projectDuration * 1000)}
                    effects={presentationEffects}
                    placement={presentationToolbarPlacement}
                    onAdd={(effect) => { setPresentationEffects((current) => [...current, effect]); handleSelectPresentation(effect.id); }}
                    onRemove={deletePresentationEffect}
                  />
                </div>
              </div>
            </div>

            {/* Timeline section */}
            <div className="relative z-10 -mx-px -mb-px h-[calc(100%+1px)] w-[calc(100%+2px)] min-h-0 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-timeline-card-surface)] flex flex-col">
                <div
                  className="group h-2 shrink-0 bg-transparent flex items-start justify-center pt-[5px] cursor-row-resize"
                  onPointerDown={handleVerticalSplitPointerDown}
                  role="separator"
                  aria-orientation="horizontal"
                >
                  <div className="w-8 h-[3px] rounded-full bg-[var(--ui-border-strong)] transition-colors group-hover:bg-[var(--ui-text-tertiary)]"></div>
                </div>
                <TimelineEditor
                  editingSession={editingSession}
                  videoDuration={projectDuration}
                  sourceVideoDuration={duration}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                  videoRef={videoElementRef}
                  zoomRegions={zoomRegions}
                  onZoomAdded={handleZoomAdded}
                  onCameraAdded={handleCameraAdded}
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
                  subtitleRegions={subtitleRegions}
                  onSubtitleSpanChange={handleSubtitleSpanChange}
                  onSubtitleDelete={handleSubtitleDelete}
                  selectedSubtitleId={selectedSubtitleId}
                  onSelectSubtitle={handleSelectSubtitle}
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
                  onAutoZoom={handleAutoZoom}
                  autoFocusEnabled={autoFocusEnabled}
                  onAutoFocusEnabledChange={setAutoFocusEnabled}
                  isFullScreenBinding={isFullScreenBinding}
                  onFullScreenBindingChange={setIsFullScreenBinding}
                  isPlaying={isPlaying}
                  onTogglePlayPause={togglePlayPause}
                  selectedVideoId={selectedVideoId}
                  onSelectVideo={setSelectedVideoId}
                  videoPath={videoPath ? toFileUrl(videoPath) : undefined}
                  presentationEffects={presentationEffects}
                  selectedPresentationId={selectedPresentationId}
                  onSelectPresentation={handleSelectPresentation}
                  onPresentationAdded={(span) => {
                    const effect: PresentationEffectRegion = { id: `presentation-${Date.now()}`, startMs: Math.round(span.start), endMs: Math.round(span.end), kind: 'cursor-visibility', visible: false };
                    setPresentationEffects(current => [...current, effect]); setSelectedPresentationId(effect.id);
                  }}
                  onPresentationSpanChange={changePresentationSpan}
                  onPresentationDelete={deletePresentationEffect}
                />
            </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle
            className="w-1 shrink-0 bg-transparent cursor-col-resize"
            onDragging={handlePanelLayoutResize}
          />

          <Panel defaultSize={22} minSize={18} maxSize={36}>
            {/* Right section: Sidebar */}
            <div className="h-full min-w-0">
              {showMediaFeatures ? (
                <MediaFeaturesPanel
                  currentTimeMs={Math.round(currentTime * 1000)}
                  audioRegions={audioRegions}
                  onAddAudio={handleAudioAdded}
                  subtitles={subtitleRegions}
                  onChangeSubtitles={setSubtitleRegions}
                  selectedSubtitleId={selectedSubtitleId}
                  onSelectSubtitle={handleSelectSubtitle}
                  onClose={() => setShowMediaFeatures(false)}
                />
              ) : memoizedSidebar}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <Toaster theme={theme} className="pointer-events-auto" />

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        progress={exportProgress}
        isExporting={isExporting}
        error={exportError}
        quality={exportQuality}
        onQualityChange={setExportQuality}
        onStart={() => handleExport()}
        onCancel={handleCancelExport}
        format={exportFormat}
        onFormatChange={setExportFormat}
        gifOptions={{ ...gifOptions, endMs: gifOptions.endMs || Math.round(projectDuration * 1000) }}
        onGifOptionsChange={setGifOptions}
        onExtractOriginals={handleExtractOriginals}
        onQuickShare={lastExportPath ? handleQuickShare : undefined}
        currentProjectId={currentProjectModel.id}
        onRunBatchItem={runBatchItem}
        shareProgress={shareProgress}
        onCancelShare={()=>{if(shareIdRef.current)void window.electronAPI.cancelQuickShare(shareIdRef.current);}}
      />
    </div>
  );
}
