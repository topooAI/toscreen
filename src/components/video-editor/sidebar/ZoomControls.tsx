

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles } from "lucide-react";
import { KeyboardShortcutsHelp } from "../KeyboardShortcutsHelp";
import type { ZoomDepth } from "../types";

interface ZoomControlsProps {
    selectedZoomDepth?: ZoomDepth | null;
    onZoomDepthChange?: (depth: ZoomDepth) => void;
    selectedZoomId?: string | null;
    onZoomDelete?: (id: string) => void;
    onAutoZoom?: () => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
    { depth: 1, label: "1.25×" },
    { depth: 2, label: "1.5×" },
    { depth: 3, label: "1.8×" },
    { depth: 4, label: "2.2×" },
    { depth: 5, label: "3.5×" },
    { depth: 6, label: "5×" },
];

export function ZoomControls({
    selectedZoomDepth,
    onZoomDepthChange,
    selectedZoomId,
    onZoomDelete,
    onAutoZoom,
}: ZoomControlsProps) {
    const zoomEnabled = Boolean(selectedZoomDepth);

    const handleDeleteClick = () => {
        if (selectedZoomId && onZoomDelete) {
            onZoomDelete(selectedZoomId);
        }
    };

    return (
        <div className="space-y-4">
            {onAutoZoom && (
                <Button
                    onClick={onAutoZoom}
                    className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 border-0 transition-all duration-200"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Generate Auto-Zoom
                    </div>
                </Button>
            )}

            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-200">Zoom Level</span>
                    <div className="flex items-center gap-3">
                        {zoomEnabled && selectedZoomDepth && (
                            <span className="text-[10px] uppercase tracking-wider font-medium text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full">
                                {ZOOM_DEPTH_OPTIONS.find(o => o.depth === selectedZoomDepth)?.label} Active
                            </span>
                        )}
                        <KeyboardShortcutsHelp />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {ZOOM_DEPTH_OPTIONS.map((option) => {
                        const isActive = selectedZoomDepth === option.depth;
                        return (
                            <Button
                                key={option.depth}
                                type="button"
                                disabled={!zoomEnabled}
                                onClick={() => onZoomDepthChange?.(option.depth)}
                                className={cn(
                                    "h-auto w-full rounded-xl border px-1 py-3 text-center shadow-sm transition-all flex flex-col items-center justify-center gap-1.5",
                                    "duration-200 ease-out",
                                    zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
                                    isActive
                                        ? "border-violet-500 bg-violet-600 text-white shadow-violet-500/20 scale-105 ring-2 ring-violet-500/20"
                                        : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200"
                                )}
                            >
                                <span className={cn("text-sm font-semibold tracking-tight")}>{option.label}</span>
                            </Button>
                        );
                    })}
                </div>

                {!zoomEnabled && (
                    <p className="text-xs text-slate-500 mt-3 text-center">Select a zoom region to adjust depth</p>
                )}

                {zoomEnabled && (
                    <Button
                        onClick={handleDeleteClick}
                        variant="destructive"
                        size="sm"
                        className="mt-4 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete Zoom Region
                    </Button>
                )}
            </div>
        </div>
    );
}
