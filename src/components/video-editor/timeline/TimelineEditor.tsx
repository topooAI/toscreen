import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimelineContext } from "dnd-timeline";
import { useWaveformCache } from "../hooks/useWaveformCache";
import { Button } from "../../ui/button";
import { Plus, Scissors, ZoomIn, MessageSquare, ChevronDown, Check, Target, Scan, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { useTimeMap } from "../hooks/useTimeMap";
import TimelineWrapper from "./TimelineWrapper";
import Row from "./Row";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
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
const ANNOTATION_ROW_ID = "row-annotation";
const AUDIO_ROW_ID = "row-audio";
const VIDEO_ROW_ID = "row-video";
const FALLBACK_RANGE_MS = 1000;
const TARGET_MARKER_COUNT = 12;

interface TimelineEditorProps {
  videoDuration: number;
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
  isTrimTrackVisible,
}: { 
  currentTimeMs: number; 
  videoDurationMs: number;
  onSeek?: (time: number) => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mapSourceToEffective?: (ms: number) => number;
  isTrimTrackVisible?: boolean;
}) {
  const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";
  const [isDragging, setIsDragging] = useState(false);
  const cursorLineRef = useRef<HTMLDivElement>(null);
  const cursorContainerRef = useRef<HTMLDivElement>(null);

  // High-frequency DOM update via rAF — bypasses React render entirely
  useEffect(() => {
    if (!videoRef?.current) return;
    
    let rafId: number;
    const tick = () => {
      const line = cursorLineRef.current;
      const container = cursorContainerRef.current;
      if (!line || !container) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const video = videoRef.current;
      if (!video) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const rawTimeMs = video.currentTime * 1000;
      const timeMs = (isTrimTrackVisible || !mapSourceToEffective) 
        ? rawTimeMs 
        : mapSourceToEffective(rawTimeMs);
      
      if (videoDurationMs <= 0 || timeMs < 0) {
        container.style.display = 'none';
        rafId = requestAnimationFrame(tick);
        return;
      }
      
      const clampedTime = Math.min(timeMs, videoDurationMs);
      if (clampedTime < range.start || clampedTime > range.end) {
        container.style.display = 'none';
      } else {
        container.style.display = '';
        const offset = valueToPixels(clampedTime - range.start);
        line.style[sideProperty as any] = `${sidebarWidth + offset - 0.5}px`;
      }
      
      rafId = requestAnimationFrame(tick);
    };
    
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef, videoDurationMs, range.start, range.end, sidebarWidth, sideProperty, valueToPixels, mapSourceToEffective, isTrimTrackVisible]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || !onSeek) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - sidebarWidth;
      
      // Allow dragging outside to 0 or max, but clamp the value
      const relativeMs = pixelsToValue(clickX);
      const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
      
      onSeek(absoluteMs / 1000);
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
  }, [isDragging, onSeek, timelineRef, sidebarWidth, range.start, videoDurationMs, pixelsToValue]);

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
        className="absolute top-0 bottom-0 w-[1px] bg-[#FF00B7] shadow-[0_0_10px_rgba(255,0,183,0.5)] cursor-ew-resize pointer-events-auto hover:shadow-[0_0_15px_rgba(255,0,183,0.7)]"
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
      >
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
  sidebarWidth,
}: {
  intervalMs: number;
  videoDurationMs: number;
  sidebarWidth: number;
}) => {
  const { direction, range, valueToPixels } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";

  const markers = useMemo(() => {
    if (intervalMs <= 0) {
      return { markers: [], minorTicks: [] };
    }

    const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
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
            style={{ [sideProperty]: `${sidebarWidth + offset}px` }}
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
              [sideProperty]: `${sidebarWidth + offset}px`,
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
    prev.sidebarWidth === next.sidebarWidth
  );
});

function Timeline({
  items,
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
  onAddTrim,
  onAddAnnotation,
  selectedAudioId,
  onSelectAudio,
  waveformCache,
  onAudioVolumeKeyframesChange,
  videoRef,
  mapSourceToEffective,
  isTrimTrackVisible,
  selectedVideoId,
  onSelectVideo,
}: {
  items: TimelineRenderItem[];
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
  onAddTrim?: () => void;
  onAddAnnotation?: () => void;
  selectedAudioId?: string | null;
  onSelectAudio?: (id: string | null) => void;
  waveformCache?: any;
  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  mapSourceToEffective?: (ms: number) => number;
  isTrimTrackVisible?: boolean;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
}) {
  
  const trackRenderer = useMemo(() => {
    const hasAssociatedAudio = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio);
    const isAssociatedAudioSelected = items.some(item => item.rowId === VIDEO_ROW_ID && item.associatedAudio?.id === selectedAudioId);
    const videoRowHeight = isAssociatedAudioSelected ? 102 : (hasAssociatedAudio ? 84 : 48);

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
            onVolumeKeyframesChange={(keyframes) => onAudioVolumeKeyframesChange?.(item.associatedAudio!.id, keyframes)}
            sourceStartMs={item.associatedAudio?.sourceStartMs}
            sourceEndMs={item.associatedAudio?.sourceEndMs}
            totalDurationMs={item.associatedAudio?.totalDurationMs}
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
          >
            {item.label}
          </Item>
        ))}
      </Row>

      <Row id={TRIM_ROW_ID} onAddClick={onAddTrim}>
        {items.filter(item => item.rowId === TRIM_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedTrimId}
            onSelect={() => onSelectTrim?.(item.id)}
            variant="trim"
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
}, [items, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedAudioId, waveformCache, selectedVideoId, onSelectVideo, onSelectAudio, onAudioVolumeKeyframesChange]);

const { setTimelineRef, style, sidebarWidth, range, pixelsToValue, setSidebarRef } = useTimelineContext();
  const localTimelineRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setTimelineRef(node);
    localTimelineRef.current = node;
  }, [setTimelineRef]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || videoDurationMs <= 0) return;
    
    // Only clear selection if clicking on empty space (not on items)
    // This is handled by event propagation - items stop propagation
    onSelectZoom?.(null);
    onSelectTrim?.(null);
    onSelectAnnotation?.(null);
    onSelectAudio?.(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - sidebarWidth;
    
    if (clickX < 0) return;
    
    const relativeMs = pixelsToValue(clickX);
    const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
    const timeInSeconds = absoluteMs / 1000;
    
    onSeek(timeInSeconds);
  }, [onSeek, onSelectZoom, onSelectTrim, onSelectAnnotation, onSelectAudio, videoDurationMs, sidebarWidth, range.start, pixelsToValue]);

  const zoomItems = items.filter(item => item.rowId === ZOOM_ROW_ID);
  const trimItems = items.filter(item => item.rowId === TRIM_ROW_ID);
  const annotationItems = items.filter(item => item.rowId === ANNOTATION_ROW_ID);
  const audioItems = items.filter(item => item.rowId === AUDIO_ROW_ID);

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
      <TimelineAxis intervalMs={intervalMs} videoDurationMs={videoDurationMs} sidebarWidth={sidebarWidth} />
      <PlaybackCursor 
        currentTimeMs={currentTimeMs} 
        videoDurationMs={videoDurationMs} 
        onSeek={onSeek}
        timelineRef={localTimelineRef}
        videoRef={videoRef}
        mapSourceToEffective={mapSourceToEffective}
        isTrimTrackVisible={isTrimTrackVisible}
      />

      {trackRenderer}
    </div>
  );
}

export default function TimelineEditor({
  videoDuration,
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
  onAudioAdded,
  onAudioVolumeChange,
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
}: TimelineEditorProps) {
  const totalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
  const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);

  const [isTrimTrackVisible, setIsTrimTrackVisible] = useState(false);
  const { effectiveDurationMs, mapSourceToEffective, mapEffectiveToSource } = useTimeMap(trimRegions, totalMs);
  
  const activeDurationMs = isTrimTrackVisible ? totalMs : effectiveDurationMs;
  const activeCurrentTimeMs = isTrimTrackVisible ? currentTimeMs : mapSourceToEffective(currentTimeMs);

  const timelineScale = useMemo(() => calculateTimelineScale(activeDurationMs / 1000), [activeDurationMs]);
  const safeMinDurationMs = useMemo(
    () => (activeDurationMs > 0 ? Math.min(timelineScale.minItemDurationMs, activeDurationMs) : timelineScale.minItemDurationMs),
    [timelineScale.minItemDurationMs, activeDurationMs],
  );

  const [range, setRange] = useState<Range>(() => createInitialRange(activeDurationMs));
  const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
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
  }, [totalMs]);

  useEffect(() => {
    // Only clamp if we have a valid duration and regions to clamp
    if (totalMs <= 0 || safeMinDurationMs <= 0) {
      return;
    }

    zoomRegions.forEach((region) => {
      const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
      const minEnd = clampedStart + safeMinDurationMs;
      const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
      const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
      const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

      if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
        onZoomSpanChange(region.id, { start: normalizedStart, end: normalizedEnd });
      }
    });

    trimRegions.forEach((region) => {
      const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
      const minEnd = clampedStart + safeMinDurationMs;
      const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
      const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
      const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

      if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
        onTrimSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
      }
    });
  }, [zoomRegions, trimRegions, annotationRegions, totalMs, safeMinDurationMs, onZoomSpanChange, onTrimSpanChange, onAnnotationSpanChange]);

  const hasOverlap = useCallback((newSpan: Span, excludeId?: string): boolean => {
    // Determine which row the item belongs to
    const isZoomItem = zoomRegions.some(r => r.id === excludeId);
    const isTrimItem = trimRegions.some(r => r.id === excludeId);
    const isAnnotationItem = (annotationRegions || []).some(r => r.id === excludeId);
    const isAudioItem = (audioRegions || []).some(r => r.id === excludeId);

    if (isAnnotationItem || isAudioItem) {
      return false;
    }

    // Helper to check overlap against a specific set of regions
    const checkOverlap = (regions: (ZoomRegion | TrimRegion)[]) => {
      return regions.some((region) => {
        if (region.id === excludeId) return false;
        const gapBefore = newSpan.start - region.endMs;
        const gapAfter = region.startMs - newSpan.end;
        // Snap if gap is 2ms or less
        if (gapBefore > 0 && gapBefore <= 2) return true;
        if (gapAfter > 0 && gapAfter <= 2) return true;
        return !(newSpan.end <= region.startMs || newSpan.start >= region.endMs);
      });
    };

    if (isZoomItem) {
      return checkOverlap(zoomRegions);
    }

    if (isTrimItem) {
      return checkOverlap(trimRegions);
    }

    return false;
  }, [zoomRegions, trimRegions, annotationRegions, audioRegions]);

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
    if (activeDurationMs === 0) {
      return range;
    }

    return {
      start: Math.max(0, Math.min(range.start, totalMs)),
      end: Math.min(range.end, totalMs),
    };
  }, [range, totalMs]);

  const audioItemsToCache = useMemo(() => audioRegions || [], [audioRegions]);
  const waveformCache = useWaveformCache(audioItemsToCache);

  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const mapTime = (time: number) => isTrimTrackVisible ? time : mapSourceToEffective(time);

    const originalAudio = audioRegions.find(r => r.isOriginal && !r.isDetached);

    const videos: TimelineRenderItem[] = [{
      id: 'video-track',
      rowId: VIDEO_ROW_ID,
      span: { start: 0, end: mapTime(totalMs) },
      label: 'Main Track',
      variant: 'video',
      associatedAudio: originalAudio ? {
        ...originalAudio,
        sourceStartMs: 0,
        sourceEndMs: totalMs,
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

    const partitionIntoTracks = <T extends { startMs: number; endMs: number }>(regions: T[]) => {
      const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);
      const tracks: number[][] = []; // store endMs of items in each track
      const result: { item: T; trackIndex: number }[] = [];
      
      for (const item of sorted) {
        let assignedTrack = -1;
        for (let i = 0; i < tracks.length; i++) {
          const lastEnd = tracks[i][tracks[i].length - 1];
          if (item.startMs >= lastEnd) {
            assignedTrack = i;
            tracks[i].push(item.endMs);
            break;
          }
        }
        if (assignedTrack === -1) {
          assignedTrack = tracks.length;
          tracks.push([item.endMs]);
        }
        result.push({ item, trackIndex: assignedTrack });
      }
      return result;
    };

    const partitionedAnnotations = partitionIntoTracks(annotationRegions || []);
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
    const partitionedAudios = partitionIntoTracks(filteredAudios);
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
             associatedAudio: originalAudio ? {
              ...originalAudio,
              sourceStartMs: currentSourceStart,
              sourceEndMs: trim.startMs,
            } : undefined,
           });
        }
        currentSourceStart = trim.endMs;
      });
      if (currentSourceStart < totalMs) {
         mainClips.push({
             id: `main-clip-final`,
             rowId: VIDEO_ROW_ID,
             span: { start: mapTime(currentSourceStart), end: mapTime(totalMs) },
             label: 'Main Clip',
             variant: 'video',
             associatedAudio: originalAudio ? {
               ...originalAudio,
               sourceStartMs: currentSourceStart,
               sourceEndMs: totalMs,
             } : undefined,
         });
      }
    }

    const videoItems = isTrimTrackVisible ? videos : mainClips;
    return [...videoItems, ...zooms, ...trims, ...annotations, ...audios];
  }, [
    isTrimTrackVisible, mapSourceToEffective, totalMs, zoomRegions, 
    trimRegions, annotationRegions, audioRegions, totalMs, waveformCache
  ]);

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
            onClick={() => setIsTrimTrackVisible(!isTrimTrackVisible)}
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 transition-all",
              !isTrimTrackVisible ? "text-[#34B27B] bg-[#34B27B]/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/10"
            )}
            title={!isTrimTrackVisible ? "Magnetic Mode On (Trims folded)" : "Source Mode On (Trims visible)"}
          >
            {!isTrimTrackVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
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
          onRangeChange={setRange}
          minItemDurationMs={timelineScale.minItemDurationMs}
          minVisibleRangeMs={timelineScale.minVisibleRangeMs}
          gridSizeMs={timelineScale.gridMs}
          onItemSpanChange={handleItemSpanChange}
        >
          <KeyframeMarkers
            keyframes={keyframes}
            selectedKeyframeId={selectedKeyframeId}
            setSelectedKeyframeId={setSelectedKeyframeId}
          />
          <Timeline
            items={timelineItems}
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
            onAddZoom={handleAddZoom}
            onAddTrim={handleAddTrim}
            onAddAnnotation={handleAddAnnotation}
            videoRef={videoRef}
            mapSourceToEffective={mapSourceToEffective}
            isTrimTrackVisible={isTrimTrackVisible}
            selectedVideoId={selectedVideoId}
            onSelectVideo={onSelectVideo}
          />
        </TimelineWrapper>
      </div>
    </div>
  );
}
