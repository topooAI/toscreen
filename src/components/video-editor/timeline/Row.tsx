import { useRow } from "dnd-timeline";
import type { RowDefinition } from "dnd-timeline";
import { Plus, GripVertical } from "lucide-react";
import React from "react";

interface RowProps extends RowDefinition {
  children: React.ReactNode;
}

const ROW_METADATA: Record<string, { label: string }> = {
  "row-video": { label: "Main Track" },
  "row-zoom": { label: "Focus" },
  "row-trim": { label: "Trim" },
  "row-annotation": { label: "Text" },
};

export default function Row({ id, children }: RowProps) {
  const { setNodeRef, rowWrapperStyle, rowStyle, setSidebarRef, rowSidebarStyle } = useRow({ id });

  const meta = ROW_METADATA[id] || { label: "Track" };

  return (
    <div
      className="border-b border-white/5 bg-[#09090b] group/row hover:bg-white/[0.01] transition-colors w-full"
      style={{ ...rowWrapperStyle, minHeight: 48, marginBottom: 4 }}
    >
      {/* Sidebar Track Control Header */}
      <div 
        ref={setSidebarRef}
        className="border-r border-white/5 bg-[#0c0c0e] flex items-center justify-between px-2 gap-1 select-none z-10 shrink-0"
        style={{ ...rowSidebarStyle, width: 140 }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
          <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 transition-colors p-0.5" title="长按拖拽排序">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="text-[12px] font-medium text-slate-300 group-hover/row:text-white transition-colors truncate tracking-wide">
            {meta.label}
          </span>
        </div>
        
        {/* Add Track Button Placeholder */}
        <button className="text-slate-500 hover:text-white hover:bg-white/10 p-1 rounded transition-colors" title="添加轨道">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Row Timeline Items Area */}
      <div 
        ref={setNodeRef} 
        style={rowStyle}
      >
        {children}
      </div>
    </div>
  );
}