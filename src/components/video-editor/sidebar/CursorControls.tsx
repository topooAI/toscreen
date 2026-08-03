import { useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
    CURSOR_CUSTOMIZABLE_STATES,
    type CursorCustomImageMap,
    type CursorCustomState,
    type CursorStylePreset,
} from "../types";
import {
    CURSOR_STYLE_OPTIONS,
    cursorElementMarkup,
    type CursorVisualType,
} from "../videoPlayback/cursorVisuals";
import { ScrubbableNumberInput } from "./ScrubbableNumberInput";

interface CursorControlsProps {
    cursorSize?: number;
    onCursorSizeChange?: (size: number) => void;
    cursorSmoothing?: boolean;
    onCursorSmoothingChange?: (smooth: boolean) => void;
    showVectorCursor?: boolean;
    onShowVectorCursorChange?: (show: boolean) => void;
    cursorStyle?: CursorStylePreset;
    onCursorStyleChange?: (style: CursorStylePreset) => void;
    cursorCustomImages?: CursorCustomImageMap;
    onCursorCustomImagesChange?: (images: CursorCustomImageMap) => void;
    cursorOffset?: number;
    onCursorOffsetChange?: (offset: number) => void;
}

const PACK_PREVIEW_STATES: readonly CursorVisualType[] = ['default', 'pointer', 'text'];

function stateLabel(state: CursorCustomState): string {
    return state.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

export function CursorControls({
    cursorSize = 1.5,
    onCursorSizeChange,
    cursorSmoothing = true,
    onCursorSmoothingChange,
    showVectorCursor = true,
    onShowVectorCursorChange,
    cursorStyle,
    onCursorStyleChange,
    cursorCustomImages = {},
    onCursorCustomImagesChange,
    cursorOffset = 0,
    onCursorOffsetChange,
}: CursorControlsProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [customTarget, setCustomTarget] = useState<CursorCustomState>('default');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedStyle = cursorStyle ?? (showVectorCursor ? 'toscreen' : 'system');
    const isEnhancedStyle = selectedStyle !== 'system';
    const selectedOption = CURSOR_STYLE_OPTIONS.find((style) => style.id === selectedStyle);
    const selectedLabel = selectedStyle === 'custom' ? 'Custom Pack' : selectedOption?.label ?? 'ToScreen';
    const customEntries = Object.entries(cursorCustomImages) as Array<[CursorCustomState, string]>;

    const selectStyle = (style: CursorStylePreset) => {
        onCursorStyleChange?.(style);
        onShowVectorCursorChange?.(style !== 'system');
    };

    const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        const validTypes = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid cursor image', { description: 'Use a PNG, SVG, WebP, JPG, or JPEG file.' });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Cursor image is too large', { description: 'Use an image smaller than 2 MB.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const image = typeof reader.result === 'string' ? reader.result : null;
            if (!image) return;
            onCursorCustomImagesChange?.({ ...cursorCustomImages, [customTarget]: image });
            selectStyle('custom');
            toast.success(`${stateLabel(customTarget)} cursor uploaded`);
        };
        reader.onerror = () => toast.error('Failed to read cursor image');
        reader.readAsDataURL(file);
    };

    const removeCustomState = (state: CursorCustomState, event: MouseEvent) => {
        event.stopPropagation();
        const nextImages = { ...cursorCustomImages };
        delete nextImages[state];
        onCursorCustomImagesChange?.(nextImages);
        if (selectedStyle === 'custom' && Object.keys(nextImages).length === 0) selectStyle('toscreen');
    };

    const cursorPreview = (
        type: CursorVisualType,
        style: CursorStylePreset,
        customImages: CursorCustomImageMap = {},
        scale = 0.34,
    ) => (
        <span className="relative block h-5 w-5 shrink-0 overflow-visible" aria-hidden="true">
            <span
                className="absolute left-0 top-0 block h-14 w-14 origin-top-left"
                style={{ transform: `scale(${style === 'system' ? scale * 0.78 : scale})` }}
                dangerouslySetInnerHTML={{ __html: cursorElementMarkup(type, style, customImages) }}
            />
        </span>
    );

    const packPreview = (style: CursorStylePreset, customImages: CursorCustomImageMap = {}) => (
        <span className="flex h-6 items-center -space-x-1" aria-hidden="true">
            {PACK_PREVIEW_STATES.map((type) => (
                <span key={type} className="rounded-[3px] bg-[var(--ui-control)] p-0.5">
                    {cursorPreview(type, style, customImages, 0.3)}
                </span>
            ))}
        </span>
    );

    return (
        <div className="space-y-2">
            <div className="space-y-2">
                <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Cursor Style</div>
                <button
                    type="button"
                    onClick={() => setPickerOpen((open) => !open)}
                    className="flex h-7 w-full items-center gap-2 rounded-[5px] bg-[var(--ui-control)] px-2 text-left outline-none transition-colors hover:bg-[var(--ui-control-hover)] focus-visible:ring-1 focus-visible:ring-[#0D99FF]"
                    aria-expanded={pickerOpen}
                >
                    {packPreview(selectedStyle, cursorCustomImages)}
                    <span className="min-w-0 flex-1 text-[12px] font-medium text-[var(--ui-text-secondary)]">{selectedLabel}</span>
                    <ChevronDown className={`h-3 w-3 text-[var(--ui-text-tertiary)] transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {pickerOpen && (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            {CURSOR_STYLE_OPTIONS.map((style) => {
                                const selected = selectedStyle === style.id;
                                return (
                                    <button
                                        key={style.id}
                                        type="button"
                                        onClick={() => selectStyle(style.id)}
                                        className={`flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[5px] border border-transparent outline-none transition-colors ${
                                            selected
                                                ? 'bg-[#0D99FF]/8 ring-1 ring-[#0D99FF]'
                                                : 'bg-[var(--ui-control)] hover:bg-[var(--ui-control-hover)]'
                                        }`}
                                        aria-pressed={selected}
                                        aria-label={`${style.label} cursor style pack`}
                                        title={style.label}
                                    >
                                        {packPreview(style.id)}
                                        <span className="max-w-full truncate px-1 text-[11px] font-medium text-[var(--ui-text-secondary)]">{style.label}</span>
                                    </button>
                                );
                            })}

                            {customEntries.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => selectStyle('custom')}
                                    className={`flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[5px] border border-transparent outline-none transition-colors ${
                                        selectedStyle === 'custom'
                                            ? 'bg-[#0D99FF]/8 ring-1 ring-[#0D99FF]'
                                            : 'bg-[var(--ui-control)] hover:bg-[var(--ui-control-hover)]'
                                    }`}
                                    aria-pressed={selectedStyle === 'custom'}
                                    aria-label="Custom cursor style pack"
                                >
                                    {packPreview('custom', cursorCustomImages)}
                                    <span className="text-[11px] font-medium text-[var(--ui-text-secondary)]">Custom</span>
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-[1fr_auto] gap-2">
                            <select
                                value={customTarget}
                                onChange={(event) => setCustomTarget(event.target.value as CursorCustomState)}
                                className="h-7 min-w-0 rounded-[5px] border-0 bg-[var(--ui-control)] px-2 text-[11px] text-[var(--ui-text-secondary)] outline-none"
                                aria-label="Custom cursor state"
                            >
                                {CURSOR_CUSTOMIZABLE_STATES.map((state) => (
                                    <option key={state} value={state}>{stateLabel(state)}</option>
                                ))}
                            </select>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".png,.svg,.webp,.jpg,.jpeg,image/png,image/svg+xml,image/webp,image/jpeg"
                                onChange={handleUpload}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-7 gap-1.5 rounded-[5px] border-0 bg-[var(--ui-control)] px-2.5 text-[11px] text-[var(--ui-text-secondary)] shadow-none hover:bg-[var(--ui-control-hover)] [&_svg]:size-3"
                            >
                                <Upload />
                                Upload
                            </Button>
                        </div>

                        {customEntries.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5">
                                {customEntries.map(([state, image]) => (
                                    <div key={state} className="group relative flex h-11 min-w-0 items-center gap-1 rounded-[4px] bg-[var(--ui-control)] px-1.5">
                                        {cursorPreview(state, 'custom', { [state]: image }, 0.28)}
                                        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--ui-text-secondary)]">{stateLabel(state)}</span>
                                        <button
                                            type="button"
                                            onClick={(event) => removeCustomState(state, event)}
                                            className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                            aria-label={`Remove ${stateLabel(state)} cursor`}
                                        >
                                            <X className="h-2 w-2" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex min-h-8 items-center justify-between">
                <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Smooth Movement</div>
                <Switch
                    switchSize="sm"
                    checked={cursorSmoothing}
                    onCheckedChange={onCursorSmoothingChange}
                    className="data-[state=checked]:bg-[#0D99FF]"
                    disabled={!isEnhancedStyle}
                />
            </div>

            <div className="grid grid-cols-[1fr_84px] items-center gap-3">
                <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Cursor Size</div>
                <ScrubbableNumberInput
                    value={cursorSize}
                    onValueChange={onCursorSizeChange}
                    min={0.5}
                    max={5.0}
                    step={0.1}
                    disabled={!isEnhancedStyle}
                    unit="×"
                    dragPixelsPerStep={8}
                />
            </div>

            <div className="grid grid-cols-[1fr_84px] items-center gap-3">
                <div className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Time Offset</div>
                <ScrubbableNumberInput
                    value={cursorOffset}
                    onValueChange={onCursorOffsetChange}
                    min={-1000}
                    max={1000}
                    step={10}
                    unit="ms"
                    dragPixelsPerStep={6}
                />
            </div>
        </div>
    );
}
