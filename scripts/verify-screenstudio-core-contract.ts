import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  videoEditor: path.join(repoRoot, "src", "components", "video-editor", "VideoEditor.tsx"),
  videoPlayback: path.join(repoRoot, "src", "components", "video-editor", "VideoPlayback.tsx"),
  cursorRenderer: path.join(repoRoot, "src", "components", "video-editor", "hooks", "useCursorRenderer.ts"),
  videoExporter: path.join(repoRoot, "src", "lib", "exporter", "videoExporter.ts"),
  frameRenderer: path.join(repoRoot, "src", "lib", "exporter", "frameRenderer.ts"),
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
) as Record<keyof typeof files, string>;

const checks = [
  {
    area: "preview-render-settings",
    file: "videoEditor",
    needles: [
      "wallpaper={currentRenderSettings.canvas.wallpaper}",
      "zoomRegions={currentRenderSettings.timeline.zoomRegions}",
      "showBlur={currentRenderSettings.canvas.showBlur}",
      "motionBlurEnabled={currentRenderSettings.effects.motionBlurEnabled}",
      "annotationRegions={currentRenderSettings.timeline.annotationRegions}",
      "cursorSize={currentRenderSettings.cursor.size}",
      "showVectorCursor={currentRenderSettings.cursor.showVectorCursor}",
      "cursorStyle={currentRenderSettings.cursor.style}",
      "cursorCustomImages={currentRenderSettings.cursor.customImages}",
      "cursorData={currentRenderSettings.cursor.data}",
      "cursorOffset={currentRenderSettings.cursor.offsetMs}",
    ],
  },
  {
    area: "export-render-settings",
    file: "videoEditor",
    needles: [
      "const renderSettings = currentRenderSettings;",
      "wallpaper: renderSettings.canvas.wallpaper",
      "zoomRegions: renderSettings.timeline.zoomRegions",
      "annotationRegions: renderSettings.timeline.annotationRegions",
      "showBlur: renderSettings.canvas.showBlur",
      "motionBlurEnabled: renderSettings.effects.motionBlurEnabled",
      "cursorData: renderSettings.cursor.data",
      "cursorSize: renderSettings.cursor.size",
      "showVectorCursor: renderSettings.cursor.showVectorCursor",
      "cursorStyle: renderSettings.cursor.style",
      "cursorCustomImages: renderSettings.cursor.customImages",
      "cursorOffset: renderSettings.cursor.offsetMs",
    ],
  },
  {
    area: "preview-cursor-engine",
    file: "videoPlayback",
    needles: [
      "useCursorRenderer({",
      "cursorData: mappedCursorData",
      "cursorSize",
      "cursorSmoothing",
      "showVectorCursor",
      "cursorStyle",
      "cursorCustomImages",
      "cursorOffset",
      "mediaDurationMs: sourceDurationMs",
      "filter: showBlur ? 'blur(2px)' : 'none'",
      "zoomRegionsRef.current,\n        projectTimeMs,\n        mappedCursorData,",
    ],
  },
  {
    area: "cursor-renderer",
    file: "cursorRenderer",
    needles: [
      "cursor.innerHTML = cursorElementMarkup('default', cursorStyleRef.current, cursorCustomImagesRef.current)",
      "cursor.innerHTML = cursorElementMarkup(currentCursorType, currentCursorStyle, currentCustomImages)",
      "showVectorCursorRef.current",
      "cursorOffsetRef.current",
      "prepareCursorTrack(cursorData, cursorSmoothing, mediaDurationMs)",
      "sampleCursorTrack(preparedCursorData, currentTimeMs)",
      "videoSprite.toGlobal",
      "cursor.style.transform = `translate3d",
    ],
  },
  {
    area: "exporter-to-frame-renderer",
    file: "videoExporter",
    needles: [
      "new FrameRenderer({",
      "wallpaper: this.config.wallpaper",
      "zoomRegions: this.config.zoomRegions",
      "showBlur: this.config.showBlur",
      "motionBlurEnabled: this.config.motionBlurEnabled",
      "annotationRegions: this.config.annotationRegions",
      "cursorData: this.config.cursorData",
      "cursorSize: this.config.cursorSize",
      "cursorMediaDurationMs: videoInfo.duration * 1000",
      "showVectorCursor: this.config.showVectorCursor",
      "cursorStyle: this.config.cursorStyle",
      "cursorCustomImages: this.config.cursorCustomImages",
      "cursorOffset: this.config.cursorOffset",
    ],
  },
  {
    area: "export-frame-renderer-effects",
    file: "frameRenderer",
    needles: [
      "this.config.zoomRegions,\n      timeMs,\n      this.cursorTrack,",
      "applyZoomTransform({",
      "ctx.filter = 'blur(6px)'",
      "await renderAnnotations(",
      "this.renderCursor(timeMs);",
      "const isVectorStyle = this.config.showVectorCursor !== false",
      "await this.setupCustomCursor()",
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
    message: "Screen Studio core preview/export contract is broken.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checks: checks.map((check) => check.area),
}, null, 2));
