import { useRow, useTimelineContext } from "dnd-timeline";
import type { RowDefinition } from "dnd-timeline";
import { Video, ZoomIn, Scissors, MessageSquare } from "lucide-react";

interface RowProps extends RowDefinition {
  children: React.ReactNode;
}

const ROW_METADATA: Record<string, { icon: React.ReactNode; label: string }> = {
  "row-video": { icon: <Video className="w-3.5 h-3.5 text-[#34B27B]" />, label: "Video" },
  "row-zoom": { icon: <ZoomIn className="w-3.5 h-3.5 text-[#7c3aed]" />, label: "Focus" },
  "row-trim": { icon: <Scissors className="w-3.5 h-3.5 text-[#ef4444]" />, label: "Trim" },
  "row-annotation": { icon: <MessageSquare className="w-3.5 h-3.5 text-[#B4A046]" />, label: "Text" },
};

export default function Row({ id, children }: RowProps) {
  const { setNodeRef, rowWrapperStyle, rowStyle, setSidebarRef, rowSidebarStyle } = useRow({ id });
  const { sidebarWidth } = useTimelineContext();

  const meta = ROW_METADATA[id] || { icon: null, label: "Track" };

  return (
    <div
      className="border-b border-white/5 bg-[#09090b] relative group/row hover:bg-white/[0.01] transition-colors"
      style={{ ...rowWrapperStyle, minHeight: 48, marginBottom: 4 }}
    >
      {/* Sidebar Track Control Header (Jitter layout) */}
      <div 
        ref={setSidebarRef}
        className="absolute left-0 top-0 bottom-0 border-r border-white/5 bg-[#0c0c0e] flex items-center px-3 gap-2 select-none z-10"
        style={{ ...rowSidebarStyle, width: sidebarWidth }}
      >
        <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center opacity-70 group-hover/row:opacity-100 transition-opacity">
          {meta.icon}
        </div>
        <span className="text-[11px] font-medium text-slate-400 group-hover/row:text-slate-200 transition-colors uppercase tracking-wider">
          {meta.label}
        </span>
      </div>

      {/* Row Timeline Items Area */}
      <div ref={setNodeRef} style={rowStyle} className="h-full">
        {children}
      </div>
    </div>
  );
}
