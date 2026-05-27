import React, { memo } from 'react';
import { useItem } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { ZoomIn, Scissors, MessageSquare } from "lucide-react";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
  id: string;
  span: Span;
  rowId: string;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  zoomDepth?: number;
  variant?: 'zoom' | 'trim' | 'annotation';
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
  onSelect, 
  zoomDepth = 1,
  variant = 'zoom',
  children
}: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
    id,
    span,
    data: { rowId },
  });

  const isZoom = variant === 'zoom';
  const isTrim = variant === 'trim';
  
  const glassClass = isZoom 
    ? glassStyles.glassPurple 
    : isTrim 
    ? glassStyles.glassRed 
    : glassStyles.glassYellow;
    
  const endCapColor = isZoom 
    ? 'rgba(124, 58, 237, 0.4)' 
    : isTrim 
    ? 'rgba(239, 68, 68, 0.4)' 
    : 'rgba(180, 160, 70, 0.4)';

  return (
    <div
      ref={setNodeRef}
      style={itemStyle}
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
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Right Resize Handle (Jitter style circular/rounded bar) */}
          <div
            className={cn(glassStyles.zoomEndCap, glassStyles.right, "flex items-center justify-center")}
            style={{ cursor: 'col-resize', pointerEvents: 'auto', width: 10, background: endCapColor }}
            title="Resize right"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="w-1 h-3 bg-white/60 rounded-full" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center gap-1.5 text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none px-3">
            {isZoom ? (
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