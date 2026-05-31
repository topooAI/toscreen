import { useRow } from "dnd-timeline";
import type { RowDefinition } from "dnd-timeline";
import { Plus } from "lucide-react";
import React from "react";

interface RowProps extends RowDefinition {
  children: React.ReactNode;
  onAddClick?: () => void;
  height?: number;
}

const ROW_METADATA: Record<string, { label: string }> = {
  "row-video": { label: "Main Track" },
  "row-zoom": { label: "Focus" },
  "row-trim": { label: "Trim" },
  "row-annotation": { label: "Text" },
  "row-audio": { label: "Audio" },
};

export default function Row({ id, children, onAddClick, height = 48 }: RowProps) {
  const { setNodeRef, rowStyle } = useRow({ id });

  let meta = ROW_METADATA[id];
  if (!meta) {
    if (id.startsWith("row-audio-")) {
      const idx = parseInt(id.replace("row-audio-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Audio" : `Audio ${idx}` };
    } else if (id.startsWith("row-annotation-")) {
      const idx = parseInt(id.replace("row-annotation-", ""), 10) + 1;
      meta = { label: idx === 1 ? "Text" : `Text ${idx}` };
    } else {
      meta = { label: "Track" };
    }
  }

  return (
    <div
      className="border-b border-white/5 bg-[#09090b] group/row hover:bg-white/[0.01] transition-all duration-300 ease-in-out w-full flex items-stretch relative overflow-hidden"
      style={{ height, marginBottom: 4 }}
    >
      {/* Sidebar Track Control Header */}
      <div 
        className="border-r border-white/5 bg-[#0c0c0e] flex items-center justify-between px-3 gap-2 select-none z-10 shrink-0 cursor-grab active:cursor-grabbing hover:bg-white/[0.03] transition-colors relative"
        style={{ width: 140 }}
        title="长按拖拽排序"
      >
        <div className="flex items-center overflow-hidden flex-1">
          <span className="text-[12px] font-medium text-slate-300 group-hover/row:text-white transition-colors truncate tracking-wide">
            {meta.label}
          </span>
        </div>
        
        {onAddClick && (
          <button 
            className="text-slate-500 hover:text-white hover:bg-white/10 p-1 rounded transition-colors z-20 relative" 
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
        ref={setNodeRef} 
        style={{ ...rowStyle, position: 'relative', flex: 1, height: '100%', marginLeft: 16 }}
      >
        {children}
      </div>
    </div>
  );
}