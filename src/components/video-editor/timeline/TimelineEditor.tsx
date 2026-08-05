import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTimelineContext } from "dnd-timeline";
import { useWaveformCache } from "../hooks/useWaveformCache";
import { Button } from "../../ui/button";
import { Orbit, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import {
  PiCornersOutBold,
  PiCrosshairBold,
  PiMagicWandBold,
  PiMagnetBold,
  PiMagnifyingGlassPlusBold,
  PiScissorsBold,
  PiTextTBold,
} from "react-icons/pi";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { useTimeMap } from "../hooks/useTimeMap";
import { timelineMediaIsAvailable } from "./timelineMediaAvailability";
import TimelineWrapper from "./TimelineWrapper";
import Row from "./Row";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
import { partitionIntoTimelineLanes } from "./lanePartition";
import { clampAudioResizeSpanToSource, resolveAudioResizeBounds } from "./timelineAudioResizeBounds";
import { getTimelineMagneticSnapResult, getTimelineMagneticSnapSpan } from "./timelineMagneticSnap";
import type { TimelineMagneticSnapResult } from "./timelineMagneticSnap";
import { constrainFocusDragSpan, constrainFocusResizeSpan } from "./timelineFocusSpan";
import { buildMainClipSegments } from "./timelineMainClipSegments";
import {
  buildAssociatedOriginalAudioForSourceRange,
  getAttachedOriginalAudio,
  getStandaloneAudioRegions,
} from "./timelineOriginalAudio";
import { resolveTimelinePlayheadDisplayTime } from "./timelinePlayheadTime";
import { resolveTimelineSeekFromClientX } from "./timelineSeekMapping";
import { FALLBACK_TRACK_START_PX, resolveTrackStartPx } from "./timelineTrackOrigin";
import type { Range, Span } from "dnd-timeline";
import type { ZoomRegion, TrimRegion, AnnotationRegion, AudioRegion } from "../types";
import type { PresentationEffectRegion } from "../presentation/types";
import type { SubtitleRegion } from '../mediaFeatures';
import { v4 as uuidv4 } from 'uuid';
import type { EditingCommand, EditingDocument, MainTrackTimeMap } from '../editing';

import PlaybackControls from "../PlaybackControls";

const ZOOM_ROW_ID = "row-zoom-0";
const CAMERA_ROW_ID = "row-camera-0";
const TRIM_ROW_ID = "row-trim";
const PRESENTATION_ROW_ID = "row-presentation";

function TimelineToolTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group relative flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-[70] mt-1.5 whitespace-nowrap rounded-[4px] bg-[var(--ui-text-primary)] px-2 py-1 text-[10px] font-medium text-[var(--ui-inspector-surface)] opacity-0 shadow-md transition-opacity delay-300 duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}
const VIDEO_ROW_ID = "row-video";
const FALLBACK_RANGE_MS = 1000;
const TARGET_MARKER_COUNT = 12;

function getTrackStartPx(timeline: HTMLElement | null) {
  if (!timeline) return FALLBACK_TRACK_START_PX;
  const trackArea = timeline.querySelector<HTMLElement>('[data-timeline-track-area="true"]');
  if (!trackArea) return FALLBACK_TRACK_START_PX;

  const timelineRect = timeline.getBoundingClientRect();
  const trackRect = trackArea.getBoundingClientRect();
  return resolveTrackStartPx({
    timelineLeftPx: timelineRect.left,
    trackLeftPx: trackRect.left,
  });
}

interface TimelineEditorProps {
  editingSession?: {
    document: EditingDocument;
    timeMap: MainTrackTimeMap;
    execute: (command: EditingCommand) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
  };
  videoDuration: number;
  sourceVideoDuration?: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  zoomRegions: ZoomRegion[];
  onZoomAdded: (span: Span) => void;
  onCameraAdded?: (span: Span) => void;
  onZoomSpanChange: (id: string, span: Span) => void;
  onZoomSplit?: (id: string, splitAtMs: number) => void;
  onZoomDelete: (id: string) => void;
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
  trimRegions?: TrimRegion[];
  onTrimAdded?: (span: Span) => void;
  onTrimSpanChange?: (id: string, span: Span) => void;
  onTrimDelete?: (id: string) => void;
  selectedTrimId?: string | null;
  onSelectTrim?: (id: string | null) => void;
  annotationRegions?: AnnotationRegion[];
  onAnnotationAdded?: (span: Span) => void;
  onAnnotationSpanChange?: (id: string, span: Span) => void;
  onAnnotationDelete?: (id: string) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  subtitleRegions?: SubtitleRegion[];
  onSubtitleSpanChange?: (id: string, span: Span) => void;
  onSubtitleDelete?: (id: string) => void;
  selectedSubtitleId?: string | null;
  onSelectSubtitle?: (id: string | null) => void;
  audioRegions?: AudioRegion[];
  onAudioAdded?: (span: Span) => void;
  onAudioSpanChange?: (id: string, span: Span) => void;
  onAudioTrackChange?: (id: string, trackIndex: number) => void;
  onAudioDelete?: (id: string) => void;
  selectedAudioId?: string | null;
  onSelectAudio?: (id: string | null) => void;
  waveformCache?: any;
  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;
  onAudioVolumeChange?: (id: string, volume: number) => void;
  onAutoZoom?: () => void;
  isFullScreenBinding: boolean;
  onFullScreenBindingChange: (enabled: boolean) => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
  onTimelineResizeStart?: () => void;
  onTimelineResizeEnd?: () => void;
  videoPath?: string;
  presentationEffects?: PresentationEffectRegion[];
  selectedPresentationId?: string | null;
  onSelectPresentation?: (id: string | null) => void;
  onPresentationAdded?: (span: Span) => void;
  onPresentationSpanChange?: (id: string, span: Span) => void;
  onPresentationDelete?: (id: string) => void;
}

interface TimelineScaleConfig {
  intervalMs: number;
  gridMs: number;
  minItemDurationMs: number;
  defaultItemDurationMs: number;
  minVisibleRangeMs: number;
}

interface TimelineRenderItem {
  id: string;
  rowId: string;
  span: Span;
  label: string;
  zoomDepth?: number;
  variant: 'zoom' | 'trim' | 'annotation' | 'presentation' | 'audio' | 'video' | 'speed';
  sourceUrl?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  totalDurationMs?: number;
  startMs?: number;
  volume?: number;
  volumeKeyframes?: any[];
  speedRate?: number;
  audioPeaks?: number[];
  audioPeaksDurationMs?: number;
  associatedAudio?: AudioRegion;
}

const SCALE_CANDIDATES = [
  { intervalSeconds: 0.25, gridSeconds: 0.05 },
  { intervalSeconds: 0.5, gridSeconds: 0.1 },
  { intervalSeconds: 1, gridSeconds: 0.25 },
  { intervalSeconds: 2, gridSeconds: 0.5 },
  { intervalSeconds: 5, gridSeconds: 1 },
  { intervalSeconds: 10, gridSeconds: 2 },
  { intervalSeconds: 15, gridSeconds: 3 },
  { intervalSeconds: 30, gridSeconds: 5 },
  { intervalSeconds: 60, gridSeconds: 10 },
  { intervalSeconds: 120, gridSeconds: 20 },
  { intervalSeconds: 300, gridSeconds: 30 },
  { intervalSeconds: 600, gridSeconds: 60 },
  { intervalSeconds: 900, gridSeconds: 120 },
  { intervalSeconds: 1800, gridSeconds: 180 },
  { intervalSeconds: 3600, gridSeconds: 300 },
];

function calculateTimelineScale(durationSeconds: number): TimelineScaleConfig {
  const totalMs = Math.max(0, Math.round(durationSeconds * 1000));

  const selectedCandidate = SCALE_CANDIDATES.find((candidate) => {
    if (durationSeconds <= 0) {
      return true;
    }
    const markers = durationSeconds / candidate.intervalSeconds;
    return markers <= TARGET_MARKER_COUNT;
  }) ?? SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1];

  const intervalMs = Math.round(selectedCandidate.intervalSeconds * 1000);
  const gridMs = Math.round(selectedCandidate.gridSeconds * 1000);

  // Set minItemDurationMs to 1ms for maximum granularity
  const minItemDurationMs = 1;
  const defaultItemDurationMs = Math.min(
    Math.max(minItemDurationMs, intervalMs * 2),
    totalMs > 0 ? totalMs : intervalMs * 2,
  );

  const minVisibleRangeMs = totalMs > 0
    ? Math.min(Math.max(intervalMs * 3, minItemDurationMs * 6, 1000), totalMs)
    : Math.max(intervalMs * 3, minItemDurationMs * 6, 1000);

  return {
    intervalMs,
    gridMs,
    minItemDurationMs,
    defaultItemDurationMs,
    minVisibleRangeMs,
  };
}

function createInitialRange(totalMs: number): Range {
  if (totalMs > 0) {
    return { start: 0, end: totalMs };
  }

  return { start: 0, end: FALLBACK_RANGE_MS };
}

function formatTimeLabel(milliseconds: number, intervalMs: number) {
  const totalSeconds = milliseconds / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const fractionalDigits = intervalMs < 250 ? 2 : intervalMs < 1000 ? 1 : 0;

  if (hours > 0) {
    const minutesString = minutes.toString().padStart(2, "0");
    const secondsString = Math.floor(seconds)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutesString}:${secondsString}`;
  }

  if (fractionalDigits > 0) {
    const secondsWithFraction = seconds.toFixed(fractionalDigits);
    const [wholeSeconds, fraction] = secondsWithFraction.split(".");
    return `${minutes}:${wholeSeconds.padStart(2, "0")}.${fraction}`;
  }

  return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

function PlaybackCursor({ 
  currentTimeMs: _currentTimeMs, 
  videoDurationMs,
  onSeek,
  timelineRef,
  videoRef,
  mapSourceToEffective,
  mapEffectiveToSource,
  isTrimTrackVisible,
  trackStartPx,
  freezeExternalTime,
}: { 
  currentTimeMs: number; 
  videoDurationMs: number;
  onSeek?: (time: number) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mapSourceToEffective?: (ms: number) => number;
  mapEffectiveToSource?: (ms: number) => number;
  isTrimTrackVisible?: boolean;
  trackStartPx: number;
  freezeExternalTime?: boolean;
}) {
  const { direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";
  const [isDragging, setIsDragging] = useState(false);
  const cursorLineRef = useRef<HTMLDivElement>(null);
  const cursorContainerRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef(isDragging);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const currentTimeMsRef = useRef(_currentTimeMs);
  useEffect(() => {
    currentTimeMsRef.current = _currentTimeMs;
  }, [_currentTimeMs]);

  // High-frequency DOM update via rAF — bypasses React render entirely
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const line = cursorLineRef.current;
      const container = cursorContainerRef.current;
      if (!line || !container) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const video = videoRef?.current;
      const { displayTimeMs } = resolveTimelinePlayheadDisplayTime({
        currentTimeMs: currentTimeMsRef.current,
        externalVideoTimeMs: video ? video.currentTime * 1000 : undefined,
        isVideoPlaying: !!video && !video.paused && !Number.isNaN(video.currentTime),
        isDragging: isDraggingRef.current,
        freezeExternalTime,
        isTrimTrackVisible,
        mapSourceToEffective,
      });

      // --- 关键防守与解绑逻辑 ---
      // 1. 防御 NaN 或 Infinity，避免 valueToPixels 崩溃导致游标飞到 0px
      if (displayTimeMs === null || !Number.isFinite(videoDurationMs) || videoDurationMs <= 0) {
        container.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      const finalTimeMs = displayTimeMs;

      if (finalTimeMs < 0) {
        container.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const clampedTime = Math.max(0, finalTimeMs);
      if (clampedTime < range.start || clampedTime > range.end) {
        container.style.display = 'none';
      } else {
        container.style.display = '';
        const offset = valueToPixels(clampedTime - range.start);
        line.style[sideProperty as any] = `${trackStartPx + offset - 0.5}px`;
      }
      
      rafId = requestAnimationFrame(tick);
    };
    
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef, videoDurationMs, range.start, range.end, trackStartPx, sideProperty, valueToPixels, mapSourceToEffective, isTrimTrackVisible, freezeExternalTime]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !onSeek) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const { sourceMs } = resolveTimelineSeekFromClientX({
        clientX: e.clientX,
        timelineLeftPx: rect.left,
        trackStartPx,
        rangeStartMs: range.start,
        durationMs: videoDurationMs,
        pixelsToValue,
        mapEffectiveToSource,
        isTrimTrackVisible,
      });
      
      onSeek(sourceMs / 1000);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, onSeek, timelineRef, trackStartPx, range.start, videoDurationMs, pixelsToValue, isTrimTrackVisible, mapEffectiveToSource]);

  return (
    <div
      ref={cursorContainerRef}
      className="absolute top-0 bottom-0 z-50 group/cursor inset-x-0"
      style={{
        pointerEvents: 'none',
      }}
    >
      <div
        ref={cursorLineRef}
        className="pointer-events-none absolute top-0 bottom-0 -ml-[8px] flex w-[16px] justify-center group/line"
      >
        <div className="w-[1px] h-full bg-[#FF00B7]" />
        <div
          className="pointer-events-auto absolute left-1/2 top-0 flex h-[16px] w-[18px] -translate-x-1/2 cursor-grab flex-col items-center transition-transform hover:scale-110 active:cursor-grabbing"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 上半部方块 */}
          <div className="w-2.5 h-2 bg-[#FF00B7] rounded-t-[1px]" />
          {/* 下半部尖角 */}
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#FF00B7]" />
        </div>
      </div>
    </div>
  );
}

const TimelineAxis = memo(({
  intervalMs,
  videoDurationMs,
  trackStartPx,
}: {
  intervalMs: number;
  videoDurationMs: number;
  trackStartPx: number;
}) => {
  const { direction, range, valueToPixels } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";

  const markers = useMemo(() => {
    if (intervalMs <= 0) {
      return { markers: [], minorTicks: [] };
    }

    const maxTime = Math.max(videoDurationMs > 0 ? videoDurationMs : 0, range.end);
    const visibleStart = Math.max(0, Math.min(range.start, maxTime));
    const visibleEnd = Math.min(range.end, maxTime);
    const markerTimes = new Set<number>();

    const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;

    for (let time = firstMarker; time <= maxTime; time += intervalMs) {
      if (time >= visibleStart && time <= visibleEnd) {
        markerTimes.add(Math.round(time));
      }
    }

    if (visibleStart <= maxTime) {
      markerTimes.add(Math.round(visibleStart));
    }
    
    if (videoDurationMs > 0) {
      markerTimes.add(Math.round(videoDurationMs));
    }

    const sorted = Array.from(markerTimes)
      .filter(time => time <= maxTime)
      .sort((a, b) => a - b);

    const minorTicks = [];
    const minorInterval = intervalMs / 20;
    const firstMinorTick = Math.ceil(visibleStart / minorInterval) * minorInterval;
    
    for (let time = firstMinorTick; time <= maxTime; time += minorInterval) {
      if (time >= visibleStart && time <= visibleEnd) {
        const isMajor = Math.abs(time % intervalMs) < 1;
        if (!isMajor) {
          minorTicks.push(time);
        }
      }
    }

    return { 
      markers: sorted.map((time) => ({
        time,
        label: formatTimeLabel(time, intervalMs),
      })), 
      minorTicks 
    };
  }, [intervalMs, range.end, range.start, videoDurationMs]);

  return (
    <div
      className="h-8 bg-transparent border-b border-[var(--ui-border)] relative overflow-hidden select-none w-full"
    >
      {markers.minorTicks.map((time) => {
        const offset = valueToPixels(time - range.start);
        return (
          <div
            key={`minor-${time}`}
            className="absolute top-0 h-1 w-px bg-[var(--ui-border)]"
            style={{ [sideProperty]: `${trackStartPx + offset}px` }}
          />
        );
      })}

      {markers.markers.map((marker) => {
        const offset = valueToPixels(marker.time - range.start);
        return (
          <div 
            key={marker.time} 
            className="absolute bottom-0 h-full flex flex-col justify-end items-center"
            style={{
              [sideProperty]: `${trackStartPx + offset}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex flex-col items-center pb-1">
              <div className="h-2 w-px bg-[var(--ui-border-strong)] mb-1" />
              <span className="text-[10px] font-medium tabular-nums tracking-tight text-[var(--ui-text-tertiary)]">
                {marker.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}, (prev, next) => {
  // Only re-render axis if scale, duration, or sidebar width changes
  return (
    prev.intervalMs === next.intervalMs &&
    prev.videoDurationMs === next.videoDurationMs &&
    prev.trackStartPx === next.trackStartPx
  );
});

function Timeline({
  items,
  zoomRegions,
  zoomBoundaryRegions,
  videoDurationMs,
  intervalMs,
  currentTimeMs,
  onSeek,
  onSelectZoom,
  onSelectTrim,
  onSelectAnnotation,
  selectedZoomId,
  selectedTrimId,
  selectedAnnotationId,
  selectedSubtitleId,
  onSelectSubtitle,
  onAddZoom,
  onAddCamera,
  onAddAnnotation,
  selectedAudioId,
  onSelectAudio,
  waveformCache,
  onAudioVolumeKeyframesChange,
  onItemSpanChange,
  onItemResizePreview,
  onTimelineResizeStart,
  onTimelineResizeEnd,
  videoRef,
  mapSourceToEffective,
  mapEffectiveToSource,
  isTrimTrackVisible,
  selectedVideoId,
  onSelectVideo,
  isTimelineResizing,
  snapGuideMs,
  getVisualSnapSpan,
  getVisualResizeSnapSpan,
  selectedPresentationId,
  onSelectPresentation,
  onAddPresentation,
}: {
  items: TimelineRenderItem[];
  zoomRegions: ZoomRegion[];
  zoomBoundaryRegions?: ZoomRegion[];
  videoDurationMs: number;
  intervalMs: number;
  currentTimeMs: number;
  onSeek?: (time: number) => void;
  onSelectZoom?: (id: string | null) => void;
  onSelectTrim?: (id: string | null) => void;
  onSelectAnnotation?: (id: string | null) => void;
  selectedZoomId: string | null;
  selectedTrimId?: string | null;
  selectedAnnotationId?: string | null;
  selectedSubtitleId?: string | null;
  onSelectSubtitle?: (id: string | null) => void;
  onAddZoom?: () => void;
  onAddCamera?: () => void;
  onAddAnnotation?: () => void;
  selectedAudioId?: string | null;
  onSelectAudio?: (id: string | null) => void;
  waveformCache?: any;
  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;
  onItemSpanChange?: (id: string, span: Span) => void;
  onItemResizePreview?: (id: string, span: Span | null) => void;
  onTimelineResizeStart?: () => void;
  onTimelineResizeEnd?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mapSourceToEffective?: (ms: number) => number;
  mapEffectiveToSource?: (ms: number) => number;
  isTrimTrackVisible?: boolean;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
  isTimelineResizing?: boolean;
  snapGuideMs?: number | null;
  getVisualSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  getVisualResizeSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  selectedPresentationId?: string | null;
  onSelectPresentation?: (id: string | null) => void;
  onAddPresentation?: () => void;
}) {
  
  const trackRenderer = useMemo(() => {
    const hasAssociatedAudio = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio);
    const isAssociatedAudioSelected = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio?.id === selectedAudioId);
    // The attached-audio accordion is rendered inside the Main Track item.
    // Leave enough room for its 92px collapsed / 110px expanded content plus
    // the item's 3px top and bottom breathing margins so it stays contained.
    const videoRowHeight = hasAssociatedAudio
      ? (isAssociatedAudioSelected ? 122 : 104)
      : 82;

    return (
       <>
        {/* Base Video Track */}
        <Row id={VIDEO_ROW_ID} height={videoRowHeight}>
        {items.filter(item => item.rowId === VIDEO_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={selectedVideoId === item.id}
            onSelect={() => {
              onSelectVideo?.(item.id);
              onSelectZoom?.(null);
              onSelectTrim?.(null);
              onSelectAnnotation?.(null);
              onSelectAudio?.(null);
            }}
            variant="video"
            sourceUrl={item.sourceUrl}
            associatedAudio={item.associatedAudio}
            isAudioSelected={selectedAudioId === item.associatedAudio?.id}
            onSelectAudio={() => {
              if (item.associatedAudio) {
                onSelectAudio?.(item.associatedAudio.id);
                onSelectVideo?.(null);
                onSelectZoom?.(null);
                onSelectTrim?.(null);
                onSelectAnnotation?.(null);
              }
            }}
            audioPeaks={item.associatedAudio?.sourceUrl ? waveformCache.get(item.associatedAudio.sourceUrl)?.peaks : undefined}
            sourceStartMs={item.sourceStartMs ?? 0}
            sourceEndMs={item.sourceEndMs}
            totalDurationMs={item.totalDurationMs}
            zoomRegions={zoomRegions}
            zoomBoundaryRegions={zoomBoundaryRegions}
            onVolumeKeyframesChange={(keyframes) => onAudioVolumeKeyframesChange?.(item.associatedAudio!.id, keyframes)}
          >
            {item.label}
          </Item>
        ))}

        {/* 物理 Trim 轨道废除，直接渲染在 VIDEO_ROW 内，使其贴底绝对定位 */}
        {items.filter(item => item.rowId === TRIM_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={VIDEO_ROW_ID} // 强行挂载在主轨中
            span={item.span}
            isSelected={item.id === selectedTrimId}
            onSelect={() => onSelectTrim?.(item.id)}
            variant="trim"
            isNestedTrim={true}
          >
            {item.label}
          </Item>
        ))}
      </Row>

      <Row id={CAMERA_ROW_ID} onAddClick={onAddCamera}>
        {items.filter(item => item.rowId === CAMERA_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedZoomId}
            onSelect={() => onSelectZoom?.(item.id)}
            variant="zoom"
            zoomDepth={item.zoomDepth}
          >
            {item.label}
          </Item>
        ))}
      </Row>
      
      {(() => {
        const zoomRowIds = Array.from(new Set(
          items.filter(item => item.rowId.startsWith("row-zoom-")).map(item => item.rowId)
        )).sort();
        const finalZoomRowIds = zoomRowIds.length > 0 ? zoomRowIds : [ZOOM_ROW_ID];

        return finalZoomRowIds.map((rowId) => (
          <Row id={rowId} key={rowId} onAddClick={onAddZoom}>
            {items.filter(item => item.rowId === rowId).map((item) => (
              <Item
                id={item.id}
                key={item.id}
                rowId={item.rowId}
                span={item.span}
                isSelected={item.id === selectedZoomId}
                onSelect={() => onSelectZoom?.(item.id)}
                variant="zoom"
                zoomDepth={item.zoomDepth}
              >
                {item.label}
              </Item>
            ))}
          </Row>
        ));
      })()}

      <Row id={PRESENTATION_ROW_ID} onAddClick={onAddPresentation}>
        {items.filter(item => item.rowId === PRESENTATION_ROW_ID).map((item) => (
          <Item key={item.id} id={item.id} rowId={item.rowId} span={item.span}
            isSelected={item.id === selectedPresentationId}
            onSelect={() => onSelectPresentation?.(item.id)} variant="presentation"
            onDirectSpanChange={onItemSpanChange} onDirectSpanPreview={onItemResizePreview}
            onDirectResizeStart={onTimelineResizeStart} onDirectResizeEnd={onTimelineResizeEnd}
            getVisualSnapSpan={getVisualSnapSpan} getVisualResizeSnapSpan={getVisualResizeSnapSpan}>
            {item.label}
          </Item>
        ))}
      </Row>

      <Row id="row-subtitle">
        {items.filter(item => item.rowId === 'row-subtitle').map(item => (
          <Item id={item.id} key={item.id} rowId={item.rowId} span={item.span} isSelected={item.id === selectedSubtitleId}
            onSelect={() => onSelectSubtitle?.(item.id)} variant="annotation" onDirectSpanChange={onItemSpanChange}
            onDirectSpanPreview={onItemResizePreview} onDirectResizeStart={onTimelineResizeStart} onDirectResizeEnd={onTimelineResizeEnd}
            getVisualSnapSpan={getVisualSnapSpan} getVisualResizeSnapSpan={getVisualResizeSnapSpan}>{item.label}</Item>
        ))}
      </Row>

      {(() => {
        const annotationRowIds = Array.from(new Set(
          items.filter(item => item.rowId.startsWith("row-annotation-")).map(item => item.rowId)
        )).sort();
        const finalAnnotationRowIds = annotationRowIds.length > 0 ? annotationRowIds : ["row-annotation-0"];
        
        return finalAnnotationRowIds.map((rowId) => (
          <Row id={rowId} key={rowId} onAddClick={onAddAnnotation}>
            {items.filter(item => item.rowId === rowId).map((item) => (
              <Item
                id={item.id}
                key={item.id}
                rowId={item.rowId}
                span={item.span}
                isSelected={item.id === selectedAnnotationId}
                onSelect={() => onSelectAnnotation?.(item.id)}
                variant="annotation"
                onDirectSpanChange={onItemSpanChange}
                onDirectSpanPreview={onItemResizePreview}
                onDirectResizeStart={onTimelineResizeStart}
                onDirectResizeEnd={onTimelineResizeEnd}
                getVisualSnapSpan={getVisualSnapSpan}
                getVisualResizeSnapSpan={getVisualResizeSnapSpan}
              >
                {item.label}
              </Item>
            ))}
          </Row>
        ));
      })()}
      
      {(() => {
        const audioRowIds = Array.from(new Set(
          items.filter(item => item.rowId.startsWith("row-audio-")).map(item => item.rowId)
        )).sort();
        const finalAudioRowIds = audioRowIds.length > 0 ? audioRowIds : ["row-audio-0"];

        return finalAudioRowIds.map((rowId) => (
          <Row id={rowId} key={rowId} height={48} onAddClick={() => toast.info('请将音频文件直接拖拽到画面中添加')}>
            {items.filter(item => item.rowId === rowId).map((item) => (
              <Item
                id={item.id}
                key={item.id}
                rowId={item.rowId}
                span={item.span}
                isSelected={item.id === selectedAudioId}
                onSelect={() => onSelectAudio?.(item.id)}
                variant="audio"
                sourceStartMs={item.sourceStartMs}
                sourceEndMs={item.sourceEndMs}
                totalDurationMs={item.totalDurationMs}
                sourceUrl={item.sourceUrl}
                audioPeaks={item.audioPeaks}
                audioPeaksDurationMs={item.audioPeaksDurationMs}
                volume={item.volume}
                volumeKeyframes={item.volumeKeyframes}
                onVolumeKeyframesChange={(keyframes) => onAudioVolumeKeyframesChange?.(item.id, keyframes)}
                onDirectSpanChange={onItemSpanChange}
                onDirectSpanPreview={onItemResizePreview}
                onDirectResizeStart={onTimelineResizeStart}
                onDirectResizeEnd={onTimelineResizeEnd}
                getVisualSnapSpan={getVisualSnapSpan}
                getVisualResizeSnapSpan={getVisualResizeSnapSpan}
              >
                {item.label}
              </Item>
            ))}
          </Row>
        ));
      })()}
    </>
  );
}, [items, zoomRegions, zoomBoundaryRegions, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedPresentationId, selectedSubtitleId, selectedAudioId, waveformCache, selectedVideoId, onSelectVideo, onSelectAudio, onSelectPresentation, onSelectSubtitle, onAddPresentation, onAudioVolumeKeyframesChange, onItemSpanChange, onItemResizePreview, getVisualSnapSpan, getVisualResizeSnapSpan, onTimelineResizeStart, onTimelineResizeEnd]);

const { setTimelineRef, style, range, pixelsToValue, valueToPixels, direction, setSidebarRef } = useTimelineContext();
  const localTimelineRef = useRef<HTMLDivElement | null>(null);
  const [trackStartPx, setTrackStartPx] = useState(FALLBACK_TRACK_START_PX);
  const sideProperty = direction === "rtl" ? "right" : "left";
  const isSnapGuideVisible = snapGuideMs !== null && snapGuideMs !== undefined && snapGuideMs >= range.start && snapGuideMs <= range.end;

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    localTimelineRef.current = node;
    setTimelineRef(node);
  }, [setTimelineRef]);

  useEffect(() => {
    const timeline = localTimelineRef.current;
    if (!timeline) return;

    const updateTrackStart = () => {
      setTrackStartPx(getTrackStartPx(timeline));
    };

    updateTrackStart();
    console.debug('[Timeline] unified seek coordinates loaded');
    const resizeObserver = new ResizeObserver(updateTrackStart);
    resizeObserver.observe(timeline);
    const trackArea = timeline.querySelector<HTMLElement>('[data-timeline-track-area="true"]');
    if (trackArea) resizeObserver.observe(trackArea);

    return () => resizeObserver.disconnect();
  }, [items.length]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-timeline-item-id]')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isTimelineResizing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    onSelectZoom?.(null);
    onSelectTrim?.(null);
    onSelectAnnotation?.(null);
    onSelectAudio?.(null);
    onSelectPresentation?.(null);
    onSelectSubtitle?.(null);
    onSelectVideo(null);

    if (!onSeek || videoDurationMs <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const seek = resolveTimelineSeekFromClientX({
      clientX: e.clientX,
      timelineLeftPx: rect.left,
      trackStartPx,
      rangeStartMs: range.start,
      durationMs: videoDurationMs,
      pixelsToValue,
      mapEffectiveToSource,
      isTrimTrackVisible,
    });
    
    console.log(
      `[TimelineSeek] rawX=${seek.rawX.toFixed(1)} trackStart=${trackStartPx.toFixed(1)} effectiveMs=${seek.effectiveMs.toFixed(1)} sourceMs=${seek.sourceMs.toFixed(1)}`
    );
    onSeek(seek.sourceMs / 1000);
  }, [isTimelineResizing, trackStartPx, range.start, pixelsToValue, onSeek, videoDurationMs, onSelectZoom, onSelectTrim, onSelectAnnotation, onSelectAudio, onSelectPresentation, onSelectSubtitle, onSelectVideo, isTrimTrackVisible, mapEffectiveToSource]);

  return (
    <div
      ref={setRefs}
      style={style}
      className="select-none bg-transparent min-h-[140px] h-full relative cursor-pointer group"
      onClick={handleTimelineClick}
    >
      {/* 虚拟的 Sidebar 测量节点：真实宽度 + 呼吸留白 = 轨道起点 fallback */}
      <div 
        ref={setSidebarRef} 
        style={{ position: 'absolute', width: FALLBACK_TRACK_START_PX, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px)] bg-[length:20px_100%] pointer-events-none" />
      <TimelineAxis intervalMs={intervalMs} videoDurationMs={videoDurationMs} trackStartPx={trackStartPx} />
      {isSnapGuideVisible && (
        <div
          className="absolute top-8 bottom-0 z-40 w-[2px] bg-[#34B27B] shadow-[0_0_10px_rgba(52,178,123,0.75)] pointer-events-none"
          style={{ [sideProperty]: `${trackStartPx + valueToPixels(snapGuideMs - range.start) - 1}px` }}
        />
      )}
      {trackRenderer}

      <PlaybackCursor 
        currentTimeMs={currentTimeMs} 
        videoDurationMs={videoDurationMs} 
        onSeek={onSeek}
        timelineRef={localTimelineRef}
        videoRef={videoRef}
        mapSourceToEffective={mapSourceToEffective}
        mapEffectiveToSource={mapEffectiveToSource}
        isTrimTrackVisible={isTrimTrackVisible}
        trackStartPx={trackStartPx}
        freezeExternalTime={isTimelineResizing}
      />
    </div>
  );
}

export default function TimelineEditor({
  editingSession,
  videoDuration,
  sourceVideoDuration,
  currentTime,
  onSeek,
  zoomRegions,
  onZoomAdded,
  onCameraAdded,
  onZoomSpanChange,
  onZoomSplit,
  onZoomDelete,
  selectedZoomId,
  onSelectZoom,
  trimRegions = [],
  onTrimAdded,
  onTrimSpanChange,
  onTrimDelete,
  selectedTrimId,
  onSelectTrim,
  annotationRegions = [],
  onAnnotationAdded,
  onAnnotationSpanChange,
  onAnnotationDelete,
  selectedAnnotationId,
  onSelectAnnotation,
  subtitleRegions = [],
  onSubtitleSpanChange,
  onSubtitleDelete,
  selectedSubtitleId,
  onSelectSubtitle,
  audioRegions = [],
  onAudioSpanChange,
  onAudioDelete,
  selectedAudioId,
  onSelectAudio,
  onAudioVolumeKeyframesChange,
  onAutoZoom,
  isFullScreenBinding,
  onFullScreenBindingChange,
  isPlaying,
  onTogglePlayPause,
  videoRef,
  selectedVideoId,
  onSelectVideo,
  onAudioTrackChange,
  onTimelineResizeStart,
  onTimelineResizeEnd,
  videoPath,
  presentationEffects = [], selectedPresentationId, onSelectPresentation, onPresentationAdded, onPresentationSpanChange, onPresentationDelete,
}: TimelineEditorProps) {
  const projectTotalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
  const sourceTotalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000)), [sourceVideoDuration, videoDuration]);
  const totalMs = projectTotalMs;
  const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);

  const isTrimTrackVisible = false; // 用户强制要求删除 Trim UI
  const { effectiveDurationMs, mapSourceToEffective, mapEffectiveToSource, mapEffectiveToProject } = useTimeMap(trimRegions, sourceTotalMs, editingSession?.document);
  
  const activeDurationMs = editingSession
    ? projectTotalMs
    : (isTrimTrackVisible ? projectTotalMs : Math.max(projectTotalMs, effectiveDurationMs));
  const activeCurrentTimeMs = editingSession ? currentTimeMs : (isTrimTrackVisible ? currentTimeMs : mapSourceToEffective(currentTimeMs));

  const selectedMainClip = editingSession?.document.clips.find((clip) => clip.id === selectedVideoId);
  const splitSelectedMainClip = useCallback(() => {
    if (!editingSession || !selectedMainClip) return;
    const projectTimeMs = mapEffectiveToProject(currentTimeMs);
    const sourceTimeMs = editingSession.timeMap.mapProjectToSource(projectTimeMs);
    editingSession.execute({ type: 'split', clipId: selectedMainClip.id, sourceTimeMs });
  }, [currentTimeMs, editingSession, mapEffectiveToProject, selectedMainClip]);
  const timelineScale = useMemo(() => calculateTimelineScale(activeDurationMs / 1000), [activeDurationMs]);
  const safeMinDurationMs = useMemo(
    () => (activeDurationMs > 0 ? Math.min(timelineScale.minItemDurationMs, activeDurationMs) : timelineScale.minItemDurationMs),
    [timelineScale.minItemDurationMs, activeDurationMs],
  );

  const [range, setRange] = useState<Range>(() => createInitialRange(activeDurationMs));
  const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ id: string; span: Span } | null>(null);
  const [isTimelineResizing, setIsTimelineResizing] = useState(false);
  const [isMagneticSnapEnabled, setIsMagneticSnapEnabled] = useState(true);
  const [snapGuideMs, setSnapGuideMs] = useState<number | null>(null);
  useEffect(() => {
    if (!isMagneticSnapEnabled) {
      setSnapGuideMs(null);
    }
  }, [isMagneticSnapEnabled]);

  // Add keyframe at current playhead position
  const addKeyframe = useCallback(() => {
    if (activeDurationMs === 0) return;
    const time = Math.max(0, Math.min(currentTimeMs, totalMs));
    if (keyframes.some(kf => Math.abs(kf.time - time) < 1)) return;
    setKeyframes(prev => [...prev, { id: uuidv4(), time }]);
  }, [currentTimeMs, totalMs, keyframes]);

  // Delete selected keyframe
  const deleteSelectedKeyframe = useCallback(() => {
    if (!selectedKeyframeId) return;
    setKeyframes(prev => prev.filter(kf => kf.id !== selectedKeyframeId));
    setSelectedKeyframeId(null);
  }, [selectedKeyframeId]);

  // Delete selected zoom item
  const deleteSelectedZoom = useCallback(() => {
    if (!selectedZoomId) return;
    onZoomDelete(selectedZoomId);
    onSelectZoom(null);
  }, [selectedZoomId, onZoomDelete, onSelectZoom]);

  // Delete selected trim item
  const deleteSelectedTrim = useCallback(() => {
    if (!selectedTrimId || !onTrimDelete || !onSelectTrim) return;
    onTrimDelete(selectedTrimId);
    onSelectTrim(null);
  }, [selectedTrimId, onTrimDelete, onSelectTrim]);

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
    onAnnotationDelete(selectedAnnotationId);
    onSelectAnnotation(null);
  }, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);
  const deleteSelectedSubtitle = useCallback(() => { if (!selectedSubtitleId || !onSubtitleDelete || !onSelectSubtitle) return; onSubtitleDelete(selectedSubtitleId); onSelectSubtitle(null) }, [selectedSubtitleId,onSubtitleDelete,onSelectSubtitle]);

  const deleteSelectedAudio = useCallback(() => {
    if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
    onAudioDelete(selectedAudioId);
    onSelectAudio(null);
  }, [selectedAudioId, onAudioDelete, onSelectAudio]);
  const deleteSelectedPresentation = useCallback(() => {
    if (!selectedPresentationId) return; onPresentationDelete?.(selectedPresentationId); onSelectPresentation?.(null);
  }, [onPresentationDelete, onSelectPresentation, selectedPresentationId]);

  const hasInitializedRangeRef = useRef(activeDurationMs > 0);
  useEffect(() => {
    if (activeDurationMs <= 0) return;
    setRange((current) => {
      if (!hasInitializedRangeRef.current || current.start >= activeDurationMs || current.end > activeDurationMs) {
        hasInitializedRangeRef.current = true;
        return createInitialRange(activeDurationMs);
      }
      return current;
    });
  }, [activeDurationMs]);

  const hasOverlap = useCallback((newSpan: Span, excludeId?: string, targetRowId?: string): boolean => {
    const mapTime = (time: number) => (isTrimTrackVisible || !mapSourceToEffective) ? time : mapSourceToEffective(time);
    const baseExcludeId = excludeId?.split('-part-')[0];
    const isZoomItem = zoomRegions.some(r => r.id === excludeId);
    const isTrimItem = trimRegions.some(r => r.id === excludeId);
    const isAnnotationItem = (annotationRegions || []).some(r => r.id === excludeId);
    const isAudioItem = (audioRegions || []).some(r => r.id === baseExcludeId);

    if (isAnnotationItem) {
      return false;
    }

    if (isAudioItem) {
      const selfAudio = (audioRegions || []).find(r => r.id === baseExcludeId);
      const selfTrackIndex = selfAudio ? (selfAudio.trackIndex ?? 0) : 0;
      
      let targetTrackIndex = selfTrackIndex;
      if (targetRowId !== undefined) {
        if (!targetRowId.startsWith('row-audio-')) return true;
        targetTrackIndex = parseInt(targetRowId.replace('row-audio-', ''), 10);
      }

      const otherAudios = (audioRegions || []).filter(r => 
        r.id !== baseExcludeId && 
        (r.trackIndex ?? 0) === targetTrackIndex && 
        (!r.isOriginal || r.isDetached)
      );
      
      return otherAudios.some((region) => {
        const regionStart = mapTime(region.startMs);
        const regionEnd = mapTime(region.endMs);
        return !(newSpan.end - regionStart <= 1.5 || regionEnd - newSpan.start <= 1.5);
      });
    }

    // Helper to check overlap against a specific set of regions
    const checkOverlap = (regions: (ZoomRegion | TrimRegion)[]) => {
      return regions.some((region) => {
        if (region.id === excludeId) return false;
        return !(newSpan.end - region.startMs <= 1.5 || region.endMs - newSpan.start <= 1.5);
      });
    };

    if (isZoomItem) {
      return checkOverlap(zoomRegions);
    }

    if (isTrimItem) {
      return checkOverlap(trimRegions);
    }

    return false;
  }, [zoomRegions, trimRegions, annotationRegions, audioRegions, mapSourceToEffective, isTrimTrackVisible]);

  const getNonOverlappingSpan = useCallback((
    newSpan: Span, 
    excludeId?: string, 
    targetRowId?: string
  ): Span => {
    const mapTime = (time: number) => (isTrimTrackVisible || !mapSourceToEffective) ? time : mapSourceToEffective(time);
    const baseExcludeId = excludeId?.split('-part-')[0];
    const isZoomItem = zoomRegions.some(r => r.id === excludeId);
    const isTrimItem = trimRegions.some(r => r.id === excludeId);
    const isAnnotationItem = (annotationRegions || []).some(r => r.id === excludeId);
    const isAudioItem = (audioRegions || []).some(r => r.id === baseExcludeId);

    if (isAnnotationItem) {
      return newSpan;
    }

    // 1. 处理音频轨道的碰撞贴边
    if (isAudioItem) {
      const selfAudio = (audioRegions || []).find(r => r.id === baseExcludeId);
      const selfTrackIndex = selfAudio ? (selfAudio.trackIndex ?? 0) : 0;
      
      let targetTrackIndex = selfTrackIndex;
      if (targetRowId !== undefined) {
        if (!targetRowId.startsWith('row-audio-')) return newSpan;
        targetTrackIndex = parseInt(targetRowId.replace('row-audio-', ''), 10);
      }

      const otherAudios = (audioRegions || []).filter(r => 
        r.id !== baseExcludeId && 
        (r.trackIndex ?? 0) === targetTrackIndex && 
        (!r.isOriginal || r.isDetached)
      );

      // 寻找与 newSpan 产生交叠的所有其他音频（加入 1.5ms 容差）
      const overlapping = otherAudios.filter((region) => {
        const regionStart = mapTime(region.startMs);
        const regionEnd = mapTime(region.endMs);
        return !(newSpan.end - regionStart <= 1.5 || regionEnd - newSpan.start <= 1.5);
      });

      if (overlapping.length === 0) {
        return newSpan;
      }

      // 如果有重叠，对 newSpan 进行贴边修正
      const duration = newSpan.end - newSpan.start;
      
      // 判断是在拉伸还是拖拽
      const oldStart = selfAudio ? mapTime(selfAudio.startMs) : newSpan.start;
      const oldEnd = selfAudio ? mapTime(selfAudio.endMs) : newSpan.end;
      
      const isResizing = targetRowId === undefined; // targetRowId 为 undefined 说明在 onResizeEnd
      
      if (isResizing && selfAudio) {
        const isResizingRight = Math.abs(newSpan.start - oldStart) < 2; // 左边缘没变，说明是右边缘拉伸
        const isResizingLeft = Math.abs(newSpan.end - oldEnd) < 2;   // 右边缘没变，说明是左边缘拉伸
        
        if (isResizingRight) {
          const starts = overlapping.map(r => mapTime(r.startMs));
          const minStart = Math.min(...starts);
          return { start: newSpan.start, end: Math.max(newSpan.start + 10, minStart) };
        } else if (isResizingLeft) {
          const ends = overlapping.map(r => mapTime(r.endMs));
          const maxEnd = Math.max(...ends);
          return { start: Math.min(newSpan.end - 10, maxEnd), end: newSpan.end };
        }
      }

      // 拖拽避让碰撞：偏向哪侧就贴在另外一个音频的哪一侧
      const targetRegion = overlapping[0];
      const targetStart = mapTime(targetRegion.startMs);
      const targetEnd = mapTime(targetRegion.endMs);
      
      const midA = (newSpan.start + newSpan.end) / 2;
      const midB = (targetStart + targetEnd) / 2;
      
      if (midA < midB) {
        const start = targetStart - duration;
        return { start: Math.max(0, start), end: Math.max(duration, targetStart) };
      } else {
        return { start: targetEnd, end: targetEnd + duration };
      }
    }

    // 2. 处理 Zoom / Trim 的碰撞贴边
    const checkOverlapAndResolve = (regions: (ZoomRegion | TrimRegion)[]) => {
      const overlapping = regions.filter((region) => {
        if (region.id === excludeId) return false;
        return !(newSpan.end - region.startMs <= 1.5 || region.endMs - newSpan.start <= 1.5);
      });

      if (overlapping.length === 0) {
        return newSpan;
      }

      const selfRegion = regions.find(r => r.id === excludeId);
      const oldStart = selfRegion ? selfRegion.startMs : newSpan.start;
      const oldEnd = selfRegion ? selfRegion.endMs : newSpan.end;
      const duration = newSpan.end - newSpan.start;
      
      const isResizing = targetRowId === undefined;
      
      if (isResizing && selfRegion) {
        const isResizingRight = Math.abs(newSpan.start - oldStart) < 2;
        const isResizingLeft = Math.abs(newSpan.end - oldEnd) < 2;
        
        if (isResizingRight) {
          const minStart = Math.min(...overlapping.map(r => r.startMs));
          return { start: newSpan.start, end: Math.max(newSpan.start + 10, minStart) };
        } else if (isResizingLeft) {
          const maxEnd = Math.max(...overlapping.map(r => r.endMs));
          return { start: Math.min(newSpan.end - 10, maxEnd), end: newSpan.end };
        }
      }

      const targetRegion = overlapping[0];
      const midA = (newSpan.start + newSpan.end) / 2;
      const midB = (targetRegion.startMs + targetRegion.endMs) / 2;
      
      if (midA < midB) {
        const start = targetRegion.startMs - duration;
        return { start: Math.max(0, start), end: Math.max(duration, targetRegion.startMs) };
      } else {
        return { start: targetRegion.endMs, end: targetRegion.endMs + duration };
      }
    };

    if (isZoomItem) {
      return checkOverlapAndResolve(zoomRegions);
    }

    if (isTrimItem) {
      return checkOverlapAndResolve(trimRegions);
    }

    return newSpan;
  }, [zoomRegions, trimRegions, annotationRegions, audioRegions, mapSourceToEffective, isTrimTrackVisible, mapEffectiveToSource]);

  const handleAddZoom = useCallback(() => {
    if (!videoDuration || videoDuration === 0 || activeDurationMs === 0) {
      return;
    }

    const defaultDuration = Math.min(1000, sourceTotalMs);
    if (defaultDuration <= 0) {
      return;
    }

    // Always place zoom at playhead
    const startPos = Math.max(0, Math.min(currentTimeMs, sourceTotalMs));
    // Find the next zoom region after the playhead
    const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);
    const nextRegion = sorted.find(region => region.startMs > startPos);
    const gapToNext = nextRegion ? nextRegion.startMs - startPos : sourceTotalMs - startPos;

    // Check if playhead is inside any zoom region
    const isOverlapping = sorted.some(region => startPos >= region.startMs && startPos < region.endMs);
    if (isOverlapping || gapToNext <= 0) {
      toast.error("Cannot place zoom here", {
        description: "Zoom already exists at this location or not enough space available.",
      });
      return;
    }

    const actualDuration = Math.min(1000, gapToNext);
    onZoomAdded({ start: startPos, end: startPos + actualDuration });
  }, [videoDuration, activeDurationMs, sourceTotalMs, currentTimeMs, zoomRegions, onZoomAdded]);

  const handleAddCamera = useCallback(() => {
    if (!onCameraAdded || sourceTotalMs <= 0) return;
    const startPos = Math.max(0, Math.min(currentTimeMs, sourceTotalMs));
    const cameraRegions = zoomRegions.filter((region) => region.kind === 'camera');
    const nextRegion = [...cameraRegions]
      .sort((a, b) => a.startMs - b.startMs)
      .find((region) => region.startMs > startPos);
    const gapToNext = nextRegion ? nextRegion.startMs - startPos : sourceTotalMs - startPos;
    const overlaps = cameraRegions.some((region) => startPos >= region.startMs && startPos < region.endMs);
    if (overlaps || gapToNext <= 0) {
      toast.error('Cannot place camera motion here');
      return;
    }
    const durationMs = Math.min(3000, gapToNext);
    onCameraAdded({ start: startPos, end: startPos + durationMs });
  }, [currentTimeMs, onCameraAdded, sourceTotalMs, zoomRegions]);

  const handleAddTrim = useCallback(() => {
    if (!videoDuration || videoDuration === 0 || activeDurationMs === 0 || !onTrimAdded) {
      return;
    }

    const defaultDuration = Math.min(1000, totalMs);
    if (defaultDuration <= 0) {
      return;
    }

    // Always place trim at playhead
    const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
    // Find the next trim region after the playhead
    const sorted = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
    const nextRegion = sorted.find(region => region.startMs > startPos);
    const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

    // Check if playhead is inside any trim region
    const isOverlapping = sorted.some(region => startPos >= region.startMs && startPos < region.endMs);
    if (isOverlapping || gapToNext <= 0) {
      toast.error("Cannot place trim here", {
        description: "Trim already exists at this location or not enough space available.",
      });
      return;
    }

    const actualDuration = Math.min(1000, gapToNext);
    onTrimAdded({ start: startPos, end: startPos + actualDuration });
  }, [videoDuration, totalMs, currentTimeMs, trimRegions, onTrimAdded]);

  const handleAddAnnotation = useCallback(() => {
    if (!videoDuration || videoDuration === 0 || activeDurationMs === 0 || !onAnnotationAdded) {
      return;
    }

    const defaultDuration = 1000;

    // Multiple annotations can exist at the same timestamp
    const startPos = Math.max(0, currentTimeMs);
    const endPos = startPos + defaultDuration;
    
    onAnnotationAdded({ start: startPos, end: endPos });
  }, [videoDuration, activeDurationMs, currentTimeMs, onAnnotationAdded]);
  const handleAddPresentation = useCallback(() => {
    if (!onPresentationAdded || activeDurationMs <= 0) return;
    onPresentationAdded({ start: Math.max(0, currentTimeMs), end: Math.min(activeDurationMs, Math.max(0, currentTimeMs) + 1600) });
  }, [activeDurationMs, currentTimeMs, onPresentationAdded]);

  const handleSplitZoom = useCallback(() => {
    if (!selectedZoomId || !onZoomSplit) return;
    
    const region = zoomRegions.find(r => r.id === selectedZoomId);
    if (!region) return;
    
    if (currentTimeMs > region.startMs + 50 && currentTimeMs < region.endMs - 50) {
      onZoomSplit(selectedZoomId, currentTimeMs);
    } else {
      toast.error("Cannot split here", {
        description: "Playhead must be inside the selected zoom region with enough margin.",
      });
    }
  }, [selectedZoomId, currentTimeMs, zoomRegions, onZoomSplit]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        addKeyframe();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editingSession?.redo(); else editingSession?.undo();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        handleAddZoom();
      }
      if (e.key === 't' || e.key === 'T') {
        handleAddTrim();
      }
      if (e.key === 'a' || e.key === 'A') {
        handleAddAnnotation();
      }
      if (e.key === 's' || e.key === 'S') {
        if (selectedMainClip) {
          splitSelectedMainClip();
        } else if (selectedZoomId) {
          handleSplitZoom();
        }
      }
      
      // Tab: Cycle through overlapping annotations at current time
      if (e.key === 'Tab' && annotationRegions.length > 0) {
        const currentTimeMs = Math.round(currentTime * 1000);
        const overlapping = annotationRegions
          .filter(a => currentTimeMs >= a.startMs && currentTimeMs <= a.endMs)
          .sort((a, b) => a.zIndex - b.zIndex); // Sort by z-index
        
        if (overlapping.length > 0) {
          e.preventDefault(); 
          
          if (!selectedAnnotationId || !overlapping.some(a => a.id === selectedAnnotationId)) {
            onSelectAnnotation?.(overlapping[0].id);
          } else {
            // Cycle to next annotation
            const currentIndex = overlapping.findIndex(a => a.id === selectedAnnotationId);
            const nextIndex = e.shiftKey 
              ? (currentIndex - 1 + overlapping.length) % overlapping.length // Shift+Tab = backward
              : (currentIndex + 1) % overlapping.length; // Tab = forward
            onSelectAnnotation?.(overlapping[nextIndex].id);
          }
        }
      }    
      if (((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedMainClip) {
          editingSession?.execute({ type: 'delete', clipId: selectedMainClip.id });
          onSelectVideo(null);
        } else if (selectedKeyframeId) {
          deleteSelectedKeyframe();
        } else if (selectedZoomId) {
          deleteSelectedZoom();
        } else if (selectedTrimId) {
          deleteSelectedTrim();
        } else if (selectedSubtitleId) {
          deleteSelectedSubtitle();
        } else if (selectedAnnotationId) {
          deleteSelectedAnnotation();
        } else if (selectedAudioId) {
          deleteSelectedAudio();
        } else if (selectedPresentationId) {
          deleteSelectedPresentation();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addKeyframe, handleAddZoom, handleAddTrim, handleAddAnnotation, deleteSelectedKeyframe, deleteSelectedZoom, deleteSelectedTrim, deleteSelectedAnnotation, deleteSelectedSubtitle, deleteSelectedAudio, deleteSelectedPresentation, selectedKeyframeId, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedSubtitleId, selectedAudioId, selectedPresentationId, annotationRegions, currentTime, onSelectAnnotation, editingSession, onSelectVideo, selectedMainClip, splitSelectedMainClip]);

  const clampedRange = useMemo<Range>(() => {
    const start = Math.max(0, range.start);
    const end = Math.max(range.end, start + timelineScale.minVisibleRangeMs);
    return { start, end };
  }, [range, timelineScale.minVisibleRangeMs]);

  const audioItemsToCache = useMemo(() => audioRegions || [], [audioRegions]);
  const waveformCache = useWaveformCache(audioItemsToCache);

  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const mapTime = (time: number) => isTrimTrackVisible ? time : mapSourceToEffective(time);

    const originalAudio = getAttachedOriginalAudio(audioRegions);

    const videos: TimelineRenderItem[] = [{
      id: 'video-track',
      rowId: VIDEO_ROW_ID,
      span: { start: 0, end: mapTime(sourceTotalMs) },
      label: 'Main Track',
      variant: 'video',
      sourceUrl: videoPath,
      sourceStartMs: 0,
      associatedAudio: buildAssociatedOriginalAudioForSourceRange(originalAudio, 0, sourceTotalMs),
    }];
    
    const zooms: TimelineRenderItem[] = [...zoomRegions]
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
      .map((region, index) => ({
      id: region.id,
      rowId: region.kind === 'camera' ? CAMERA_ROW_ID : ZOOM_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: region.kind === 'camera' ? (region.cameraMotion?.name || 'Camera Motion') : `Focus ${index + 1}`,
      zoomDepth: region.depth,
      variant: 'zoom',
      }));

    const trims: TimelineRenderItem[] = isTrimTrackVisible ? trimRegions.map((region, index) => ({
      id: region.id,
      rowId: TRIM_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: `Trim ${index + 1}`,
      variant: 'trim',
    })) : [];

    const partitionedAnnotations = partitionIntoTimelineLanes(annotationRegions || []);
    const annotations: TimelineRenderItem[] = partitionedAnnotations.map(({ item: region, trackIndex }) => {
      let label: string;
      
      if (region.type === 'text') {
        const preview = region.content.trim() || 'Empty text';
        label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
      } else if (region.type === 'image') {
        label = 'Image';
      } else {
        label = 'Annotation';
      }
      
      return {
        id: region.id,
        rowId: `row-annotation-${trackIndex}`,
        span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
        label,
        variant: 'annotation',
      };
    });
    const subtitles: TimelineRenderItem[] = subtitleRegions.map(region => ({ id: region.id, rowId: 'row-subtitle', span: { start: mapTime(region.startMs), end: mapTime(region.endMs) }, label: region.text || 'Subtitle', variant: 'annotation' }));

    const filteredAudios = getStandaloneAudioRegions(audioRegions || []);
    const partitionedAudios = partitionIntoTimelineLanes(filteredAudios);
    const audios: TimelineRenderItem[] = partitionedAudios.map(({ item: region, trackIndex }) => ({
      id: region.id,
      rowId: `row-audio-${trackIndex}`,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: region.name || 'Audio Track',
      variant: 'audio',
      audioPeaks: region.sourceUrl ? waveformCache.get(region.sourceUrl)?.peaks : undefined,
      audioPeaksDurationMs: region.sourceUrl ? waveformCache.get(region.sourceUrl)?.durationMs : undefined,
      sourceUrl: region.sourceUrl,
      sourceStartMs: region.sourceStartMs,
      sourceEndMs: region.sourceEndMs,
      totalDurationMs: region.totalDurationMs,
      startMs: region.startMs,
      volume: region.volume,
      volumeKeyframes: region.volumeKeyframes,
    }));
    // Presentation effects are already stored in project time. Do not apply the source trim map again.
    const presentations: TimelineRenderItem[] = presentationEffects.map((region) => ({ id: region.id, rowId: PRESENTATION_ROW_ID, span: { start: region.startMs, end: region.endMs }, label: region.kind.replace('-', ' '), variant: 'presentation' }));

    const mainClips: TimelineRenderItem[] = [];
    if (!isTrimTrackVisible) {
      const segments = editingSession
        ? editingSession.document.clips.flatMap((clip, index) => {
            const clipSpan = editingSession.timeMap.clipProjectSpans[index];
            if (!clipSpan) return [];
            const projectStartMs = clipSpan.projectStartMs;
            const projectEndMs = clipSpan.projectEndMs;
            return [{ id: clip.id, sourceStartMs: clip.sourceStartMs, sourceEndMs: clip.sourceEndMs, effectiveStartMs: editingSession.timeMap.mapProjectToEffective(projectStartMs), effectiveEndMs: editingSession.timeMap.mapProjectToEffective(projectEndMs) }];
          })
        : buildMainClipSegments(trimRegions, sourceTotalMs, mapSourceToEffective);
      segments.forEach((segment) => {
        mainClips.push({
          id: segment.id,
          rowId: VIDEO_ROW_ID,
          span: { start: segment.effectiveStartMs, end: segment.effectiveEndMs },
          label: 'Main Clip',
          variant: 'video',
          sourceUrl: videoPath,
          sourceStartMs: segment.sourceStartMs,
          sourceEndMs: segment.sourceEndMs,
          totalDurationMs: segment.sourceEndMs - segment.sourceStartMs,
          associatedAudio: buildAssociatedOriginalAudioForSourceRange(
            originalAudio,
            segment.sourceStartMs,
            segment.sourceEndMs,
          ),
        });
      });
    }

    const videoItems = isTrimTrackVisible ? videos : mainClips;
    return [...videoItems, ...zooms, ...trims, ...annotations, ...subtitles, ...presentations, ...audios];
  }, [
    isTrimTrackVisible, mapSourceToEffective, sourceTotalMs, zoomRegions,
    trimRegions, annotationRegions, subtitleRegions, presentationEffects, audioRegions, totalMs, waveformCache, videoPath, editingSession
  ]);

  const getMagneticSnapResultForSpan = useCallback((
    activeItemId: string,
    targetSpan: Span,
    snapThresholdMs: number,
  ): TimelineMagneticSnapResult => {
    return getTimelineMagneticSnapResult({
      activeItemId,
      targetSpan,
      items: timelineItems,
      currentTimeMs: activeCurrentTimeMs,
      intervalMs: timelineScale.intervalMs,
      videoRowId: VIDEO_ROW_ID,
      interaction: "drag",
      snapThresholdMs,
    });
  }, [timelineItems, activeCurrentTimeMs, timelineScale.intervalMs]);

  const getMagneticSnapSpan = useCallback((
    activeItemId: string,
    targetSpan: Span,
    snapThresholdMs: number,
  ): Span => {
    return getTimelineMagneticSnapSpan({
      activeItemId,
      targetSpan,
      items: timelineItems,
      currentTimeMs: activeCurrentTimeMs,
      intervalMs: timelineScale.intervalMs,
      videoRowId: VIDEO_ROW_ID,
      interaction: "drag",
      snapThresholdMs,
    });
  }, [timelineItems, activeCurrentTimeMs, timelineScale.intervalMs]);

  const getVisualMagneticSnapSpan = useCallback((
    activeItemId: string,
    targetSpan: Span,
    snapThresholdMs: number,
  ): Span => {
    const snappedSpan = getTimelineMagneticSnapSpan({
      activeItemId,
      targetSpan,
      items: timelineItems,
      currentTimeMs: activeCurrentTimeMs,
      intervalMs: timelineScale.intervalMs,
      videoRowId: VIDEO_ROW_ID,
      interaction: "drag",
      snapThresholdMs,
    });

    if (!zoomRegions.some((region) => region.id === activeItemId)) {
      return snappedSpan;
    }

    return constrainFocusDragSpan(activeItemId, snappedSpan, zoomRegions, sourceTotalMs);
  }, [timelineItems, activeCurrentTimeMs, timelineScale.intervalMs, zoomRegions, sourceTotalMs]);

  const getVisualResizeMagneticSnapSpan = useCallback((
    activeItemId: string,
    targetSpan: Span,
    snapThresholdMs: number,
  ): Span => {
    const snappedSpan = getTimelineMagneticSnapSpan({
      activeItemId,
      targetSpan,
      items: timelineItems,
      currentTimeMs: activeCurrentTimeMs,
      intervalMs: timelineScale.intervalMs,
      videoRowId: VIDEO_ROW_ID,
      interaction: "resize",
      snapThresholdMs,
    });

    if (!zoomRegions.some((region) => region.id === activeItemId)) {
      return snappedSpan;
    }

    return constrainFocusResizeSpan(
      activeItemId,
      snappedSpan,
      zoomRegions,
      sourceTotalMs,
      safeMinDurationMs,
    );
  }, [timelineItems, activeCurrentTimeMs, timelineScale.intervalMs, zoomRegions, sourceTotalMs, safeMinDurationMs]);

  const previewZoomRegions = useMemo(() => {
    if (!resizePreview || !zoomRegions.some(region => region.id === resizePreview.id)) {
      return zoomRegions;
    }

    const previewSpan = isTrimTrackVisible
      ? { ...resizePreview.span }
      : {
          start: mapEffectiveToSource(resizePreview.span.start),
          end: mapEffectiveToSource(resizePreview.span.end),
        };

    return zoomRegions.map(region => (
      region.id === resizePreview.id
        ? { ...region, startMs: previewSpan.start, endMs: previewSpan.end }
        : region
    ));
  }, [isTrimTrackVisible, mapEffectiveToSource, resizePreview, zoomRegions]);

  const handleItemResizePreview = useCallback((id: string, span: Span | null) => {
    if (!span || !zoomRegions.some(region => region.id === id)) {
      setResizePreview(prev => (prev?.id === id ? null : prev));
      setSnapGuideMs(null);
      return;
    }

    setResizePreview({ id, span });
  }, [zoomRegions]);

  const handleTimelineResizeStart = useCallback(() => {
    setIsTimelineResizing(true);
    onTimelineResizeStart?.();
  }, [onTimelineResizeStart]);

  const handleTimelineResizeEnd = useCallback(() => {
    requestAnimationFrame(() => {
      setIsTimelineResizing(false);
      onTimelineResizeEnd?.();
    });
  }, [onTimelineResizeEnd]);

  const handleItemRowChange = useCallback((id: string, newRowId: string) => {
    const baseId = id.split('-part-')[0];
    if (newRowId.startsWith('row-audio-')) {
      const newTrackIndex = parseInt(newRowId.replace('row-audio-', ''), 10);
      onAudioTrackChange?.(baseId, newTrackIndex);
    }
  }, [onAudioTrackChange]);

  const handleItemSpanChange = useCallback((id: string, span: Span) => {
    const speedSection = editingSession?.document.speedSections.find((section) => section.id === id);
    if (speedSection) {
      editingSession!.execute({
        type: 'update-speed',
        id,
        projectStartMs: mapEffectiveToProject(span.start),
        projectEndMs: mapEffectiveToProject(span.end),
      });
      return;
    }
    let targetSpan = isTrimTrackVisible
      ? { ...span }
      : { start: mapEffectiveToSource(span.start), end: mapEffectiveToSource(span.end) };
      
    // Check if it's a zoom or trim item
    if (zoomRegions.some(r => r.id === id)) {
      onZoomSpanChange(id, constrainFocusResizeSpan(id, targetSpan, zoomRegions, sourceTotalMs, safeMinDurationMs));
    } else if (trimRegions.some(r => r.id === id)) {
      onTrimSpanChange?.(id, targetSpan);
    } else if ((annotationRegions || []).some(r => r.id === id)) {
      onAnnotationSpanChange?.(id, targetSpan);
    } else if (presentationEffects.some(r => r.id === id)) {
      onPresentationSpanChange?.(id, span);
    } else if (subtitleRegions.some(r => r.id === id)) {
      onSubtitleSpanChange?.(id, targetSpan);
    } else if ((audioRegions || []).some(r => r.id === id)) {
      // 音频片段最大时长限制：不允许拖拽超过音频文件的实际时长
      const audioRegion = audioRegions?.find(r => r.id === id);
      if (audioRegion) {
        const maxDuration = audioRegion.totalDurationMs || 0;
        const oldDuration = audioRegion.endMs - audioRegion.startMs;
        const currentDuration = targetSpan.end - targetSpan.start;
        const isTrimming = Math.abs(currentDuration - oldDuration) > 1; // 1ms tolerance
        
        if (maxDuration > 0 && isTrimming) {
          const sourceStart = audioRegion.sourceStartMs || 0;
          const audioResizeBounds = resolveAudioResizeBounds({
            span: {
              start: audioRegion.startMs,
              end: audioRegion.endMs,
            },
            sourceStartMs: sourceStart,
            sourceTotalMs: maxDuration,
            pxPerMs: 1,
          });

          const isTrimmingLeft = Math.abs(targetSpan.end - audioRegion.endMs) < 1;
          const isTrimmingRight = Math.abs(targetSpan.start - audioRegion.startMs) < 1;

          if (isTrimmingLeft) {
            targetSpan = clampAudioResizeSpanToSource(targetSpan, audioResizeBounds, "start");
          } else if (isTrimmingRight) {
            targetSpan = clampAudioResizeSpanToSource(targetSpan, audioResizeBounds, "end");
          }
        }
      }
      onAudioSpanChange?.(id, targetSpan);
    }
  }, [editingSession, mapEffectiveToProject, zoomRegions, trimRegions, annotationRegions, subtitleRegions, presentationEffects, audioRegions, onZoomSpanChange, onTrimSpanChange, onAnnotationSpanChange, onSubtitleSpanChange, onPresentationSpanChange, onAudioSpanChange, isTrimTrackVisible, mapEffectiveToSource, sourceTotalMs, safeMinDurationMs]);

  const handleItemDragSpanChange = useCallback((id: string, span: Span) => {
    const mainClip = editingSession?.document.clips.find((clip) => clip.id === id);
    if (mainClip) {
      const projectMidpoint = mapEffectiveToProject((span.start + span.end) / 2);
      const toIndex = editingSession!.timeMap.clipProjectSpans.findIndex((clipSpan) => projectMidpoint < clipSpan.projectEndMs);
      editingSession!.execute({ type: 'reorder', clipId: id, toIndex: toIndex < 0 ? editingSession!.document.clips.length - 1 : toIndex });
      return;
    }
    const targetSpan = isTrimTrackVisible
      ? { ...span }
      : { start: mapEffectiveToSource(span.start), end: mapEffectiveToSource(span.end) };

    if (zoomRegions.some(r => r.id === id)) {
      onZoomSpanChange(id, constrainFocusDragSpan(id, targetSpan, zoomRegions, sourceTotalMs));
    } else {
      handleItemSpanChange(id, span);
    }
  }, [editingSession, handleItemSpanChange, isTrimTrackVisible, mapEffectiveToProject, mapEffectiveToSource, onZoomSpanChange, sourceTotalMs, zoomRegions]);

  if (!timelineMediaIsAvailable(videoPath, videoDuration)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-transparent gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <Plus className="w-6 h-6 text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">No Video Loaded</p>
          <p className="text-xs text-slate-500 mt-1">Drag and drop a video to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
      <div className="flex items-center gap-2 p-2 border-b border-[var(--ui-border)] bg-transparent relative">
        <div className="flex items-center gap-1">
          <TimelineToolTooltip label="Undo (Cmd/Ctrl+Z)">
            <Button onClick={editingSession?.undo} disabled={!editingSession?.canUndo} variant="ghost" size="icon" className="h-7 w-7" aria-label="Undo edit"><Undo2 className="h-3 w-3" /></Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Redo (Shift+Cmd/Ctrl+Z)">
            <Button onClick={editingSession?.redo} disabled={!editingSession?.canRedo} variant="ghost" size="icon" className="h-7 w-7" aria-label="Redo edit"><Redo2 className="h-3 w-3" /></Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Split selected Main Clip at playhead">
            <Button onClick={splitSelectedMainClip} disabled={!selectedMainClip} variant="ghost" size="icon" className="h-7 w-7" aria-label="Split Main Clip"><PiScissorsBold className="h-3 w-3" /></Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Delete selected Main Clip">
            <Button onClick={() => { if (selectedMainClip) { editingSession?.execute({ type: 'delete', clipId: selectedMainClip.id }); onSelectVideo(null); } }} disabled={!selectedMainClip} variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete Main Clip"><Trash2 className="h-3 w-3" /></Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Add Focus (Z)">
            <Button
              onClick={handleAddZoom}
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-transparent text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] transition-colors"
              aria-label="Add Focus"
            >
              <PiMagnifyingGlassPlusBold className="h-3 w-3" />
            </Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Add Camera Motion">
            <Button
              onClick={handleAddCamera}
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-transparent text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] transition-colors"
              aria-label="Add Camera Motion"
            >
              <Orbit className="h-3 w-3" strokeWidth={1.8} />
            </Button>
          </TimelineToolTooltip>
          {onAutoZoom && (
            <TimelineToolTooltip label="Generate Auto Focus">
              <Button
                onClick={onAutoZoom}
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-transparent text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] transition-colors"
                aria-label="Generate Auto Focus"
              >
                <PiMagicWandBold className="h-3 w-3" />
              </Button>
            </TimelineToolTooltip>
          )}
          <TimelineToolTooltip label="Remove Segment (T)">
            <Button
              onClick={handleAddTrim}
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-transparent text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] transition-colors"
              aria-label="Remove Segment"
            >
              <PiScissorsBold className="h-3 w-3" />
            </Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label="Add Text (A)">
            <Button
              onClick={handleAddAnnotation}
              variant="ghost"
              size="icon"
              className="h-7 w-7 bg-transparent text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] transition-colors"
              aria-label="Add Text"
            >
              <PiTextTBold className="h-3 w-3" />
            </Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label={`Snap to Edges: ${isMagneticSnapEnabled ? "On" : "Off"}`}>
            <Button
              onClick={() => setIsMagneticSnapEnabled((enabled) => !enabled)}
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 bg-transparent transition-colors",
                isMagneticSnapEnabled
                  ? "text-[var(--ui-text-secondary)] bg-[var(--ui-control)] hover:bg-[var(--ui-control-hover)]"
                  : "text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)]"
              )}
              aria-label="Toggle Magnetic Snap"
              aria-pressed={isMagneticSnapEnabled}
            >
              <PiMagnetBold className="h-3 w-3" />
            </Button>
          </TimelineToolTooltip>
          <TimelineToolTooltip label={isFullScreenBinding ? "Framing: Fill Screen" : "Framing: Follow Cursor"}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFullScreenBindingChange(!isFullScreenBinding)}
              className={cn(
                "h-7 w-7 bg-transparent transition-colors",
                isFullScreenBinding
                  ? "text-[var(--ui-text-secondary)] bg-[var(--ui-control)] hover:bg-[var(--ui-control-hover)]"
                  : "text-[var(--ui-text-tertiary)] hover:text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)]"
              )}
              aria-label="Change Framing Mode"
              aria-pressed={isFullScreenBinding}
            >
              {isFullScreenBinding
                ? <PiCornersOutBold className="h-3 w-3" />
                : <PiCrosshairBold className="h-3 w-3" />}
            </Button>
          </TimelineToolTooltip>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 z-10">
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={videoDuration}
            onTogglePlayPause={onTogglePlayPause}
            onSeek={onSeek || (() => {})}
          />
        </div>
        <div className="flex-1" />
      </div>
      <div className="flex-1 overflow-hidden bg-transparent relative"
        onClick={() => setSelectedKeyframeId(null)}
      >
        <TimelineWrapper
          range={clampedRange}
          videoDuration={activeDurationMs / 1000}
          hasOverlap={hasOverlap}
          getNonOverlappingSpan={getNonOverlappingSpan}
          getMagneticSnapSpan={getMagneticSnapSpan}
          getMagneticResizeSnapSpan={getVisualResizeMagneticSnapSpan}
          getMagneticSnapResult={getMagneticSnapResultForSpan}
          isMagneticSnapEnabled={isMagneticSnapEnabled}
          onSnapGuideChange={setSnapGuideMs}
          onRangeChange={setRange}
          minItemDurationMs={timelineScale.minItemDurationMs}
          minVisibleRangeMs={timelineScale.minVisibleRangeMs}
          gridSizeMs={timelineScale.gridMs}
          onItemSpanChange={handleItemSpanChange}
          onItemDragSpanChange={handleItemDragSpanChange}
          onItemResizePreview={handleItemResizePreview}
          onItemRowChange={handleItemRowChange}
          onResizeInteractionStart={handleTimelineResizeStart}
          onResizeInteractionEnd={handleTimelineResizeEnd}
        >
          <KeyframeMarkers
            keyframes={keyframes}
            selectedKeyframeId={selectedKeyframeId}
            setSelectedKeyframeId={setSelectedKeyframeId}
          />
          <Timeline
            items={timelineItems}
            zoomRegions={zoomRegions}
            zoomBoundaryRegions={previewZoomRegions}
            videoDurationMs={activeDurationMs}
            intervalMs={timelineScale.intervalMs}
            currentTimeMs={activeCurrentTimeMs}
            onSeek={onSeek}
            onSelectZoom={onSelectZoom}
            onSelectTrim={onSelectTrim}
            onSelectAnnotation={onSelectAnnotation}
            selectedZoomId={selectedZoomId}
            selectedTrimId={selectedTrimId}
            selectedAnnotationId={selectedAnnotationId}
            selectedPresentationId={selectedPresentationId}
            onSelectPresentation={onSelectPresentation}
            selectedSubtitleId={selectedSubtitleId}
            onSelectSubtitle={onSelectSubtitle}
            selectedAudioId={selectedAudioId}
            onSelectAudio={onSelectAudio}
            waveformCache={waveformCache}
            onAudioVolumeKeyframesChange={onAudioVolumeKeyframesChange}
            onItemSpanChange={handleItemSpanChange}
            onTimelineResizeStart={handleTimelineResizeStart}
            onTimelineResizeEnd={handleTimelineResizeEnd}
            onAddZoom={handleAddZoom}
            onAddCamera={handleAddCamera}
            onAddAnnotation={handleAddAnnotation}
            onAddPresentation={handleAddPresentation}
            videoRef={videoRef}
            mapSourceToEffective={mapSourceToEffective}
            mapEffectiveToSource={editingSession ? ((timeMs: number) => timeMs) : mapEffectiveToSource}
            isTrimTrackVisible={isTrimTrackVisible}
            selectedVideoId={selectedVideoId}
            onSelectVideo={onSelectVideo}
            isTimelineResizing={isTimelineResizing}
            snapGuideMs={snapGuideMs}
            getVisualSnapSpan={isMagneticSnapEnabled ? getVisualMagneticSnapSpan : undefined}
            getVisualResizeSnapSpan={isMagneticSnapEnabled ? getVisualResizeMagneticSnapSpan : undefined}
          />
        </TimelineWrapper>
      </div>
    </div>
  );
}
