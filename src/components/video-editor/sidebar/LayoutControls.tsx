

import { ScrubbableNumberInput } from "./ScrubbableNumberInput";

interface LayoutControlsProps {
    padding?: number;
    onPaddingChange?: (padding: number) => void;
    borderRadius?: number;
    onBorderRadiusChange?: (radius: number) => void;
    shadowIntensity?: number;
    onShadowChange?: (intensity: number) => void;
}

export function LayoutControls({
    padding = 50,
    onPaddingChange,
    borderRadius = 0,
    onBorderRadiusChange,
    shadowIntensity = 0,
    onShadowChange,
}: LayoutControlsProps) {
    return (
        <div>
            <div className="space-y-2">
                {/* Padding */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-3">
                    <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Padding</div>
                    <ScrubbableNumberInput
                        value={padding}
                        onValueChange={onPaddingChange}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                    />
                </div>

                {/* Corner Roundness */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-3">
                    <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Roundness</div>
                    <ScrubbableNumberInput
                        value={borderRadius}
                        onValueChange={onBorderRadiusChange}
                        min={0}
                        max={32}
                        step={1}
                        unit="px"
                    />
                </div>

                {/* Drop Shadow */}
                <div className="grid grid-cols-[1fr_84px] items-center gap-3">
                    <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Shadow</div>
                    <ScrubbableNumberInput
                        value={Math.round(shadowIntensity * 100)}
                        onValueChange={(value) => onShadowChange?.(value / 100)}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                    />
                </div>
            </div>
        </div>
    );
}
