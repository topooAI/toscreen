import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimelineContext } from "dnd-timeline";
import { useWaveformCache } from "../hooks/useWaveformCache";
import { Button } from "../../ui/button";
import { Plus, Scissors, ZoomIn, MessageSquare, ChevronDown, Check, Target, Scan } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { useTimeMap } from "../hooks/useTimeMap";
import TimelineWrapper from "./TimelineWrapper";
import Row from "./Row";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
import { partitionIntoTimelineLanes } from "./lanePartition";
import type { Range, Span } from "dnd-timeline";
import type { ZoomRegion, TrimRegion, AnnotationRegion, AudioRegion } from "../types";
import { v4 as uuidv4 } from 'uuid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { type AspectRatio, getAspectRatioLabel } from "../../../utils/aspectRatioUtils";
import { formatShortcut } from "../../../utils/platformUtils";

import PlaybackControls from "../PlaybackControls";

const ZOOM_ROW_ID = "row-zoom";
const TRIM_ROW_ID = "row-trim";
const VIDEO_ROW_ID = "row-video";
const FALLBACK_RANGE_MS = 1000;
const TARGET_MARKER_COUNT = 12;
const FALLBACK_TRACK_START_PX = 156;

function getTrackStartPx(timeline: HTMLElement | null) {
  if (!timeline) return FALLBACK_TRACK_START_PX;
  const trackArea = timeline.querySelector<HTMLElement>('[data-timeline-track-area="true"]');
  if (!trackArea) return FALLBACK_TRACK_START_PX;

  const timelineRect = timeline.getBoundingClientRect();
  const trackRect = trackArea.getBoundingClientRect();
  return Math.max(0, trackRect.left - timelineRect.left);
}

interface TimelineEditorProps {
  videoDuration: number;
  sourceVideoDuration?: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  zoomRegions: ZoomRegion[];
  onZoomAdded: (span: Span) => void;
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
  aspectRatio: AspectRatio;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  isFullScreenBinding: boolean;
  onFullScreenBindingChange: (enabled: boolean) => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
  onTimelineResizeStart?: () => void;
  onTimelineResizeEnd?: () => void;
  videoPath?: string;
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
  variant: 'zoom' | 'trim' | 'annotation' | 'audio' | 'video';
  sourceUrl?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  totalDurationMs?: number;
  startMs?: number;
  volume?: number;
  volumeKeyframes?: any[];
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
      const rawTimeMs = freezeExternalTime ? currentTimeMsRef.current : (video ? video.currentTime * 1000 : currentTimeMsRef.current);
      const timeMs = (isTrimTrackVisible || !mapSourceToEffective) 
        ? rawTimeMs 
        : mapSourceToEffective(rawTimeMs);

      // --- 关键防守与解绑逻辑 ---
      // 1. 防御 NaN 或 Infinity，避免 valueToPixels 崩溃导致游标飞到 0px
      if (!Number.isFinite(timeMs) || !Number.isFinite(videoDurationMs) || videoDurationMs <= 0) {
        container.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }

      let finalTimeMs = timeMs;
      // 2. 只有在视频真正播放时，且没有在拖拽时，才跟随底层真实的 currentTime
      // 当暂停或拖拽时，或者拿不到 video 实例时，完全信任 React 传递下来的 currentTimeMsRef（精准落点，无视底层帧吸附）
      if (!freezeExternalTime && !isDraggingRef.current && video && !video.paused && !Number.isNaN(video.currentTime)) {
        finalTimeMs = timeMs;
      } else {
        finalTimeMs = currentTimeMsRef.current;
      }

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
      const clickX = e.clientX - rect.left - trackStartPx;
      
      const relativeMs = pixelsToValue(clickX);
      const effectiveMs = Math.max(0, range.start + relativeMs);
      const sourceMs = (isTrimTrackVisible || !mapEffectiveToSource)
        ? effectiveMs
        : mapEffectiveToSource(effectiveMs);
      
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
        className="absolute top-0 bottom-0 w-[16px] -ml-[8px] cursor-ew-resize pointer-events-auto flex justify-center group/line"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
      >
        <div className="w-[1px] h-full bg-[#FF00B7] shadow-[0_0_10px_rgba(255,0,183,0.5)] group-hover/line:shadow-[0_0_15px_rgba(255,0,183,0.7)]" />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center hover:scale-110 transition-transform cursor-grab active:cursor-grabbing drop-shadow-md"
        >
          {/* 上半部方块 */}
          <div className="w-2.5 h-2 bg-[#FF00B7] rounded-t-[1px] shadow-sm" />
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
    const minorInterval = intervalMs / 5;
    
    for (let time = firstMarker; time <= maxTime; time += minorInterval) {
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
      className="h-8 bg-[#09090b] border-b border-white/5 relative overflow-hidden select-none w-full"
    >
      {markers.minorTicks.map((time) => {
        const offset = valueToPixels(time - range.start);
        return (
          <div
            key={`minor-${time}`}
            className="absolute bottom-0 h-1 w-[1px] bg-white/5"
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
              <div className="h-2 w-[1px] bg-white/20 mb-1" />
              <span className="text-[10px] font-medium tabular-nums tracking-tight text-slate-500">
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
  onAddZoom,
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
  onAddZoom?: () => void;
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
}) {
  
  const trackRenderer = useMemo(() => {
    const hasAssociatedAudio = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio);
    const isAssociatedAudioSelected = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio?.id === selectedAudioId);
    const videoRowHeight = isAssociatedAudioSelected ? 112 : (hasAssociatedAudio ? 96 : 82);

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
      
      <Row id={ZOOM_ROW_ID} onAddClick={onAddZoom}>
        {items.filter(item => item.rowId === ZOOM_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedZoomId}
            onSelect={() => onSelectZoom?.(item.id)}
            variant="zoom"
            zoomDepth={item.zoomDepth}
            onDirectSpanChange={onItemSpanChange}
            onDirectSpanPreview={onItemResizePreview}
            onDirectResizeStart={onTimelineResizeStart}
            onDirectResizeEnd={onTimelineResizeEnd}
          >
            {item.label}
          </Item>
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
              >
                {item.label}
              </Item>
            ))}
          </Row>
        ));
      })()}
    </>
  );
}, [items, zoomRegions, zoomBoundaryRegions, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedAudioId, waveformCache, selectedVideoId, onSelectVideo, onSelectAudio, onAudioVolumeKeyframesChange, onItemSpanChange, onItemResizePreview, onTimelineResizeStart, onTimelineResizeEnd]);

const { setTimelineRef, style, range, pixelsToValue, setSidebarRef } = useTimelineContext();
  const localTimelineRef = useRef<HTMLDivElement | null>(null);
  const [trackStartPx, setTrackStartPx] = useState(FALLBACK_TRACK_START_PX);

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
    if (isTimelineResizing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!onSeek || videoDurationMs <= 0) return;
    
    onSelectZoom?.(null);
    onSelectTrim?.(null);
    onSelectAnnotation?.(null);
    onSelectAudio?.(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const rawClickX = e.clientX - rect.left;
    
    if (rawClickX < trackStartPx) {
      onSeek(0);
      return;
    }
    
    const clickX = rawClickX - trackStartPx;
    
    const relativeMs = pixelsToValue(clickX);
    const effectiveMs = Math.max(0, range.start + relativeMs);
    const sourceMs = (isTrimTrackVisible || !mapEffectiveToSource)
      ? effectiveMs
      : mapEffectiveToSource(effectiveMs);
    
    console.log(
      `[TimelineSeek] rawX=${rawClickX.toFixed(1)} trackStart=${trackStartPx.toFixed(1)} effectiveMs=${effectiveMs.toFixed(1)} sourceMs=${sourceMs.toFixed(1)}`
    );
    onSeek(sourceMs / 1000);
  }, [isTimelineResizing, trackStartPx, range.start, pixelsToValue, onSeek, videoDurationMs, onSelectZoom, onSelectTrim, onSelectAnnotation, onSelectAudio, isTrimTrackVisible, mapEffectiveToSource]);

  return (
    <div
      ref={setRefs}
      style={style}
      className="select-none bg-[#09090b] min-h-[140px] h-full relative cursor-pointer group"
      onClick={handleTimelineClick}
    >
      {/* 虚拟的 Sidebar 测量节点：真实宽度140 + 16px呼吸留白 = 156 */}
      <div 
        ref={setSidebarRef} 
        style={{ position: 'absolute', width: 156, height: 1, opacity: 0, pointerEvents: 'none' }} 
      />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px)] bg-[length:20px_100%] pointer-events-none" />
      <TimelineAxis intervalMs={intervalMs} videoDurationMs={videoDurationMs} trackStartPx={trackStartPx} />
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
  videoDuration,
  sourceVideoDuration,
  currentTime,
  onSeek,
  zoomRegions,
  onZoomAdded,
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
  audioRegions = [],
  onAudioSpanChange,
  onAudioDelete,
  selectedAudioId,
  onSelectAudio,
  onAudioVolumeKeyframesChange,
  aspectRatio,
  onAspectRatioChange,
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
}: TimelineEditorProps) {
  const projectTotalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
  const sourceTotalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000)), [sourceVideoDuration, videoDuration]);
  const totalMs = projectTotalMs;
  const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);

  const isTrimTrackVisible = false; // 用户强制要求删除 Trim UI
  const { effectiveDurationMs, mapSourceToEffective, mapEffectiveToSource } = useTimeMap(trimRegions, sourceTotalMs);
  
  const activeDurationMs = isTrimTrackVisible ? projectTotalMs : Math.max(projectTotalMs, effectiveDurationMs);
  const activeCurrentTimeMs = isTrimTrackVisible ? currentTimeMs : mapSourceToEffective(currentTimeMs);

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
  const [shortcuts, setShortcuts] = useState({
    pan: 'Shift + Ctrl + Scroll',
    zoom: 'Ctrl + Scroll'
  });

  useEffect(() => {
    formatShortcut(['shift', 'mod', 'Scroll']).then(pan => {
      formatShortcut(['mod', 'Scroll']).then(zoom => {
        setShortcuts({ pan, zoom });
      });
    });
  }, []);

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

  const deleteSelectedAudio = useCallback(() => {
    if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
    onAudioDelete(selectedAudioId);
    onSelectAudio(null);
  }, [selectedAudioId, onAudioDelete, onSelectAudio]);

  useEffect(() => {
    setRange(createInitialRange(activeDurationMs));
  }, [activeDurationMs]);

  useEffect(() => {
    // Only clamp if we have a valid duration and regions to clamp
    if (totalMs <= 0 || safeMinDurationMs <= 0) {
      return;
    }

    zoomRegions.forEach((region) => {
      const clampedStart = Math.max(0, Math.min(region.startMs, projectTotalMs));
      const minEnd = clampedStart + safeMinDurationMs;
      const clampedEnd = Math.min(projectTotalMs, Math.max(minEnd, region.endMs));
      const normalizedStart = Math.max(0, Math.min(clampedStart, projectTotalMs - safeMinDurationMs));
      const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, projectTotalMs));

      if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
        onZoomSpanChange(region.id, { start: normalizedStart, end: normalizedEnd });
      }
    });

    trimRegions.forEach((region) => {
      const clampedStart = Math.max(0, Math.min(region.startMs, sourceTotalMs));
      const minEnd = clampedStart + safeMinDurationMs;
      const clampedEnd = Math.min(sourceTotalMs, Math.max(minEnd, region.endMs));
      const normalizedStart = Math.max(0, Math.min(clampedStart, sourceTotalMs - safeMinDurationMs));
      const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, sourceTotalMs));

      if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
        onTrimSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
      }
    });
  }, [zoomRegions, trimRegions, projectTotalMs, sourceTotalMs, safeMinDurationMs, onZoomSpanChange, onTrimSpanChange]);

  const hasOverlap = useCallback((newSpan: Span, excludeId?: string, targetRowId?: string): boolean => {
    const mapTime = (time: number) => (isTrimTrackVisible || !mapSourceToEffective) ? time : mapSourceToEffective(time);
    const baseExcludeId = excludeId?.split('-part-')[0];
    const isZoomItem = zoomRegions.some(r => r.id === excludeId);
    const isTrimItem = trimRegions.some(r => r.id === excludeId);
    const isAnnotationItem = (annotationRegions || []).some(r => r.id === excludeId);
    const isAudioItem = (audioRegions || []).some(r => r.id === baseExcludeId);

    if (isAnnotationItem) {
      // Annotation overlap is resolved by visual lane wrapping instead of collision rejection.
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
      // Annotation overlap is resolved by visual lane wrapping instead of collision rejection.
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

    const defaultDuration = Math.min(1000, totalMs);
    if (defaultDuration <= 0) {
      return;
    }

    // Always place zoom at playhead
    const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
    // Find the next zoom region after the playhead
    const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);
    const nextRegion = sorted.find(region => region.startMs > startPos);
    const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

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
  }, [videoDuration, totalMs, currentTimeMs, zoomRegions, onZoomAdded]);

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

    const defaultDuration = Math.min(1000, totalMs);
    if (defaultDuration <= 0) {
      return;
    }

    // Multiple annotations can exist at the same timestamp
    const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
    const endPos = Math.min(startPos + defaultDuration, totalMs);
    
    onAnnotationAdded({ start: startPos, end: endPos });
  }, [videoDuration, totalMs, currentTimeMs, onAnnotationAdded]);

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
        if (selectedZoomId) {
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
        if (selectedKeyframeId) {
          deleteSelectedKeyframe();
        } else if (selectedZoomId) {
          deleteSelectedZoom();
        } else if (selectedTrimId) {
          deleteSelectedTrim();
        } else if (selectedAnnotationId) {
          deleteSelectedAnnotation();
        } else if (selectedAudioId) {
          deleteSelectedAudio();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addKeyframe, handleAddZoom, handleAddTrim, handleAddAnnotation, deleteSelectedKeyframe, deleteSelectedZoom, deleteSelectedTrim, deleteSelectedAnnotation, deleteSelectedAudio, selectedKeyframeId, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedAudioId, annotationRegions, currentTime, onSelectAnnotation]);

  const clampedRange = useMemo<Range>(() => {
    const start = Math.max(0, range.start);
    const end = Math.max(range.end, start + timelineScale.minVisibleRangeMs);
    return { start, end };
  }, [range, timelineScale.minVisibleRangeMs]);

  const audioItemsToCache = useMemo(() => audioRegions || [], [audioRegions]);
  const waveformCache = useWaveformCache(audioItemsToCache);

  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const mapTime = (time: number) => isTrimTrackVisible ? time : mapSourceToEffective(time);

    const originalAudio = audioRegions.find(r => r.isOriginal && !r.isDetached);

    const videos: TimelineRenderItem[] = [{
      id: 'video-track',
      rowId: VIDEO_ROW_ID,
      span: { start: 0, end: mapTime(sourceTotalMs) },
      label: 'Main Track',
      variant: 'video',
      sourceUrl: videoPath,
      sourceStartMs: 0,
      associatedAudio: originalAudio ? {
        ...originalAudio,
        sourceStartMs: 0,
        sourceEndMs: sourceTotalMs,
      } : undefined,
    }];
    
    const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
      id: region.id,
      rowId: ZOOM_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: `Zoom ${index + 1}`,
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

    const filteredAudios = (audioRegions || []).filter(region => !region.isOriginal || region.isDetached);
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

    const mainClips: TimelineRenderItem[] = [];
    if (!isTrimTrackVisible) {
      const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
      let currentSourceStart = 0;
      sortedTrims.forEach((trim, index) => {
        if (currentSourceStart < trim.startMs) {
           mainClips.push({
             id: `main-clip-${index}`,
             rowId: VIDEO_ROW_ID,
             span: { start: mapTime(currentSourceStart), end: mapTime(trim.startMs) },
             label: 'Main Clip',
             variant: 'video',
             sourceUrl: videoPath,
             sourceStartMs: currentSourceStart,
             sourceEndMs: trim.startMs,
             totalDurationMs: trim.startMs - currentSourceStart,
             associatedAudio: originalAudio ? {
              ...originalAudio,
              sourceStartMs: currentSourceStart,
              sourceEndMs: trim.startMs,
            } : undefined,
           });
        }
        currentSourceStart = trim.endMs;
      });
      if (currentSourceStart < sourceTotalMs) {
         mainClips.push({
             id: `main-clip-final`,
             rowId: VIDEO_ROW_ID,
             span: { start: mapTime(currentSourceStart), end: mapTime(sourceTotalMs) },
             label: 'Main Clip',
             variant: 'video',
             sourceUrl: videoPath,
             sourceStartMs: currentSourceStart,
             sourceEndMs: sourceTotalMs,
             totalDurationMs: sourceTotalMs - currentSourceStart,
             associatedAudio: originalAudio ? {
               ...originalAudio,
               sourceStartMs: currentSourceStart,
               sourceEndMs: sourceTotalMs,
             } : undefined,
         });
      }
    }

    const videoItems = isTrimTrackVisible ? videos : mainClips;
    return [...videoItems, ...zooms, ...trims, ...annotations, ...audios];
  }, [
    isTrimTrackVisible, mapSourceToEffective, sourceTotalMs, zoomRegions,
    trimRegions, annotationRegions, audioRegions, totalMs, waveformCache, videoPath
  ]);

  const getMagneticSnapSpan = useCallback((
    activeItemId: string,
    targetSpan: Span
  ): Span => {
    const baseExcludeId = activeItemId.split('-part-')[0];
    
    // 1. 找到当前操作的 item，获取它的 rowId 以及它对应的旧 span
    const itemInRender = timelineItems.find(item => item.id === activeItemId);
    if (!itemInRender) return targetSpan;

    const rowId = itemInRender.rowId;
    const oldSpan = itemInRender.span;

    // 2. 收集同行所有兄弟片段以及视频主轨（VIDEO_ROW_ID）在时间轴上的有效边缘 (start, end)
    const peerSpans = timelineItems
      .filter(item => 
        item.id !== activeItemId && 
        item.id.split('-part-')[0] !== baseExcludeId &&
        (item.rowId === rowId || item.rowId === VIDEO_ROW_ID)
      )
      .map(item => item.span);

    // 3. 收集吸附目标点 (Snap Points)
    // 除了这些 peerSpans 的 start 和 end 之外，还有播放头 activeCurrentTimeMs
    const snapTargets: number[] = [activeCurrentTimeMs];
    for (const peer of peerSpans) {
      snapTargets.push(peer.start);
      snapTargets.push(peer.end);
    }

    // 4. 计算磁吸阈值
    const SNAP_THRESHOLD_MS = Math.max(50, Math.min(300, timelineScale.intervalMs / 5));

    // 5. 区分是拖拽 (drag) 还是拉伸 (resize)
    const duration = targetSpan.end - targetSpan.start;
    const oldDuration = oldSpan.end - oldSpan.start;
    const isTrimming = Math.abs(duration - oldDuration) > 1; // 时长变化大于 1ms 即为拉伸

    let closestDelta = Infinity;
    let snapOffset = 0;

    if (isTrimming) {
      // 拉伸状态：区分是拉左边缘还是拉右边缘
      const isResizingLeft = Math.abs(targetSpan.end - oldSpan.end) <= 2; // 右边缘基本没变，说明拉左边缘
      const isResizingRight = Math.abs(targetSpan.start - oldSpan.start) <= 2; // 左边缘基本没变，说明拉右边缘

      if (isResizingLeft) {
        // 磁吸 targetSpan.start
        for (const t of snapTargets) {
          const diff = t - targetSpan.start;
          if (Math.abs(diff) < Math.abs(closestDelta) && Math.abs(diff) <= SNAP_THRESHOLD_MS) {
            closestDelta = diff;
            snapOffset = diff;
          }
        }
        if (closestDelta !== Infinity) {
          return { start: targetSpan.start + snapOffset, end: targetSpan.end };
        }
      } else if (isResizingRight) {
        // 磁吸 targetSpan.end
        for (const t of snapTargets) {
          const diff = t - targetSpan.end;
          if (Math.abs(diff) < Math.abs(closestDelta) && Math.abs(diff) <= SNAP_THRESHOLD_MS) {
            closestDelta = diff;
            snapOffset = diff;
          }
        }
        if (closestDelta !== Infinity) {
          return { start: targetSpan.start, end: targetSpan.end + snapOffset };
        }
      }
    } else {
      // 拖拽状态：整体平移
      for (const t of snapTargets) {
        // 检查 start 是否接近吸附点
        const diffStart = t - targetSpan.start;
        if (Math.abs(diffStart) < Math.abs(closestDelta) && Math.abs(diffStart) <= SNAP_THRESHOLD_MS) {
          closestDelta = diffStart;
          snapOffset = diffStart;
        }
        // 检查 end 是否接近吸附点
        const diffEnd = t - targetSpan.end;
        if (Math.abs(diffEnd) < Math.abs(closestDelta) && Math.abs(diffEnd) <= SNAP_THRESHOLD_MS) {
          closestDelta = diffEnd;
          snapOffset = diffEnd;
        }
      }

      if (closestDelta !== Infinity) {
        return { start: targetSpan.start + snapOffset, end: targetSpan.end + snapOffset };
      }
    }

    return targetSpan;
  }, [timelineItems, activeCurrentTimeMs, timelineScale.intervalMs]);

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
    const targetSpan = isTrimTrackVisible 
      ? { ...span } 
      : { start: mapEffectiveToSource(span.start), end: mapEffectiveToSource(span.end) };
      
    // Check if it's a zoom or trim item
    if (zoomRegions.some(r => r.id === id)) {
      onZoomSpanChange(id, targetSpan);
    } else if (trimRegions.some(r => r.id === id)) {
      onTrimSpanChange?.(id, targetSpan);
    } else if ((annotationRegions || []).some(r => r.id === id)) {
      onAnnotationSpanChange?.(id, targetSpan);
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
          const sourceEnd = audioRegion.sourceEndMs ?? (audioRegion.endMs - audioRegion.startMs);
          
          const isTrimmingLeft = Math.abs(targetSpan.end - audioRegion.endMs) < 1;
          const isTrimmingRight = Math.abs(targetSpan.start - audioRegion.startMs) < 1;

          if (isTrimmingLeft) {
            // How much left can we pull the handle? Max is exactly sourceStart ms.
            const maxLeftShift = sourceStart;
            if (audioRegion.startMs - targetSpan.start > maxLeftShift) {
              targetSpan.start = audioRegion.startMs - maxLeftShift;
            }
          } else if (isTrimmingRight) {
            // How much right can we pull the handle? Max is the remaining duration in the source file.
            const maxRightShift = maxDuration - sourceEnd;
            if (targetSpan.end - audioRegion.endMs > maxRightShift) {
              targetSpan.end = audioRegion.endMs + maxRightShift;
            }
          }
        }
      }
      onAudioSpanChange?.(id, targetSpan);
    }
  }, [zoomRegions, trimRegions, annotationRegions, audioRegions, onZoomSpanChange, onTrimSpanChange, onAnnotationSpanChange, onAudioSpanChange, isTrimTrackVisible, mapEffectiveToSource]);

  if (!videoDuration || videoDuration === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-[#09090b] gap-3">
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
    <div className="flex-1 flex flex-col bg-[#09090b] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#09090b] relative">
        <div className="flex items-center gap-1">
          <Button
            onClick={handleAddZoom}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-[#34B27B] hover:bg-[#34B27B]/10 transition-all"
            title="Add Zoom (Z)"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            onClick={handleAddTrim}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
            title="Add Trim (T)"
          >
            <Scissors className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <Button
            onClick={handleAddAnnotation}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-[#B4A046] hover:bg-[#B4A046]/10 transition-all"
            title="Add Annotation (A)"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onFullScreenBindingChange(!isFullScreenBinding)}
            className={cn(
              "h-7 w-7 transition-all",
              isFullScreenBinding 
                ? "text-[#34B27B] bg-[#34B27B]/10 hover:bg-[#34B27B]/20" 
                : "text-slate-400 hover:text-[#34B27B] hover:bg-[#34B27B]/10"
            )}
            title={isFullScreenBinding ? "Full Screen Priority (Hides Background)" : "Center Priority (Prioritizes Mouse Position)"}
          >
            {isFullScreenBinding ? <Scan className="w-4 h-4" /> : <Target className="w-4 h-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all gap-1"
              >
                <span className="font-medium">{getAspectRatioLabel(aspectRatio)}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
              {(['16:9', '9:16', '1:1', '4:3', '4:5'] as AspectRatio[]).map((ratio) => (
                <DropdownMenuItem
                  key={ratio}
                  onClick={() => onAspectRatioChange(ratio)}
                  className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer flex items-center justify-between gap-3"
                >
                  <span>{getAspectRatioLabel(ratio)}</span>
                  {aspectRatio === ratio && <Check className="w-3 h-3 text-[#34B27B]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-sans">{shortcuts.pan}</kbd>
            <span>Pan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[#34B27B] font-sans">{shortcuts.zoom}</kbd>            
            <span>Zoom</span>
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[#09090b] relative"
        onClick={() => setSelectedKeyframeId(null)}
      >
        <TimelineWrapper
          range={clampedRange}
          videoDuration={activeDurationMs / 1000}
          hasOverlap={hasOverlap}
          getNonOverlappingSpan={getNonOverlappingSpan}
          getMagneticSnapSpan={getMagneticSnapSpan}
          onRangeChange={setRange}
          minItemDurationMs={timelineScale.minItemDurationMs}
          minVisibleRangeMs={timelineScale.minVisibleRangeMs}
          gridSizeMs={timelineScale.gridMs}
          onItemSpanChange={handleItemSpanChange}
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
            selectedAudioId={selectedAudioId}
            onSelectAudio={onSelectAudio}
            waveformCache={waveformCache}
            onAudioVolumeKeyframesChange={onAudioVolumeKeyframesChange}
            onItemSpanChange={handleItemSpanChange}
            onTimelineResizeStart={handleTimelineResizeStart}
            onTimelineResizeEnd={handleTimelineResizeEnd}
            onAddZoom={handleAddZoom}
            onAddAnnotation={handleAddAnnotation}
            videoRef={videoRef}
            mapSourceToEffective={mapSourceToEffective}
            mapEffectiveToSource={mapEffectiveToSource}
            isTrimTrackVisible={isTrimTrackVisible}
            selectedVideoId={selectedVideoId}
            onSelectVideo={onSelectVideo}
            isTimelineResizing={isTimelineResizing}
          />
        </TimelineWrapper>
      </div>
    </div>
  );
}
