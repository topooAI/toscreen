import React from 'react';
import { useItem, useTimelineContext } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { ZoomIn, Scissors, MessageSquare, Music, Film } from "lucide-react";
import glassStyles from "./ItemGlass.module.css";
import VolumeEnvelope from './VolumeEnvelope';
import { VolumeKeyframe, AudioRegion } from '../types';
import { useAudioWaveform } from "../hooks/useAudioWaveform";


interface WaveformOverlayProps { 
  id: string; 
  url?: string; 
  isReal?: boolean; 
  sourceStartMs: number; 
  clipDurationMs: number; 
  effTotalDuration: number; 
  svgOffset?: number; 
  peaks?: number[]; 
  strokeColor?: string 
}

function WaveformOverlay({ id, url, isReal = false, sourceStartMs, clipDurationMs, effTotalDuration, svgOffset = 0, peaks: propPeaks, strokeColor }: WaveformOverlayProps) {
  const isAudio = isReal;
  const sourceUrl = url;
  const { peaks: hookPeaks } = useAudioWaveform(sourceUrl || null, isAudio, 8000);
  const activePeaks = (propPeaks && propPeaks.length > 0) ? propPeaks : hookPeaks;

  const { valueToPixels } = useTimelineContext();
  const pxPerMs = valueToPixels(1);
  const svgAbsoluteWidth = Math.max(1, effTotalDuration * pxPerMs);
  const svgAbsoluteLeft = -sourceStartMs * pxPerMs;

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
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
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

function ItemComponent({ 
  id, 
  span, 
  isSelected = false, 
  onSelect,
  children,
  zoomDepth = 1,
  variant = 'zoom',
  audioPeaks,
  audioPeaksDurationMs,
  sourceStartMs = 0,
  sourceEndMs = 0,
  totalDurationMs = 0,
  sourceUrl: propsSourceUrl,
  volume = 1.0,
  volumeKeyframes,
  onVolumeKeyframesChange,
  associatedAudio,
  isAudioSelected = false,
  onSelectAudio,
}: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle, transform } = useItem({
    id,
    span,
  });

  const { valueToPixels } = useTimelineContext();

  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const handleNodeRef = React.useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    nodeRef.current = node;
  }, [setNodeRef]);

  const isResizingLeft = React.useRef(false);
  const isResizingRight = React.useRef(false);

  const pxPerMs = valueToPixels(1);

  const isZoom = variant === 'zoom';
  const isTrim = variant === 'trim';
  const isVideo = variant === 'video';
  const isAudio = variant === 'audio';

  // 精确计算拖拽时容器左边缘的物理位移量
  const baseLeftPx = span.start * pxPerMs;
  const currentLeftPx = (parseFloat((itemStyle.left as string) || "0") || 0) + (transform?.x || 0);
  const dragDeltaX = currentLeftPx - baseLeftPx;

  const svgOffset = isResizingLeft.current ? -dragDeltaX : 0;
  const baseWidthPx = (span.end - span.start) * pxPerMs;
  const sourceUrl = associatedAudio?.sourceUrl || propsSourceUrl;

  const effTotalDuration = audioPeaksDurationMs || totalDurationMs || Math.max(1, sourceEndMs - sourceStartMs);

  // 提取高达 8000 个采样点，作为回退的高精度波形
  const { peaks: hookPeaks, durationMs: hookDurationMs } = useAudioWaveform(sourceUrl || null, isAudio, 8000);
  const activePeaks = (audioPeaks && audioPeaks.length > 0) ? audioPeaks : hookPeaks;
  const trueTotalDurMs = (activePeaks === hookPeaks && hookDurationMs > 0) ? hookDurationMs : effTotalDuration;

  // 使用 MutationObserver 在 dnd-timeline 内部不触发 React 渲染的拖拽过程中，实时修正波形的物理偏移并设置拖拽物理墙
  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const observer = new MutationObserver(() => {
      if (isResizingLeft.current) {
        let liveLeftPx = parseFloat(node.style.left || "0") + (transform?.x || 0);
        const minAllowedLeftPx = (span.start - sourceStartMs) * pxPerMs;
        
        // 物理墙限制：不能往左拖拽超过音频起始点
        if (minAllowedLeftPx - liveLeftPx > 0.1) {
          node.style.left = `${minAllowedLeftPx}px`;
          const maxLeftWidth = baseWidthPx + baseLeftPx - minAllowedLeftPx;
          node.style.width = `${maxLeftWidth}px`;
          liveLeftPx = minAllowedLeftPx;
        }

        const liveDeltaX = liveLeftPx - baseLeftPx;
        const svgElem = document.getElementById(`waveform-${id}`);
        if (svgElem) {
          svgElem.style.transform = `translateX(${-liveDeltaX}px)`;
        }
      } else if (isResizingRight.current) {
        // 物理墙限制：不能往右拖拽超过音频总时长
        if (trueTotalDurMs > 0) {
          const maxAllowedWidthPx = (trueTotalDurMs - sourceStartMs) * pxPerMs;
          const liveWidthPx = parseFloat(node.style.width || "0");
          if (liveWidthPx - maxAllowedWidthPx > 0.1) {
            node.style.width = `${maxAllowedWidthPx}px`;
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
        style={{ 
          ...itemStyle, 
          height: isAudioSelected ? 96 : 78,
          marginTop: 3,
          marginBottom: 3,
          minWidth: 24 
        }}
        {...listeners}
        {...attributes}
        onPointerDownCapture={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          isResizingLeft.current = e.clientX - rect.left < 20;
          isResizingRight.current = rect.right - e.clientX < 20;
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
                "w-full overflow-hidden flex items-center justify-between flex-shrink-0 cursor-pointer relative rounded-lg",
                isAudioSelected && "selected"
              )}
              style={{ color: '#fff', height: isAudioSelected ? 42 : 24, margin: 0 }}
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
                  clipDurationMs={sourceEndMs - sourceStartMs}
                  effTotalDuration={effTotalDuration} 
                  svgOffset={svgOffset} 
                  peaks={associatedPeaks} 
                  strokeColor="rgba(165, 180, 252, 0.85)"
                />
              )}

              {/* 统一规范的标题排版：完全处于中心横线上方，顶对齐，上边距与左边距均为 6px */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: isAudioSelected ? undefined : 0,
                  height: isAudioSelected ? '50%' : undefined,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '8px',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
                className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none gap-1.5"
              >
                <Music className="w-3 h-3 text-blue-400 flex-shrink-0" />
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
                glassStyles.glassPurple,
                "w-full overflow-hidden flex items-center justify-between cursor-grab active:cursor-grabbing relative transition-all duration-300 ease-in-out rounded-lg flex-shrink-0"
              )}
              style={{ color: '#fff', margin: 0, height: 42 }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect?.();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {/* Left Resize Handle */}
              <div
                className={cn(glassStyles.zoomEndCap, glassStyles.left, "flex items-center justify-center")}
                style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10 }}
                title="Resize left"
              >
                <div className="w-1 h-3 bg-white/80 rounded-full shadow-sm" />
              </div>

              {/* Right Resize Handle */}
              <div
                className={cn(glassStyles.zoomEndCap, glassStyles.right, "flex items-center justify-center")}
                style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10 }}
                title="Resize right"
              >
                <div className="w-1 h-3 bg-white/80 rounded-full shadow-sm" />
              </div>

              {/* 统一规范的标题排版：完全处于中心横线上方，顶对齐，上边距与左边距均为 6px */}
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingTop: '6px',
                  paddingLeft: '8px',
                  pointerEvents: 'none',
                  zIndex: 20
                }}
                className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block truncate leading-none mt-[1px]">
                  {children}
                </span>
                {isSelected && (
                  <span className="text-[8.5px] text-white/50 whitespace-nowrap ml-auto pr-1.5">
                    原声已挂载
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  const glassClass = isAudio
    ? glassStyles.glassBlue
    : (isZoom || isVideo)
    ? glassStyles.glassPurple 
    : isTrim 
    ? glassStyles.glassRed 
    : glassStyles.glassYellow;

  const endCapColor = isAudio 
    ? '#3b82f6' 
    : (isZoom || isVideo) 
    ? '#7c3aed' 
    : isTrim 
    ? '#ef4444' 
    : '#B4A046';

  return (
    <div
      ref={handleNodeRef}
      style={{ ...itemStyle, minWidth: 24 }}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        isResizingLeft.current = e.clientX - rect.left < 20;
        isResizingRight.current = rect.right - e.clientX < 20;
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
          className={cn(
            glassClass,
            "w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative",
            isSelected && "selected"
          )}
          style={{ height: 'calc(100% - 6px)', margin: '3px 0', color: '#fff' }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          {/* Left Resize Handle (Jitter style circular/rounded bar) */}
          <div
            className={cn(glassStyles.zoomEndCap, glassStyles.left, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10 }}
            title="Resize left"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Right Resize Handle (Jitter style circular/rounded bar) */}
          <div
            className={cn(glassStyles.zoomEndCap, glassStyles.right, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10 }}
            title="Resize right"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Waveform 背景图层（与标题层平铺兄弟关系） */}
          {isVideo && sourceUrl && (
            <WaveformOverlay id={id} url={sourceUrl} isReal={false} sourceStartMs={sourceStartMs} clipDurationMs={sourceEndMs - sourceStartMs} effTotalDuration={trueTotalDurMs} svgOffset={svgOffset} peaks={[]} />
          )}
          {isAudio && sourceUrl && (
            <WaveformOverlay id={id} url={sourceUrl} isReal={true} sourceStartMs={sourceStartMs} clipDurationMs={sourceEndMs - sourceStartMs} effTotalDuration={trueTotalDurMs} svgOffset={svgOffset} peaks={activePeaks} />
          )}

          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: isAudio ? undefined : 0,
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              paddingTop: isAudio ? '6px' : 0,
              paddingLeft: '8px',
              pointerEvents: 'none',
              zIndex: 20
            }}
            className="text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none gap-1.5"
          >
            {isVideo ? (
              <>
                <Film className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block truncate leading-none mt-[1px]">
                  {children}
                </span>
              </>
            ) : isZoom ? (
              <>
                <ZoomIn className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block leading-none mt-[1px]">
                  {zoomDepth ? ZOOM_LABELS[zoomDepth] : children}
                </span>
              </>
            ) : isTrim ? (
              <>
                <Scissors className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap hidden sm:inline-block truncate leading-none mt-[1px]">
                  {children}
                </span>
              </>
            ) : isAudio ? (
              <>
                <Music className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                <span className="text-[9.5px] font-medium tracking-wide whitespace-nowrap truncate max-w-[80%] leading-none mt-[1px]">
                  {children}
                </span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-[9.5px] font-medium tracking-wide leading-none mt-[1px]">
                  {children}
                </span>
              </>
            )}
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
    prev.audioPeaks === next.audioPeaks
  );
});
