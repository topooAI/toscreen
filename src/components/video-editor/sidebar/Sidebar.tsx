import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bug, Crop, Download, Star, X } from "lucide-react";
import type { ZoomDepth, CropRegion, AnnotationRegion, AnnotationType } from "../types";
import { CropControl } from "../CropControl";
import { AnnotationSettingsPanel } from "../AnnotationSettingsPanel";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import type { ExportQuality } from "@/lib/exporter";

import { BackgroundControls } from "./BackgroundControls";
import { LayoutControls } from "./LayoutControls";
import { ZoomControls } from "./ZoomControls";

interface SidebarProps {
    selected: string;
    onWallpaperChange: (path: string) => void;
    // Zoom props
    selectedZoomDepth?: ZoomDepth | null;
    onZoomDepthChange?: (depth: ZoomDepth) => void;
    selectedZoomId?: string | null;
    onZoomDelete?: (id: string) => void;
    // Trim props
    selectedTrimId?: string | null;
    onTrimDelete?: (id: string) => void;
    // Layout props
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
    // Crop props
    cropRegion?: CropRegion;
    onCropChange?: (region: CropRegion) => void;
    aspectRatio: AspectRatio;
    videoElement?: HTMLVideoElement | null;
    // Export props
    exportQuality?: ExportQuality;
    onExportQualityChange?: (quality: ExportQuality) => void;
    onExport?: () => void;
    // Annotation props
    selectedAnnotationId?: string | null;
    annotationRegions?: AnnotationRegion[];
    onAnnotationContentChange?: (id: string, content: string) => void;
    onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
    onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion['style']>) => void;
    onAnnotationFigureDataChange?: (id: string, figureData: any) => void;
    onAnnotationDelete?: (id: string) => void;
    // Actions
    onAutoZoom?: () => void;
}

export function Sidebar(props: SidebarProps) {
    const [showCropDropdown, setShowCropDropdown] = useState(false);

    // 1. Handle Annotation View State
    const selectedAnnotation = props.selectedAnnotationId
        ? props.annotationRegions?.find(a => a.id === props.selectedAnnotationId)
        : null;

    if (selectedAnnotation && props.onAnnotationContentChange && props.onAnnotationTypeChange && props.onAnnotationStyleChange && props.onAnnotationDelete) {
        return (
            <div className="flex-[2] min-w-0 bg-[#09090b] border border-white/5 rounded-2xl flex flex-col shadow-xl h-full overflow-hidden">
                <AnnotationSettingsPanel
                    annotation={selectedAnnotation}
                    onContentChange={(content) => props.onAnnotationContentChange!(selectedAnnotation.id, content)}
                    onTypeChange={(type) => props.onAnnotationTypeChange!(selectedAnnotation.id, type)}
                    onStyleChange={(style) => props.onAnnotationStyleChange!(selectedAnnotation.id, style)}
                    onFigureDataChange={props.onAnnotationFigureDataChange ? (figureData) => props.onAnnotationFigureDataChange!(selectedAnnotation.id, figureData) : undefined}
                    onDelete={() => props.onAnnotationDelete!(selectedAnnotation.id)}
                />
            </div>
        );
    }

    // 2. Main Sidebar Layout
    return (
        <div className="flex-[2] min-w-0 bg-[#09090b] border border-white/5 rounded-2xl flex flex-col shadow-xl h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">

                {/* Section: Zoom Controls */}
                <section>
                    <h3 className="text-sm font-semibold text-white/90 mb-4 flex items-center gap-2">
                        Zoom & Focus
                    </h3>
                    <ZoomControls
                        selectedZoomDepth={props.selectedZoomDepth}
                        onZoomDepthChange={props.onZoomDepthChange}
                        selectedZoomId={props.selectedZoomId}
                        onZoomDelete={props.onZoomDelete}
                        onAutoZoom={props.onAutoZoom}
                    />
                </section>

                <div className="h-px bg-white/5 w-full" />

                {/* Section: Appearance */}
                <section>
                    <h3 className="text-sm font-semibold text-white/90 mb-4">Background</h3>
                    <BackgroundControls
                        selected={props.selected}
                        onWallpaperChange={props.onWallpaperChange}
                        showBlur={props.showBlur}
                        onBlurChange={props.onBlurChange}
                    />
                </section>

                <div className="h-px bg-white/5 w-full" />

                {/* Section: Layout */}
                <section>
                    <h3 className="text-sm font-semibold text-white/90 mb-4">Layout & Effects</h3>
                    <LayoutControls
                        padding={props.padding}
                        onPaddingChange={props.onPaddingChange}
                        borderRadius={props.borderRadius}
                        onBorderRadiusChange={props.onBorderRadiusChange}
                        shadowIntensity={props.shadowIntensity}
                        onShadowChange={props.onShadowChange}
                        motionBlurEnabled={props.motionBlurEnabled}
                        onMotionBlurChange={props.onMotionBlurChange}
                    />
                </section>

                <div className="h-px bg-white/5 w-full" />

                {/* Section: Video Actions */}
                <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 mb-2">Video Actions</h3>

                    {/* Crop Trigger */}
                    <Button
                        onClick={() => setShowCropDropdown(!showCropDropdown)}
                        variant="outline"
                        className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white h-9 transition-all"
                    >
                        <Crop className="w-4 h-4" />
                        Crop Video
                    </Button>

                    {/* Trim Delete (Contextual) */}
                    {props.selectedTrimId && (
                        <Button
                            onClick={() => props.onTrimDelete?.(props.selectedTrimId!)}
                            variant="destructive"
                            size="sm"
                            className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                        >
                            <X className="w-4 h-4" />
                            Delete Trim Region
                        </Button>
                    )}
                </section>
            </div>

            {/* Footer / Export */}
            <div className="p-5 border-t border-white/5 bg-[#09090b]">
                <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Export Quality</span>
                </div>
                <div className="mb-4 bg-white/5 border border-white/5 p-1 w-full grid grid-cols-3 h-auto rounded-xl">
                    {(['medium', 'good', 'source'] as const).map((q) => (
                        <button
                            key={q}
                            onClick={() => props.onExportQualityChange?.(q)}
                            className={cn(
                                "py-2 rounded-lg transition-all text-xs font-medium capitalize",
                                props.exportQuality === q
                                    ? "bg-white text-black shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            {q === 'source' ? 'High' : q}
                        </button>
                    ))}
                </div>

                <Button
                    type="button"
                    size="lg"
                    onClick={props.onExport}
                    className="w-full py-6 text-lg font-semibold flex items-center justify-center gap-3 bg-[#34B27B] text-white rounded-xl shadow-lg shadow-[#34B27B]/20 hover:bg-[#34B27B]/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                    <Download className="w-5 h-5" />
                    <span>Export Video</span>
                </Button>

                <div className="flex gap-2 mt-4 pt-2">
                    <button
                        type="button"
                        onClick={() => {
                            window.electronAPI?.openExternalUrl('https://github.com/siddharthvaddem/openscreen/issues/new/choose');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 text-[10px] text-slate-500 hover:text-slate-300 py-2 transition-colors"
                    >
                        <Bug className="w-3 h-3" />
                        <span>Report Bug</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            window.electronAPI?.openExternalUrl('https://github.com/siddharthvaddem/openscreen');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        <Star className="w-3 h-3" />
                        <span>Star on GitHub</span>
                    </button>
                </div>
            </div>

            {/* Crop Overlay */}
            {showCropDropdown && props.cropRegion && props.onCropChange && (
                <>
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                        onClick={() => setShowCropDropdown(false)}
                    />
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-5xl max-h-[90vh] overflow-auto animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <span className="text-xl font-bold text-slate-200">Crop Video</span>
                                <p className="text-sm text-slate-400 mt-2">Drag on each side to adjust the crop area</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowCropDropdown(false)}
                                className="hover:bg-white/10 text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <CropControl
                            videoElement={props.videoElement || null}
                            cropRegion={props.cropRegion}
                            onCropChange={props.onCropChange}
                            aspectRatio={props.aspectRatio}
                        />
                        <div className="mt-6 flex justify-end">
                            <Button
                                onClick={() => setShowCropDropdown(false)}
                                size="lg"
                                className="bg-[#34B27B] hover:bg-[#34B27B]/90 text-white"
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
