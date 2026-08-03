import { useRow } from "dnd-timeline";
import type { RowDefinition } from "dnd-timeline";
import { Plus } from "lucide-react";
import React from "react";
import { TIMELINE_BREATHING_GAP_PX, TIMELINE_SIDEBAR_WIDTH_PX } from "./timelineTrackOrigin";

interface RowProps extends RowDefinition {
  children: React.ReactNode;
  onAddClick?: () => void;
  height?: number;
}

const ROW_METADATA: Record<string, { label: string }> = {
  "row-video": { label: "Main Track" },
  "row-zoom": { label: "Focus" },
  "row-camera": { label: "Camera" },
  "row-trim": { label: "Trim" },
  "row-annotation": { label: "Text" },
  "row-audio": { label: "Audio" },
  "row-presentation": { label: "Presentation" },
};

export default function Row({ id, children, onAddClick, height = 48 }: RowProps) {
  const { setNodeRef, rowStyle } = useRow({ id });

  let meta = ROW_METADATA[id];
  if (!meta) {
    if (id.startsWith("row-audio-")) {
      const idx = parseInt(id.replace("row-audio-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Audio" : `Audio ${idx}` };
    } else if (id.startsWith("row-zoom-")) {
      const idx = parseInt(id.replace("row-zoom-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Focus" : `Focus ${idx}` };
    } else if (id.startsWith("row-camera-")) {
      const idx = parseInt(id.replace("row-camera-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Camera" : `Camera ${idx}` };
    } else if (id.startsWith("row-annotation-")) {
      const idx = parseInt(id.replace("row-annotation-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Text" : `Text ${idx}` };
    } else {
      meta = { label: "Track" };
    }
  }

  return (
    <div
      className="border-b border-[var(--ui-border)] bg-transparent group/row hover:bg-[var(--ui-track-hover)] transition-colors duration-150 w-full flex items-stretch relative"
      style={{ height }}
    >
      {/* Sidebar Track Control Header */}
      <div 
        className="border-r border-[var(--ui-border)] bg-[var(--ui-panel)] flex items-center justify-between px-3 gap-2 select-none z-10 shrink-0 cursor-grab active:cursor-grabbing hover:bg-[var(--ui-track-hover)] transition-colors relative"
        style={{ width: TIMELINE_SIDEBAR_WIDTH_PX }}
        title="长按拖拽排序"
      >
        <div className="flex items-center overflow-hidden flex-1">
          {id !== "row-video" && (
            <svg 
              width="10" 
              height="10" 
              viewBox="0 0 10 10" 
              className="mr-1.5 ml-1 text-white/30 flex-shrink-0"
              fill="none"
            >
              <path d="M2 0 L2 6 Q2 8 4 8 L10 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
          <span className="text-[12px] font-medium text-slate-300 group-hover/row:text-[var(--ui-text-primary)] transition-colors truncate tracking-wide">
            {meta.label}
          </span>
        </div>
        
        {onAddClick && (
          <button 
            className="text-slate-500 hover:text-[var(--ui-text-primary)] hover:bg-white/10 p-1 rounded transition-colors z-20 relative"
            title="在播放头位置添加片段"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick();
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row Timeline Items Area */}
      <div 
        data-timeline-track-area="true"
        ref={setNodeRef} 
        style={{ ...rowStyle, position: 'relative', flex: 1, height: '100%', marginLeft: TIMELINE_BREATHING_GAP_PX }}
      >
        {children}
      </div>
    </div>
  );
}
