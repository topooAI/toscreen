import React from 'react';
import { useItem, useTimelineContext } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
// lucide-react icons removed per user requirement: pure text only
import glassStyles from "./ItemGlass.module.css";
import VolumeEnvelope from './VolumeEnvelope';
import { VolumeKeyframe, AudioRegion, ZoomRegion } from '../types';
import { useAudioWaveform } from "../hooks/useAudioWaveform";
import { useTimelineVisualSnap } from "./TimelineVisualSnapContext";

import { VideoThumbnails } from "./VideoThumbnails";
import { getAudioWaveformLeftPx, resolveAudioResizeBounds } from "./timelineAudioResizeBounds";

interface WaveformOverlayProps { 
  id: string; 
  url?: string; 
  isReal?: boolean; 
  sourceStartMs: number; 
  effTotalDuration: number; 
  svgOffset?: number; 
  peaks?: number[]; 
  strokeColor?: string 
}

function WaveformOverlay({ id, url, isReal = false, sourceStartMs, effTotalDuration, svgOffset = 0, peaks: propPeaks, strokeColor }: WaveformOverlayProps) {
  const isAudio = isReal;
  const sourceUrl = url;
  const { peaks: hookPeaks } = useAudioWaveform(sourceUrl || null, isAudio, 8000);
  const activePeaks = (propPeaks && propPeaks.length > 0) ? propPeaks : hookPeaks;

  const { valueToPixels } = useTimelineContext();
  const pxPerMs = valueToPixels(1);
  const svgAbsoluteWidth = Math.max(1, effTotalDuration * pxPerMs);
  const svgAbsoluteLeft = getAudioWaveformLeftPx(sourceStartMs, pxPerMs);

  const pathData = React.useMemo(() => {
    const peaks = activePeaks;
    if (!peaks || peaks.length === 0) return '';
    
    const numLines = Math.max(10, Math.floor(svgAbsoluteWidth / 1.0)); // 1 line per pixel
    const gapPx = svgAbsoluteWidth / Math.max(1, numLines - 1);
    
    const points = [];
    for (let i = 0; i < numLines; i++) {
      const prevPos = i === 0 ? 0 : ((i - 1) / Math.max(1, numLines - 1)) * (peaks.length - 1);
      const pos = (i / Math.max(1, numLines - 1)) * (peaks.length - 1);
      
      let p = 0;
      const startIdx = Math.floor(prevPos);
      const endIdx = Math.floor(pos);
      for (let j = startIdx; j <= endIdx; j++) {
        if (peaks[j] && peaks[j] > p) p = peaks[j];
      }
      
      const x = i * gapPx + 0.25;
      const compressedP = Math.pow(p, 0.5);
      const amplitude = Math.max(0.5, compressedP * 45); // Max 45px up/down
      const yTop = 50 - amplitude;
      const yBottom = 50 + amplitude;
      
      points.push(`M ${x.toFixed(1)} ${yTop.toFixed(1)} L ${x.toFixed(1)} ${yBottom.toFixed(1)}`);
    }
    return points.join(' ');
  }, [activePeaks, svgAbsoluteWidth]);

  if (!activePeaks || activePeaks.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none overflow-hidden opacity-90">
      <svg 
        id={`waveform-${id}`}
        viewBox={`0 0 ${svgAbsoluteWidth} 100`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: `${svgAbsoluteLeft}px`,
          width: `${svgAbsoluteWidth}px`,
          height: '100%',
          transformOrigin: 'left',
          transform: `translateX(${svgOffset}px)`,
        }}
      >
        <path 
          d={pathData} 
          stroke={strokeColor || "currentColor"} 
          strokeWidth="1" 
          fill="none" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          style={{ vectorEffect: 'non-scaling-stroke' }} 
        />
      </svg>
    </div>
  );
}



interface ItemProps {
  id: string;
  rowId: string;
  span: Span;
  isSelected: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
  zoomDepth?: number;
  variant?: 'zoom' | 'trim' | 'annotation' | 'video' | 'audio';
  isNestedTrim?: boolean;
  audioPeaks?: number[];
  audioPeaksDurationMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  totalDurationMs?: number;
  sourceUrl?: string;
  volume?: number;
  volumeKeyframes?: VolumeKeyframe[];
  onVolumeChange?: (vol: number) => void;
  onVolumeKeyframesChange?: (keyframes: VolumeKeyframe[]) => void;
  onDirectSpanChange?: (id: string, span: Span) => void;
  onDirectDragSpanChange?: (id: string, span: Span) => void;
  onDirectSpanPreview?: (id: string, span: Span | null) => void;
  getVisualSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  getVisualResizeSnapSpan?: (id: string, span: Span, snapThresholdMs: number) => Span;
  onDirectResizeStart?: () => void;
  onDirectResizeEnd?: () => void;
  zoomRegions?: ZoomRegion[];
  zoomBoundaryRegions?: ZoomRegion[];
  associatedAudio?: AudioRegion;
  isAudioSelected?: boolean;
  onSelectAudio?: () => void;
}

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
  1: "1.25×",
  2: "1.5×",
  3: "2.0×",
  4: "2.5×",
  5: "3.5×",
  6: "5×",
};

const TIMELINE_RESIZE_HIT_AREA_PX = 18;

function ItemComponent({ 
  id, 
  rowId,
  span, 
  isSelected = false, 
  onSelect,
  children,
  zoomDepth = 1,
  variant = 'zoom',
  isNestedTrim = false,
  audioPeaks,
  audioPeaksDurationMs,
  sourceStartMs = 0,
  sourceEndMs = 0,
  totalDurationMs = 0,
  sourceUrl: propsSourceUrl,
  volume = 1.0,
  volumeKeyframes,
  onVolumeKeyframesChange,
  onDirectSpanChange,
  onDirectDragSpanChange,
  onDirectSpanPreview,
  getVisualSnapSpan,
  getVisualResizeSnapSpan,
  onDirectResizeStart,
  onDirectResizeEnd,
  zoomRegions = [],
  zoomBoundaryRegions,
  associatedAudio,
  isAudioSelected = false,
  onSelectAudio,
}: ItemProps) {
  const { valueToPixels } = useTimelineContext();
  const pxPerMs = valueToPixels(1);
  const snapThresholdMs = 8 / Math.max(pxPerMs, 0.0001);
  const baseWidthPx = (span.end - span.start) * pxPerMs;
  const visualSnap = useTimelineVisualSnap();
  const isZoom = variant === 'zoom';
  const isTrim = variant === 'trim';
  const isVideo = variant === 'video';
  const isAudio = variant === 'audio';
  const isAnnotation = variant === 'annotation';
  const canTimelineDirectDrag = isAudio || isAnnotation;
  const canTimelineDirectResize = isTrim || isAudio || isAnnotation;
  const dynamicResizeHandleWidth = isZoom || isTrim
    ? 5
    : 5;

  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle, transform } = useItem({
    id,
    span,
    // dnd-timeline checks half of this value against the outer item edge.
    // 18px gives each side a 9px hit radius, covering the 5px handle plus
    // the 3px visual inset from `width: calc(100% - 3px)`.
    resizeHandleWidth: TIMELINE_RESIZE_HIT_AREA_PX,
    data: { rowId, variant },
  });

  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const contentNodeRef = React.useRef<HTMLDivElement | null>(null);
  const handleNodeRef = React.useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    nodeRef.current = node;
  }, [setNodeRef]);

  const isResizingLeft = React.useRef(false);
  const isResizingRight = React.useRef(false);
  const directResizeSpanRef = React.useRef<Span | null>(null);
  const directDragSpanRef = React.useRef<Span | null>(null);

  // 精确计算拖拽时容器左边缘的物理位移量
  const baseLeftPx = span.start * pxPerMs;
  const currentLeftPx = (parseFloat((itemStyle.left as string) || "0") || 0) + (transform?.x || 0);
  const dragDeltaX = currentLeftPx - baseLeftPx;

  const svgOffset = isResizingLeft.current ? -dragDeltaX : 0;
  const sourceUrl = isVideo ? propsSourceUrl : (associatedAudio?.sourceUrl || propsSourceUrl);

  const effTotalDuration = audioPeaksDurationMs || totalDurationMs || Math.max(1, sourceEndMs - sourceStartMs);

  // 提取高达 8000 个采样点，作为回退的高精度波形
  const { peaks: hookPeaks, durationMs: hookDurationMs } = useAudioWaveform(sourceUrl || null, isAudio, 8000);
  const activePeaks = (audioPeaks && audioPeaks.length > 0) ? audioPeaks : hookPeaks;
  const trueTotalDurMs = (activePeaks === hookPeaks && hookDurationMs > 0) ? hookDurationMs : effTotalDuration;

  const snappedItemStyle = React.useMemo(() => {
    if (
      !transform ||
      visualSnap.activeItemId !== id ||
      Math.abs(visualSnap.offsetPx) <= 0.5 ||
      isResizingLeft.current ||
      isResizingRight.current
    ) {
      return itemStyle;
    }

    return {
      ...itemStyle,
      transform: CSS.Translate.toString({
        ...transform,
        x: transform.x + visualSnap.offsetPx,
      }),
    };
  }, [id, itemStyle, transform, visualSnap.activeItemId, visualSnap.offsetPx]);

  const handleDirectResizePointerDown = React.useCallback((direction: 'start' | 'end') => (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onDirectSpanChange || !canTimelineDirectResize) return;
    const node = nodeRef.current;
    const parentNode = node?.parentElement;
    if (!node || !parentNode) return;

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    onSelect?.();
    onDirectResizeStart?.();

    const startClientX = event.clientX;
    const initialSpan = { ...span };
    const parentRect = parentNode.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const initialLeftPx = nodeRect.left - parentRect.left;
    const initialWidthPx = nodeRect.width;
    const initialRightPx = initialLeftPx + initialWidthPx;
    const minDurationMs = 1;
    const minWidthPx = Math.max(1, minDurationMs * pxPerMs);
    const previousOpacity = node.style.opacity;
    const resizeCommitThresholdPx = 8;
    let hasMeaningfulResize = false;
    let ghost: HTMLElement | null = null;
    directResizeSpanRef.current = initialSpan;

    const ensureGhost = () => {
      if (ghost) return ghost;

      ghost = node.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('id');
      ghost.style.position = 'absolute';
      ghost.style.top = node.style.top || '0px';
      ghost.style.left = `${initialLeftPx}px`;
      ghost.style.right = 'auto';
      ghost.style.width = `${initialWidthPx}px`;
      ghost.style.height = `${nodeRect.height}px`;
      ghost.style.zIndex = '999';
      ghost.style.pointerEvents = 'none';
      ghost.style.transition = 'none';
      ghost.style.transform = 'none';
      ghost.setAttribute('data-direct-resize-ghost', 'true');

      parentNode.appendChild(ghost);
      node.style.opacity = '0';
      return ghost;
    };

    const applyPreview = (leftPx: number, widthPx: number) => {
      const activeGhost = ensureGhost();
      activeGhost.style.left = `${leftPx}px`;
      activeGhost.style.width = `${widthPx}px`;
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaPx = moveEvent.clientX - startClientX;
      if (!hasMeaningfulResize && Math.abs(deltaPx) < resizeCommitThresholdPx) {
        return;
      }
      hasMeaningfulResize = true;
      const deltaMs = deltaPx / Math.max(pxPerMs, 0.0001);
      const rawSpan = direction === 'start'
        ? {
            start: Math.max(0, Math.min(initialSpan.start + deltaMs, initialSpan.end - minDurationMs)),
            end: initialSpan.end,
          }
        : {
            start: initialSpan.start,
            end: Math.max(initialSpan.start + minDurationMs, initialSpan.end + deltaMs),
          };
      const nextSpan = getVisualResizeSnapSpan?.(id, rawSpan, snapThresholdMs) ?? rawSpan;

      directResizeSpanRef.current = nextSpan;
      onDirectSpanPreview?.(id, nextSpan);

      if (direction === 'start') {
        const nextLeftPx = initialLeftPx + ((nextSpan.start - initialSpan.start) * pxPerMs);
        applyPreview(nextLeftPx, Math.max(minWidthPx, initialRightPx - nextLeftPx));
      } else {
        applyPreview(initialLeftPx, Math.max(minWidthPx, (nextSpan.end - nextSpan.start) * pxPerMs));
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();

      const blockSyntheticClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      window.addEventListener('click', blockSyntheticClick, { capture: true, once: true });

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (hasMeaningfulResize && directResizeSpanRef.current) {
        onDirectSpanChange(id, directResizeSpanRef.current);
      }
      onDirectSpanPreview?.(id, null);
      node.style.opacity = previousOpacity;
      ghost?.remove();
      directResizeSpanRef.current = null;
      isResizingLeft.current = false;
      isResizingRight.current = false;
      onDirectResizeEnd?.();
    };

    if (direction === 'start') {
      isResizingLeft.current = true;
      isResizingRight.current = false;
    } else {
      isResizingLeft.current = false;
      isResizingRight.current = true;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [canTimelineDirectResize, getVisualResizeSnapSpan, id, onDirectResizeEnd, onDirectResizeStart, onDirectSpanChange, onDirectSpanPreview, onSelect, pxPerMs, snapThresholdMs, span]);

  const handleDirectDragPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!canTimelineDirectDrag || !onDirectSpanChange || isResizingLeft.current || isResizingRight.current) {
      return;
    }

    const node = nodeRef.current;
    if (!node) return;

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    node.setPointerCapture?.(event.pointerId);
    onSelect?.();

    const startClientX = event.clientX;
    const pointerId = event.pointerId;
    const initialSpan = { ...span };
    const durationMs = initialSpan.end - initialSpan.start;
    const previousTransform = node.style.transform;
    const previousTransition = node.style.transition;
    const previousZIndex = node.style.zIndex;

    directDragSpanRef.current = initialSpan;
    node.style.transition = "none";
    node.style.zIndex = "999";

    const applyPreview = (nextSpan: Span) => {
      directDragSpanRef.current = nextSpan;
      const offsetPx = (nextSpan.start - initialSpan.start) * pxPerMs;
      node.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
      onDirectSpanPreview?.(id, nextSpan);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaMs = (moveEvent.clientX - startClientX) / Math.max(pxPerMs, 0.0001);
      const rawStart = Math.max(0, initialSpan.start + deltaMs);
      const rawSpan = { start: rawStart, end: rawStart + durationMs };
      applyPreview(getVisualSnapSpan?.(id, rawSpan, snapThresholdMs) ?? rawSpan);
    };

    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      node.releasePointerCapture?.(pointerId);

      const finalSpan = directDragSpanRef.current;
      if (commit && finalSpan) {
        (onDirectDragSpanChange ?? onDirectSpanChange)(id, finalSpan);
      }
      onDirectSpanPreview?.(id, null);
      directDragSpanRef.current = null;
      requestAnimationFrame(() => {
        node.style.transform = previousTransform;
        node.style.transition = previousTransition;
        node.style.zIndex = previousZIndex;
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      finish(true);
    };

    const handlePointerCancel = () => {
      finish(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerCancel, { once: true });
  }, [canTimelineDirectDrag, getVisualSnapSpan, id, onDirectDragSpanChange, onDirectSpanChange, onDirectSpanPreview, onSelect, pxPerMs, snapThresholdMs, span]);

  // 使用 MutationObserver 在 dnd-timeline 内部不触发 React 渲染的拖拽过程中，实时修正波形的物理偏移并设置拖拽物理墙
  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const observer = new MutationObserver(() => {
      const audioResizeBounds = resolveAudioResizeBounds({
        span,
        sourceStartMs,
        sourceTotalMs: trueTotalDurMs,
        pxPerMs,
      });
      if (isResizingLeft.current) {
        let liveLeftPx = parseFloat(node.style.left || "0") + (transform?.x || 0);

        // 物理墙限制：不能往左拖拽超过音频起始点
        if (audioResizeBounds.minAllowedLeftPx - liveLeftPx > 0.1) {
          node.style.left = `${audioResizeBounds.minAllowedLeftPx}px`;
          const maxLeftWidth = baseWidthPx + baseLeftPx - audioResizeBounds.minAllowedLeftPx;
          node.style.width = `${maxLeftWidth}px`;
          liveLeftPx = audioResizeBounds.minAllowedLeftPx;
        }

        const liveDeltaX = liveLeftPx - baseLeftPx;
        const svgElem = document.getElementById(`waveform-${id}`);
        if (svgElem) {
          svgElem.style.transform = `translateX(${-liveDeltaX}px)`;
        }
      } else if (isResizingRight.current) {
        // 物理墙限制：不能往右拖拽超过音频总时长
        if (audioResizeBounds.sourceTotalMs > 0) {
          const liveWidthPx = parseFloat(node.style.width || "0");
          if (liveWidthPx - audioResizeBounds.maxAllowedWidthPx > 0.1) {
            node.style.width = `${audioResizeBounds.maxAllowedWidthPx}px`;
          }
        }
      }
    });

    observer.observe(node, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [baseLeftPx, baseWidthPx, pxPerMs, sourceStartMs, trueTotalDurMs, id, transform?.x, span.start]);

  // 【终极清除器】由于 React virtual DOM 会忽略值未改变的内联样式 (transform: 'none')，
  // 导致 MutationObserver 私自添加的 transform 无法被 React 抹除。
  // 我们在每次 React 接管重绘时，强制清空 DOM 的 transform 属性，彻底根除波形漂移 Bug！
  React.useEffect(() => {
    const svgElem = document.getElementById(`waveform-${id}`);
    if (svgElem) {
      svgElem.style.transform = 'none';
    }
  });

  // 命题四：手风琴式子音轨折叠挂载（特化分支）
  if (isVideo && associatedAudio) {
    const associatedPeaks = audioPeaks;
    const associatedUrl = associatedAudio.sourceUrl;
    const associatedVolume = associatedAudio.volume;
    const associatedVolumeKeyframes = associatedAudio.volumeKeyframes || [];
    
    return (
      <div
      ref={handleNodeRef}
      data-timeline-item-id={id}
      style={{
          ...itemStyle, 
          height: isAudioSelected ? 110 : 92,
          marginTop: 3,
          marginBottom: 3,
          minWidth: 24 
        }}
        {...listeners}
        {...attributes}
        onPointerDownCapture={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          isResizingLeft.current = e.clientX - rect.left <= dynamicResizeHandleWidth;
          isResizingRight.current = rect.right - e.clientX <= dynamicResizeHandleWidth;
        }}
        onPointerUp={() => {
          isResizingLeft.current = false;
          isResizingRight.current = false;
        }}
      >
        <div style={itemContentStyle} className="h-full w-full">
          <div className="w-full h-full flex flex-col items-stretch relative select-none gap-1 py-1">
            
            {/* 1. 子音轨区域（手风琴上半部分，独立圆角卡片） */}
            <div 
              className={cn(
                glassStyles.glassBlue,
                "w-full overflow-hidden flex items-center justify-between flex-shrink-0 cursor-pointer relative",
                isAudioSelected && "selected"
              )}
              style={{ color: '#fff', height: isAudioSelected ? 42 : 24, margin: 0, width: 'calc(100% - 3px)' }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectAudio?.();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {/* Waveform 背景图层 */}
              {associatedUrl && (
                <WaveformOverlay 
                  id={`${id}-subaudio`} 
                  url={associatedUrl} 
                  isReal={true} 
                  sourceStartMs={sourceStartMs} 
                  effTotalDuration={effTotalDuration} 
                  svgOffset={svgOffset} 
                  peaks={associatedPeaks} 
                  strokeColor="rgba(165, 180, 252, 0.85)"
                />
              )}

              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: isAudioSelected ? undefined : 0,
                  height: isAudioSelected ? '50%' : undefined,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: '6px',
                  paddingLeft: '6px',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
                className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none"
              >
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap truncate max-w-[120px] leading-none mt-[1px]">
                  {associatedAudio.name || "原声音频"}
                </span>
              </div>
              
              {/* 只有选中展开时才呈现音量包络调节线，占满下半部 */}
              {isAudioSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-1/2 z-30 pointer-events-auto">
                  <VolumeEnvelope 
                    keyframes={associatedVolumeKeyframes} 
                    baseVolume={associatedVolume} 
                    onChange={(newKeyframes) => onVolumeKeyframesChange?.(newKeyframes)} 
                  />
                </div>
              )}
            </div>

            {/* 2. 视频轨道区域（手风琴下半部分，独立圆角卡片） */}
            <div
              className={cn(
                glassStyles.glassVideo,
                "w-full overflow-hidden flex items-center justify-between cursor-grab active:cursor-grabbing relative transition-colors duration-150 flex-shrink-0",
                isSelected && "selected"
              )}
              style={{ color: '#fff', margin: 0, height: 56, width: 'calc(100% - 3px)' }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect?.();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {/* VideoThumbnails 背景图层 */}
              {sourceUrl && (
                <VideoThumbnails 
                  id={id} 
                  src={sourceUrl} 
                  sourceStartMs={sourceStartMs} 
                  effTotalDuration={effTotalDuration} 
                  svgOffset={svgOffset} 
                  pxPerMs={pxPerMs} 
                  zoomRegions={zoomRegions} 
                  boundaryZoomRegions={zoomBoundaryRegions}
                  clipStartMs={span.start}
                />
              )}

              {/* Removed Resize Handles for Video Track to prevent click interception at the edges */}

              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  paddingTop: '6px',
                  paddingLeft: '6px',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
                className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none"
              >
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block truncate leading-none mt-[1px]">
                  {children}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  const glassClass = isAudio
    ? glassStyles.glassBlue
    : isZoom
    ? glassStyles.glassPurple 
    : isVideo
    ? glassStyles.glassVideo
    : isTrim 
    ? glassStyles.glassRed 
    : glassStyles.glassYellow;

  return (
    <div
      ref={handleNodeRef}
      data-timeline-item-id={id}
      style={{
        ...snappedItemStyle,
        minWidth: 24,
        ...(isNestedTrim ? {
          top: 'auto',
          bottom: 0,
          height: 18,
          zIndex: 30,
          marginTop: 'auto',
          marginBottom: 0
        } : {})
      }}
      {...(canTimelineDirectDrag ? {} : listeners)}
      {...attributes}
        onPointerDownCapture={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-timeline-resize-handle="true"]')) {
            return;
          }
          isResizingLeft.current = false;
          isResizingRight.current = false;
          if (canTimelineDirectDrag) {
            handleDirectDragPointerDown(e);
            return;
          }
          onSelect?.();
        }}
      className="group"
      onPointerUp={() => {
        isResizingLeft.current = false;
        isResizingRight.current = false;
      }}
    >
      <div style={itemContentStyle}>
        <div
          ref={contentNodeRef}
          className={cn(
            glassClass,
            "w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative",
            isSelected && "selected"
          )}
          style={{ 
            height: isNestedTrim ? '100%' : (isVideo ? '77px' : 'calc(100% - 6px)'), 
            margin: isNestedTrim ? 0 : '3px 0', 
            color: '#fff', 
            width: 'calc(100% - 3px)' 
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          {/* Left Resize Handle */}
          <div
            data-timeline-resize-handle="true"
            className={cn(glassStyles.zoomEndCap, glassStyles.left, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: `${dynamicResizeHandleWidth}px` }}
            onPointerDown={canTimelineDirectResize ? handleDirectResizePointerDown('start') : undefined}
            title="Resize left"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Right Resize Handle */}
          <div
            data-timeline-resize-handle="true"
            className={cn(glassStyles.zoomEndCap, glassStyles.right, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: `${dynamicResizeHandleWidth}px` }}
            onPointerDown={canTimelineDirectResize ? handleDirectResizePointerDown('end') : undefined}
            title="Resize right"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Waveform 背景图层（与标题层平铺兄弟关系） */}
          {isVideo && sourceUrl && (
            <VideoThumbnails 
              id={id} 
              src={sourceUrl} 
              sourceStartMs={sourceStartMs} 
              effTotalDuration={trueTotalDurMs} 
              svgOffset={svgOffset} 
              pxPerMs={pxPerMs} 
              zoomRegions={zoomRegions} 
              boundaryZoomRegions={zoomBoundaryRegions}
              clipStartMs={span.start}
            />
          )}
          {isAudio && sourceUrl && (
            <WaveformOverlay id={id} url={sourceUrl} isReal={true} sourceStartMs={sourceStartMs} effTotalDuration={trueTotalDurMs} svgOffset={svgOffset} peaks={activePeaks} />
          )}

          {/* 统一规范的标题排版：完全处于左上角，顶对齐，上边距与左边距均为 6px。无任何图标 */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: isAudio ? undefined : 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'flex-start', // 改为顶对齐
              paddingTop: '6px', // 统一 6px
              paddingLeft: '6px', // 统一 6px
              pointerEvents: 'none',
              zIndex: 20
            }}
            className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none"
          >
            <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block truncate leading-none mt-[1px]">
              {isZoom && zoomDepth ? ZOOM_LABELS[zoomDepth] : children}
            </span>
          </div>

          {/* 音量包络线交互层（绝对定位，占满下半部） */}
          {isAudio && isSelected && (
            <div className="absolute bottom-0 left-0 right-0 h-1/2 z-30 pointer-events-auto">
              <VolumeEnvelope 
                keyframes={volumeKeyframes} 
                baseVolume={volume} 
                onChange={(newKeyframes) => onVolumeKeyframesChange?.(newKeyframes)} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ItemComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.span.start === next.span.start &&
    prev.span.end === next.span.end &&
    prev.isSelected === next.isSelected &&
    prev.isAudioSelected === next.isAudioSelected &&
    prev.zoomDepth === next.zoomDepth &&
    prev.variant === next.variant &&
    prev.children === next.children &&
    prev.sourceStartMs === next.sourceStartMs &&
    prev.sourceEndMs === next.sourceEndMs &&
    prev.totalDurationMs === next.totalDurationMs &&
    prev.sourceUrl === next.sourceUrl &&
    prev.volume === next.volume &&
    prev.volumeKeyframes === next.volumeKeyframes &&
    prev.audioPeaks === next.audioPeaks &&
    prev.zoomRegions === next.zoomRegions &&
    prev.zoomBoundaryRegions === next.zoomBoundaryRegions &&
    prev.onDirectSpanChange === next.onDirectSpanChange &&
    prev.onDirectDragSpanChange === next.onDirectDragSpanChange &&
    prev.onDirectSpanPreview === next.onDirectSpanPreview &&
    prev.getVisualSnapSpan === next.getVisualSnapSpan &&
    prev.getVisualResizeSnapSpan === next.getVisualResizeSnapSpan &&
    prev.onDirectResizeStart === next.onDirectResizeStart &&
    prev.onDirectResizeEnd === next.onDirectResizeEnd
  );
});
