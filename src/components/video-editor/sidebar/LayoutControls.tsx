

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

interface LayoutControlsProps {
    padding?: number;
    onPaddingChange?: (padding: number) => void;
    borderRadius?: number;
    onBorderRadiusChange?: (radius: number) => void;
    shadowIntensity?: number;
    onShadowChange?: (intensity: number) => void;
    motionBlurEnabled?: boolean;
    onMotionBlurChange?: (enabled: boolean) => void;
}

export function LayoutControls({
    padding = 50,
    onPaddingChange,
    borderRadius = 0,
    onBorderRadiusChange,
    shadowIntensity = 0,
    onShadowChange,
    motionBlurEnabled = true,
    onMotionBlurChange,
}: LayoutControlsProps) {
    return (
        <div className="space-y-4">
            {/* Motion Blur Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-xs font-medium text-slate-200">Motion Blur</div>
                <Switch
                    checked={motionBlurEnabled}
                    onCheckedChange={onMotionBlurChange}
                    className="data-[state=checked]:bg-[#34B27B]"
                />
            </div>

            <div className="space-y-3">
                {/* Padding Slider */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-200">Padding</div>
                        <span className="text-[10px] text-slate-400 font-mono">{padding}%</span>
                    </div>
                    <Slider
                        value={[padding]}
                        onValueChange={(values) => onPaddingChange?.(values[0])}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full [&_[role=slider]]:bg-[#34B27B] [&_[role=slider]]:border-[#34B27B]"
                    />
                </div>

                {/* Corner Roundness Slider */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-200">Roundness</div>
                        <span className="text-[10px] text-slate-400 font-mono">{borderRadius}px</span>
                    </div>
                    <Slider
                        value={[borderRadius]}
                        onValueChange={(values) => onBorderRadiusChange?.(values[0])}
                        min={0}
                        max={32}
                        step={1}
                        className="w-full [&_[role=slider]]:bg-[#34B27B] [&_[role=slider]]:border-[#34B27B]"
                    />
                </div>

                {/* Drop Shadow Slider */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-slate-200">Shadow</div>
                        <span className="text-[10px] text-slate-400 font-mono">{Math.round(shadowIntensity * 100)}%</span>
                    </div>
                    <Slider
                        value={[shadowIntensity]}
                        onValueChange={(values) => onShadowChange?.(values[0])}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full [&_[role=slider]]:bg-[#34B27B] [&_[role=slider]]:border-[#34B27B]"
                    />
                </div>
            </div>
        </div>
    );
}
