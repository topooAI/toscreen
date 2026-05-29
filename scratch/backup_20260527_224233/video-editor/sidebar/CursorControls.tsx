import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface CursorControlsProps {
    cursorSize?: number;
    onCursorSizeChange?: (size: number) => void;
    cursorSmoothing?: boolean;
    onCursorSmoothingChange?: (smooth: boolean) => void;
    showVectorCursor?: boolean;
    onShowVectorCursorChange?: (show: boolean) => void;
    cursorOffset?: number;
    onCursorOffsetChange?: (offset: number) => void;
}

export function CursorControls({
    cursorSize = 1.5,
    onCursorSizeChange,
    cursorSmoothing = true,
    onCursorSmoothingChange,
    showVectorCursor = true,
    onShowVectorCursorChange,
    cursorOffset = -100,
    onCursorOffsetChange,
}: CursorControlsProps) {
    return (
        <div className="space-y-5">
            {/* Premium Cursor Style Selector (Segmented Controls) */}
            <div className="space-y-2">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    Cursor Style / 光标类型
                </div>
                <div className="flex w-full p-1 rounded-xl bg-[#09090b]/80 border border-white/5 backdrop-blur-md">
                    <button
                        onClick={() => onShowVectorCursorChange?.(true)}
                        className={`flex-1 py-2 text-xs font-semibold text-center rounded-lg transition-all duration-200 ${
                            showVectorCursor
                                ? "bg-white/10 text-white shadow-lg border border-white/5 backdrop-blur-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                        }`}
                    >
                        模拟大光标
                    </button>
                    <button
                        onClick={() => onShowVectorCursorChange?.(false)}
                        className={`flex-1 py-2 text-xs font-semibold text-center rounded-lg transition-all duration-200 ${
                            !showVectorCursor
                                ? "bg-white/10 text-white shadow-lg border border-white/5 backdrop-blur-sm"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                        }`}
                    >
                        原生系统光标
                    </button>
                </div>
            </div>

            {/* Cursor Smoothing Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs font-medium text-slate-200">Smooth Movement (Catmull-Rom)</div>
                <Switch
                    checked={cursorSmoothing}
                    onCheckedChange={onCursorSmoothingChange}
                    className="data-[state=checked]:bg-[#34B27B]"
                    disabled={!showVectorCursor}
                />
            </div>

            {/* Cursor Size Slider */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-200">Cursor Size</div>
                    <span className="text-[10px] text-slate-400 font-mono">{cursorSize.toFixed(1)}x</span>
                </div>
                <Slider
                    value={[cursorSize]}
                    onValueChange={(values) => onCursorSizeChange?.(values[0])}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    disabled={!showVectorCursor}
                    className="w-full [&_[role=slider]]:bg-[#34B27B] [&_[role=slider]]:border-[#34B27B]"
                />
            </div>

            {/* Cursor Sync Offset Slider */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-200">Sync Offset / 同步微调</div>
                    <span className="text-[10px] text-slate-400 font-mono">{cursorOffset > 0 ? `+${cursorOffset}` : cursorOffset} ms</span>
                </div>
                <Slider
                    value={[cursorOffset]}
                    onValueChange={(values) => onCursorOffsetChange?.(values[0])}
                    min={-1000}
                    max={1000}
                    step={10}
                    disabled={!showVectorCursor}
                    className="w-full [&_[role=slider]]:bg-[#34B27B] [&_[role=slider]]:border-[#34B27B]"
                />
            </div>
        </div>
    );
}
