

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { KeyboardShortcutsHelp } from "../KeyboardShortcutsHelp";
import { ZOOM_DEPTH_SCALES, type ZoomDepth } from "../types";

interface ZoomControlsProps {
    selectedZoomDepth?: ZoomDepth | null;
    onZoomDepthChange?: (depth: ZoomDepth) => void;
    selectedZoomId?: string | null;
    onZoomDelete?: (id: string) => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = (
    [1, 2, 3, 4, 5, 6] as ZoomDepth[]
).map((depth) => ({
    depth,
    label: `${ZOOM_DEPTH_SCALES[depth]}×`,
}));

export function ZoomControls({
    selectedZoomDepth,
    onZoomDepthChange,
    selectedZoomId,
    onZoomDelete,
}: ZoomControlsProps) {
    const zoomEnabled = Boolean(selectedZoomId);

    const handleDeleteClick = () => {
        if (selectedZoomId && onZoomDelete) {
            onZoomDelete(selectedZoomId);
        }
    };

    return (
        <div className="space-y-2">
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Zoom Level</span>
                    <div className="flex items-center gap-2">
                        {zoomEnabled && selectedZoomDepth && (
                            <span className="text-[11px] font-medium text-[#7C5CFC]">
                                {ZOOM_DEPTH_OPTIONS.find(o => o.depth === selectedZoomDepth)?.label}
                            </span>
                        )}
                        <KeyboardShortcutsHelp />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    {ZOOM_DEPTH_OPTIONS.map((option) => {
                        const isActive = selectedZoomDepth === option.depth;
                        return (
                            <Button
                                key={option.depth}
                                type="button"
                                disabled={!zoomEnabled}
                                onClick={() => onZoomDepthChange?.(option.depth)}
                                className={cn(
                                    "h-8 w-full rounded-[5px] border px-1 text-center shadow-none transition-colors",
                                    zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
                                    isActive
                                        ? "border-[#7C5CFC] bg-[#7C5CFC] text-white"
                                        : "border-[var(--ui-border)] bg-[var(--ui-control)] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
                                )}
                            >
                                <span className="text-[12px] font-medium">{option.label}</span>
                            </Button>
                        );
                    })}
                </div>

                {!zoomEnabled && (
                    <p className="text-[11px] text-[var(--ui-text-tertiary)] mt-2">Select a focus clip to adjust its zoom level.</p>
                )}

                {zoomEnabled && (
                    <Button
                        onClick={handleDeleteClick}
                        variant="destructive"
                        size="sm"
                        className="mt-3 w-full h-8 justify-start gap-2 rounded-[5px] bg-red-500/8 text-red-500 border border-red-500/15 hover:bg-red-500/12 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Zoom Region
                    </Button>
                )}
            </div>
        </div>
    );
}
