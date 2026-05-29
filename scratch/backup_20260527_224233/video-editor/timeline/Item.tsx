import React, { memo } from 'react';
import { useItem } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { ZoomIn, Scissors, MessageSquare } from "lucide-react";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
  id: string;
  rowId: string;
  span: Span;
  isSelected: boolean;
  onSelect?: () => void;
  children?: React.ReactNode;
  zoomDepth?: number;
  variant?: 'zoom' | 'trim' | 'annotation' | 'video';
  audioPeaks?: number[];
  sourceStartMs?: number;
  sourceEndMs?: number;
  totalDurationMs?: number;
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
  rowId, 
  isSelected = false, 
  children,
  zoomDepth = 1,
  variant = 'zoom',
  audioPeaks,
  sourceStartMs = 0,
  sourceEndMs = 0,
  totalDurationMs = 0,
}: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
    id,
    span,
    data: { rowId },
  });

  const isZoom = variant === 'zoom';
  const isTrim = variant === 'trim';
  const isVideo = variant === 'video';
  
  const glassClass = (isZoom || isVideo)
    ? glassStyles.glassPurple 
    : isTrim 
    ? glassStyles.glassRed 
    : glassStyles.glassYellow;
    
  const endCapColor = (isZoom || isVideo)
    ? 'rgba(124, 58, 237, 0.4)' 
    : isTrim 
    ? 'rgba(239, 68, 68, 0.4)' 
    : 'rgba(180, 160, 70, 0.4)';

  const widthPercent = totalDurationMs > 0 && sourceEndMs > sourceStartMs 
    ? (totalDurationMs / (sourceEndMs - sourceStartMs)) * 100 
    : 100;
  
  const leftPercent = totalDurationMs > 0 && sourceEndMs > sourceStartMs 
    ? -(sourceStartMs / (sourceEndMs - sourceStartMs)) * 100 
    : 0;

  const buildWaveformPath = (peaks: number[]) => {
    if (!peaks || peaks.length === 0) return '';
    const points = peaks.map((p, i) => {
      const x = (i / (peaks.length - 1)) * 1000;
      const y = (1 - p) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    // Complete the path at the bottom
    points.push(`L 1000 100 L 0 100 Z`);
    return points.join(' ');
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...itemStyle, minWidth: 24 }}
      {...listeners}
      {...attributes}
      onPointerDownCapture={() => onSelect?.()}
      className="group"
    >
      <div style={itemContentStyle}>
        <div
          className={cn(
            glassClass,
            "w-full h-full overflow-hidden flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing relative",
            isSelected && glassStyles.selected
          )}
          style={{ height: 36, color: '#fff' }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          {/* Left Resize Handle (Jitter style circular/rounded bar) */}
          <div
            className={cn(glassStyles.zoomEndCap, glassStyles.left, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10, background: endCapColor }}
            title="Resize left"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Right Resize Handle (Jitter style circular/rounded bar) */}
          <div
            className={cn(glassStyles.zoomEndCap, glassStyles.right, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10, background: endCapColor }}
            title="Resize right"
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center gap-1.5 text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none px-3 w-full h-full">
            {isVideo ? (
              audioPeaks && audioPeaks.length > 0 && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 mix-blend-screen">
                  <svg 
                    preserveAspectRatio="none" 
                    viewBox={`0 0 1000 100`} 
                    style={{
                      position: 'absolute',
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      height: '100%',
                      transformOrigin: 'left',
                    }}
                  >
                    <path d={buildWaveformPath(audioPeaks)} fill="currentColor" opacity="0.6" />
                  </svg>
                </div>
              )
            ) : isZoom ? (
              <>
                <ZoomIn className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold tracking-tight">
                  {ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
                </span>
              </>
            ) : isTrim ? (
              <>
                <Scissors className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold tracking-tight">
                  Trim
                </span>
              </>
            ) : (
              <>
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold tracking-tight">
                  {children}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Item = memo(ItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.span.start === nextProps.span.start &&
    prevProps.span.end === nextProps.span.end &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.zoomDepth === nextProps.zoomDepth &&
    prevProps.variant === nextProps.variant &&
    prevProps.children === nextProps.children
  );
});

export default Item;