import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  videoEditor: path.join(repoRoot, "src", "components", "video-editor", "VideoEditor.tsx"),
  videoPlayback: path.join(repoRoot, "src", "components", "video-editor", "VideoPlayback.tsx"),
  zoomControls: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "ZoomControls.tsx"),
  cursorControls: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "CursorControls.tsx"),
  backgroundControls: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "BackgroundControls.tsx"),
  layoutControls: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "LayoutControls.tsx"),
  sidebar: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "Sidebar.tsx"),
  overlayUtils: path.join(repoRoot, "src", "components", "video-editor", "videoPlayback", "overlayUtils.ts"),
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
) as Record<keyof typeof files, string>;

const checks = [
  {
    area: "zoom-depth-control",
    file: "zoomControls",
    needles: [
      "const ZOOM_DEPTH_OPTIONS",
      "ZOOM_DEPTH_SCALES[depth]",
      "[1, 2, 3, 4, 5, 6] as ZoomDepth[]",
      "disabled={!zoomEnabled}",
      "onClick={() => onZoomDepthChange?.(option.depth)}",
      "Delete Zoom Region",
    ],
  },
  {
    area: "zoom-depth-video-editor-wiring",
    file: "videoEditor",
    needles: [
      "selectedZoomDepth={selectedZoomId ? zoomRegions.find(z => z.id === selectedZoomId)?.depth : null}",
      "onZoomDepthChange={(depth) => selectedZoomId && handleZoomDepthChange(depth)}",
      "const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {",
      "focus: clampFocusToDepth(region.focus, depth)",
      "onAutoZoom={handleAutoZoom}",
    ],
  },
  {
    area: "focus-position-preview-wiring",
    file: "videoPlayback",
    needles: [
      "const updateFocusFromClientPoint = (clientX: number, clientY: number) => {",
      "const unclampedFocus: ZoomFocus = {",
      "const clampedFocus = clampFocusToStage(unclampedFocus, region.depth);",
      "onZoomFocusChange(region.id, clampedFocus);",
      "updateOverlayForRegion({ ...region, focus: clampedFocus }, clampedFocus);",
      "onPointerDown={handleOverlayPointerDown}",
      "onPointerMove={handleOverlayPointerMove}",
      "onSelectZoom(region.id);",
      "style={{ pointerEvents: selectedZoom && !isPlaying ? 'auto' : 'none' }}",
    ],
  },
  {
    area: "focus-overlay-pointer-policy",
    file: "overlayUtils",
    needles: [
      "overlayEl.style.pointerEvents = 'none';",
      "overlayEl.style.pointerEvents = isPlaying ? 'none' : 'auto';",
      "indicatorEl.style.display = 'block';",
    ],
  },
  {
    area: "focus-position-video-editor-wiring",
    file: "videoEditor",
    needles: [
      "const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {",
      "const handleSelectZoom = useCallback((id: string | null) => {",
      "setSelectedZoomId(id);",
      "setSelectedAnnotationId(null);",
      "focus: clampFocusToDepth(focus, region.depth)",
      "onZoomFocusChange={handleZoomFocusChange}",
      "selectedZoomId={selectedZoomId}",
      "onSelectZoom={handleSelectZoom}",
    ],
  },
  {
    area: "cursor-control-wiring",
    file: "cursorControls",
    needles: [
      "onShowVectorCursorChange?.(style !== 'system')",
      "checked={cursorSmoothing}",
      "disabled={!isEnhancedStyle}",
      "onValueChange={onCursorSizeChange}",
      "min={0.5}",
      "max={5.0}",
      "onValueChange={onCursorOffsetChange}",
      "min={-1000}",
      "max={1000}",
    ],
  },
  {
    area: "cursor-control-video-editor-wiring",
    file: "videoEditor",
    needles: [
      "cursorSize={cursorSize}",
      "onCursorSizeChange={setCursorSize}",
      "cursorSmoothing={cursorSmoothing}",
      "onCursorSmoothingChange={setCursorSmoothing}",
      "showVectorCursor={showVectorCursor}",
      "onShowVectorCursorChange={setShowVectorCursor}",
      "cursorOffset={cursorOffset}",
      "onCursorOffsetChange={setCursorOffset}",
    ],
  },
  {
    area: "background-control-wiring",
    file: "backgroundControls",
    needles: [
      "checked={showBlur}",
      "onCheckedChange={onBlurChange}",
      "TabsTrigger value=\"image\"",
      "TabsTrigger value=\"color\"",
      "TabsTrigger value=\"gradient\"",
      "onWallpaperChange(dataUrl)",
      "onWallpaperChange(color.hex)",
      "onClick={() => { setGradient(g); onWallpaperChange(g); }}",
    ],
  },
  {
    area: "layout-effects-control-wiring",
    file: "layoutControls",
    needles: [
      "<ScrubbableNumberInput",
      "onValueChange={onPaddingChange}",
      "onValueChange={onBorderRadiusChange}",
      "onValueChange={(value) => onShadowChange?.(value / 100)}",
      "max={100}",
      "max={32}",
    ],
  },
  {
    area: "motion-blur-control-wiring",
    file: "sidebar",
    needles: [
      "checked={props.motionBlurEnabled}",
      "onCheckedChange={props.onMotionBlurChange}",
    ],
  },
  {
    area: "background-layout-video-editor-wiring",
    file: "videoEditor",
    needles: [
      "onWallpaperChange={setWallpaper}",
      "onShadowChange={setShadowIntensity}",
      "showBlur={showBlur}",
      "onBlurChange={setShowBlur}",
      "motionBlurEnabled={motionBlurEnabled}",
      "onMotionBlurChange={setMotionBlurEnabled}",
      "onBorderRadiusChange={setBorderRadius}",
      "onPaddingChange={setPadding}",
    ],
  },
] as const;

const failures: Array<{ area: string; file: string; missing: string[] }> = [];

for (const check of checks) {
  const fileContent = content[check.file];
  const missing = check.needles.filter((needle) => !fileContent.includes(needle));
  if (missing.length > 0) {
    failures.push({ area: check.area, file: files[check.file], missing });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Screen Studio core controls are not fully wired.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checks: checks.map((check) => check.area),
}, null, 2));
