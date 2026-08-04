import { useState, type ReactNode } from "react";

import { Button } from "../../ui/button";
import { Switch } from "../../ui/switch";
import {
    Check,
    ChevronDown,
    Crop,
    Music2,
    Scissors,
    X,
} from "lucide-react";
import type { ZoomDepth, CropRegion, AnnotationRegion, AnnotationType, CursorCustomImageMap, CursorStylePreset, CameraMotionPreset } from "../types";
import { CropControl } from "../CropControl";
import { AnnotationSettingsPanel } from "../AnnotationSettingsPanel";
import { type AspectRatio, getAspectRatioLabel } from "../../../utils/aspectRatioUtils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

import { BackgroundControls } from "./BackgroundControls";
import { LayoutControls } from "./LayoutControls";
import { ZoomControls } from "./ZoomControls";
import { CursorControls } from "./CursorControls";
import { CameraMotionControls } from "./CameraMotionControls";
import type { PresentationEffectRegion } from "../presentation/types";
import { PresentationSettingsPanel } from "../presentation/PresentationSettingsPanel";

interface SidebarProps {
    selected: string;
    onWallpaperChange: (path: string) => void;
    selectedZoomDepth?: ZoomDepth | null;
    onZoomDepthChange?: (depth: ZoomDepth) => void;
    selectedZoomId?: string | null;
    onZoomDelete?: (id: string) => void;
    selectedCameraMotion?: CameraMotionPreset | null;
    onCameraMotionChange?: (motion: CameraMotionPreset) => void;
    selectedTrimId?: string | null;
    onTrimDelete?: (id: string) => void;
    padding?: number;
    onPaddingChange?: (padding: number) => void;
    borderRadius?: number;
    onBorderRadiusChange?: (radius: number) => void;
    shadowIntensity?: number;
    onShadowChange?: (intensity: number) => void;
    motionBlurEnabled?: boolean;
    onMotionBlurChange?: (enabled: boolean) => void;
    showBlur?: boolean;
    onBlurChange?: (showBlur: boolean) => void;
    cropRegion?: CropRegion;
    onCropChange?: (region: CropRegion) => void;
    aspectRatio: AspectRatio;
    onAspectRatioChange?: (aspectRatio: AspectRatio) => void;
    videoElement?: HTMLVideoElement | null;
    onExport?: () => void;
    selectedAnnotationId?: string | null;
    annotationRegions?: AnnotationRegion[];
    onAnnotationContentChange?: (id: string, content: string) => void;
    onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
    onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion['style']>) => void;
    onAnnotationFigureDataChange?: (id: string, figureData: any) => void;
    onAnnotationDelete?: (id: string) => void;
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
    selectedVideoId?: string | null;
    onSelectVideo?: (id: string | null) => void;
    selectedVideoSpeed?: number | null;
    onSelectedVideoSpeedChange?: (rate: number) => void;
    onSeparateAudio?: () => void;
    isOriginalAudioSelected?: boolean;
    onSelectAudio?: (id: string | null) => void;
    hasOriginalAudio?: boolean;
    selectedZoomInstant?: boolean;
    onZoomInstantChange?: (instant: boolean) => void;
    onZoomCopy?: () => void;
    onZoomPaste?: () => void;
    selectedPresentation?: PresentationEffectRegion | null;
    onPresentationChange?: (id: string, patch: Partial<PresentationEffectRegion>) => void;
    onPresentationDelete?: (id: string) => void;
    playheadMs?: number;
    mediaFeaturesOpen?: boolean;
    onOpenMediaFeatures?: () => void;
    presetControls?: ReactNode;
}

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '4:5'];

export function Sidebar(props: SidebarProps) {
    const [showCropDropdown, setShowCropDropdown] = useState(false);

    const selectedAnnotation = props.selectedAnnotationId
        ? props.annotationRegions?.find((annotation) => annotation.id === props.selectedAnnotationId)
        : null;

    const header = (title: string) => (
        <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-[var(--ui-border)]">
            <span className="text-[12px] font-semibold text-[var(--ui-text-primary)]">{title}</span>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Open music and subtitles"
                    aria-pressed={props.mediaFeaturesOpen}
                    title="Music & Subtitles"
                    onClick={props.onOpenMediaFeatures}
                    className={`h-[26px] w-[26px] rounded-[5px] border border-transparent p-0 text-[var(--ui-text-secondary)] shadow-none hover:border-[var(--ui-border)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)] ${props.mediaFeaturesOpen ? 'bg-[var(--ui-control)] text-[#0D99FF]' : ''}`}
                >
                    <Music2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                </Button>
                <Button
                type="button"
                onClick={props.onExport}
                className="h-[26px] rounded-[5px] bg-[#0D99FF] px-3 text-[12px] font-semibold text-white shadow-none hover:bg-[#0B87E3] active:bg-[#0878CC] transition-colors"
            >
                Export
            </Button></div>
        </div>
    );

    const cropOverlay = showCropDropdown && props.cropRegion && props.onCropChange ? (
        <>
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={() => setShowCropDropdown(false)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-[var(--ui-inspector-surface)] backdrop-blur-2xl rounded-lg shadow-2xl border border-[var(--ui-border)] p-6 w-[90vw] max-w-5xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <span className="text-[15px] font-semibold text-[var(--ui-text-primary)]">Crop Video</span>
                        <p className="text-[11px] text-[var(--ui-text-tertiary)] mt-1">Drag each edge to adjust the visible source area.</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCropDropdown(false)}
                        className="h-7 w-7 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
                <CropControl
                    videoElement={props.videoElement || null}
                    cropRegion={props.cropRegion}
                    onCropChange={props.onCropChange}
                    aspectRatio={props.aspectRatio}
                />
                <div className="mt-5 flex justify-end">
                    <Button
                        onClick={() => setShowCropDropdown(false)}
                        className="h-8 rounded-[5px] bg-[#0D99FF] px-4 text-[11px] text-white hover:bg-[#0B87E3]"
                    >
                        Done
                    </Button>
                </div>
            </div>
        </>
    ) : null;

    const inspector = (
        title: string,
        content: ReactNode,
        options?: { contentClassName?: string },
    ) => (
        <div className="ui-glass-surface flex-[2] min-w-0 bg-[var(--ui-inspector-surface)] border border-[var(--ui-border)] rounded-lg flex flex-col h-full overflow-hidden">
            {header(title)}
            <div className={options?.contentClassName ?? "flex-1 min-h-0 overflow-y-auto custom-scrollbar"}>
                {content}
            </div>
            {cropOverlay}
        </div>
    );

    const cursorInspector = (
        <section className="px-4 py-3 border-t border-[var(--ui-border)]">
            <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Cursor</h3>
            <CursorControls
                cursorSize={props.cursorSize}
                onCursorSizeChange={props.onCursorSizeChange}
                cursorSmoothing={props.cursorSmoothing}
                onCursorSmoothingChange={props.onCursorSmoothingChange}
                showVectorCursor={props.showVectorCursor}
                onShowVectorCursorChange={props.onShowVectorCursorChange}
                cursorStyle={props.cursorStyle}
                onCursorStyleChange={props.onCursorStyleChange}
                cursorCustomImages={props.cursorCustomImages}
                onCursorCustomImagesChange={props.onCursorCustomImagesChange}
                cursorOffset={props.cursorOffset}
                onCursorOffsetChange={props.onCursorOffsetChange}
            />
        </section>
    );
    if (props.selectedPresentation && props.onPresentationChange && props.onPresentationDelete) {
        const effect = props.selectedPresentation;
        return inspector('Presentation', <PresentationSettingsPanel effect={effect} playheadMs={props.playheadMs ?? effect.startMs} onChange={(patch) => props.onPresentationChange!(effect.id, patch)} onDelete={() => props.onPresentationDelete!(effect.id)} />);
    }

    if (selectedAnnotation && props.onAnnotationContentChange && props.onAnnotationTypeChange && props.onAnnotationStyleChange && props.onAnnotationDelete) {
        return inspector(
            'Annotation',
            <>
                <AnnotationSettingsPanel
                    annotation={selectedAnnotation}
                    onContentChange={(content) => props.onAnnotationContentChange!(selectedAnnotation.id, content)}
                    onTypeChange={(type) => props.onAnnotationTypeChange!(selectedAnnotation.id, type)}
                    onStyleChange={(style) => props.onAnnotationStyleChange!(selectedAnnotation.id, style)}
                    onFigureDataChange={props.onAnnotationFigureDataChange ? (figureData) => props.onAnnotationFigureDataChange!(selectedAnnotation.id, figureData) : undefined}
                    onDelete={() => props.onAnnotationDelete!(selectedAnnotation.id)}
                />
                {cursorInspector}
            </>,
        );
    }

    if ((props.selectedVideoId || props.isOriginalAudioSelected) && props.onSelectVideo) {
        const isAudio = Boolean(props.isOriginalAudioSelected && !props.selectedVideoId);
        return inspector(
            isAudio ? 'Audio' : 'Video',
            <>
                {!isAudio && (
                    <>
                        <section className="px-4 py-3">
                            <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Playback</h3>
                            <label className="flex items-center justify-between gap-3 text-[11px] text-[var(--ui-text-secondary)]">
                                <span>Speed</span>
                                <select
                                    aria-label="Selected video speed"
                                    className="h-8 min-w-[92px] rounded-[5px] border border-[var(--ui-border)] bg-[var(--ui-control)] px-2 text-[11px] text-[var(--ui-text-primary)]"
                                    value={props.selectedVideoSpeed ?? 'mixed'}
                                    onChange={(event) => props.onSelectedVideoSpeedChange?.(Number(event.target.value))}
                                >
                                    {props.selectedVideoSpeed === null && <option value="mixed" disabled>Mixed</option>}
                                    {[0.5, 1, 1.5, 2, 4, 8].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                                </select>
                            </label>
                            <p className="mt-2 text-[10px] leading-4 text-[var(--ui-text-tertiary)]">
                                Changes only this clip. The source video is never modified.
                            </p>
                        </section>
                        <section className="border-t border-[var(--ui-border)] px-4 py-3">
                            <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Source</h3>
                            <Button
                                onClick={() => setShowCropDropdown(true)}
                                variant="outline"
                                className="w-full justify-start gap-2 h-8 rounded-[5px] bg-[var(--ui-control)] text-[12px] text-[var(--ui-text-secondary)] border border-transparent shadow-none hover:border-[var(--ui-border)] hover:bg-[var(--ui-control-hover)]"
                            >
                                <Crop className="w-3.5 h-3.5" strokeWidth={1.6} />
                                Crop
                            </Button>
                        </section>
                    </>
                )}
                {props.hasOriginalAudio && props.onSeparateAudio && (
                    <section className={`px-4 py-3 ${isAudio ? '' : 'border-t border-[var(--ui-border)]'}`}>
                        <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Audio</h3>
                        <Button
                            onClick={props.onSeparateAudio}
                            variant="outline"
                            className="w-full justify-start gap-2 h-8 rounded-[5px] bg-[var(--ui-control)] text-[12px] text-[var(--ui-text-secondary)] border border-transparent shadow-none hover:border-[var(--ui-border)] hover:bg-[var(--ui-control-hover)]"
                        >
                            <Scissors className="w-3.5 h-3.5" strokeWidth={1.6} />
                            Separate Original Audio
                        </Button>
                    </section>
                )}
                {cursorInspector}
            </>,
        );
    }

    if (props.selectedZoomId && props.selectedCameraMotion) {
        return inspector(
            '运镜',
            <section className="px-4 py-3">
                <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-3">Camera Motion</h3>
                <CameraMotionControls
                    value={props.selectedCameraMotion}
                    onChange={(motion) => props.onCameraMotionChange?.(motion)}
                    onDelete={() => props.onZoomDelete?.(props.selectedZoomId!)}
                />
            </section>,
        );
    }

    if (props.selectedZoomId) {
        return inspector(
            'Focus',
            <>
                <section className="px-4 py-3">
                    <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Zoom</h3>
                    <ZoomControls
                        selectedZoomDepth={props.selectedZoomDepth}
                        onZoomDepthChange={props.onZoomDepthChange}
                        selectedZoomId={props.selectedZoomId}
                        onZoomDelete={props.onZoomDelete}
                        instant={props.selectedZoomInstant}
                        onInstantChange={props.onZoomInstantChange}
                        onCopy={props.onZoomCopy}
                        onPaste={props.onZoomPaste}
                    />
                </section>
                <section className="border-t border-[var(--ui-border)] px-4 py-3">
                    <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Motion</h3>
                    <div className="flex min-h-8 items-center justify-between">
                        <span className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Motion Blur</span>
                        <Switch
                            switchSize="sm"
                            checked={props.motionBlurEnabled}
                            onCheckedChange={props.onMotionBlurChange}
                            className="data-[state=checked]:bg-[#0D99FF]"
                        />
                    </div>
                </section>
                {cursorInspector}
            </>,
        );
    }

    if (props.selectedTrimId) {
        return inspector(
            'Trim',
            <>
                <section className="px-4 py-3">
                    <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Region</h3>
                    <Button
                        onClick={() => props.onTrimDelete?.(props.selectedTrimId!)}
                        variant="destructive"
                        className="w-full justify-start gap-2 h-8 rounded-[5px] bg-red-500/8 text-red-500 border border-red-500/15 hover:bg-red-500/12"
                    >
                        <X className="w-3.5 h-3.5" />
                        Delete Trim Region
                    </Button>
                </section>
                {cursorInspector}
            </>,
        );
    }

    const canvasInspector = (
        <>
            <section className="px-4 py-3">
                <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Frame</h3>
                <div className="grid grid-cols-[1fr_112px] items-center gap-3">
                    <span className="text-[12px] font-medium text-[var(--ui-text-secondary)]">Aspect Ratio</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-7 justify-between rounded-[5px] bg-[var(--ui-control)] px-2 text-[12px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)]"
                            >
                                {getAspectRatioLabel(props.aspectRatio)}
                                <ChevronDown className="h-3 w-3 text-[var(--ui-text-tertiary)]" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            sideOffset={4}
                            className="toscreen-dropdown-menu z-[200] w-[160px] min-w-[160px] rounded-[8px] border-0 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.1)] outline-none"
                        >
                            {ASPECT_RATIOS.map((ratio) => (
                                <DropdownMenuItem
                                    key={ratio}
                                    onClick={() => props.onAspectRatioChange?.(ratio)}
                                    className="h-8 rounded-[5px] px-2.5 text-[12px] text-[var(--ui-text-secondary)] focus:bg-[var(--ui-control-hover)] focus:text-[var(--ui-text-primary)]"
                                >
                                    <span className="flex-1">{getAspectRatioLabel(ratio)}</span>
                                    {props.aspectRatio === ratio && <Check className="h-3 w-3 text-[#0D99FF]" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </section>
            {props.presetControls}
            {cursorInspector}
            <section className="border-t border-[var(--ui-border)] px-4 py-3">
                <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Background</h3>
                <BackgroundControls
                    selected={props.selected}
                    onWallpaperChange={props.onWallpaperChange}
                    showBlur={props.showBlur}
                    onBlurChange={props.onBlurChange}
                />
            </section>
            <section className="border-t border-[var(--ui-border)] px-4 py-3">
                <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)] mb-2">Recording</h3>
                <LayoutControls
                    padding={props.padding}
                    onPaddingChange={props.onPaddingChange}
                    borderRadius={props.borderRadius}
                    onBorderRadiusChange={props.onBorderRadiusChange}
                    shadowIntensity={props.shadowIntensity}
                    onShadowChange={props.onShadowChange}
                />
            </section>
        </>
    );

    return inspector('Canvas', canvasInspector);
}
