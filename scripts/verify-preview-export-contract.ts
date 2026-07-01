import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";

const project = createProjectFromLegacyEditorState({
  projectId: "project-preview-export-contract",
  projectName: "Preview Export Contract",
  videoPath: "/tmp/toscreen-contract-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-contract.mov",
  companionAudioPath: "/tmp/toscreen-contract-audio.mov",
  durationSeconds: 12,
  projectDurationSeconds: 15,
  zoomRegions: [{
    id: "zoom-contract-1",
    startMs: 1000,
    endMs: 4000,
    depth: 4,
    focus: { cx: 0.42, cy: 0.58 },
  }],
  trimRegions: [{
    id: "trim-contract-1",
    startMs: 7000,
    endMs: 8000,
  }],
  annotationRegions: [{
    id: "annotation-contract-1",
    type: "text",
    startMs: 2500,
    endMs: 5500,
    position: { x: 0.2, y: 0.3 },
    size: { width: 0.3, height: 0.15 },
    content: "Contract annotation",
    style: {
      fontSize: 28,
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.65)",
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 1,
  }],
  audioRegions: [{
    id: "audio-contract-1",
    startMs: 0,
    endMs: 15000,
    sourceUrl: "file:///tmp/toscreen-contract-audio.mov",
    path: "/tmp/toscreen-contract-audio.mov",
    volume: 0.8,
    isOriginal: true,
    isDetached: false,
    sourceStartMs: 0,
    sourceEndMs: 15000,
    totalDurationMs: 15000,
    name: "Contract Audio",
  }],
  cursorData: [{
    timestamp: 1200,
    x: 300,
    y: 400,
    cx: 0.3,
    cy: 0.4,
    isClick: true,
  }],
  cursorSize: 1.8,
  cursorSmoothing: false,
  showVectorCursor: true,
  cursorOffset: -120,
  cropRegion: { x: 0.1, y: 0.05, width: 0.8, height: 0.9 },
  wallpaper: "/wallpapers/wallpaper7.jpg",
  shadowIntensity: 0.45,
  showBlur: true,
  motionBlurEnabled: false,
  borderRadius: 18,
  padding: 54,
  aspectRatio: "16:9",
  exportQuality: "source",
  now: new Date("2026-06-30T00:00:00.000Z"),
});

const validation = validateVideoEditorProject(project);
if (!validation.valid) {
  fail("ProjectModel validation failed", validation);
}

const renderSettings = getProjectRenderSettings(project);

assertEqual(renderSettings.durationMs, 15000, "durationMs");
assertEqual(renderSettings.canvas.aspectRatio, "16:9", "canvas.aspectRatio");
assertEqual(renderSettings.canvas.wallpaper, "/wallpapers/wallpaper7.jpg", "canvas.wallpaper");
assertEqual(renderSettings.canvas.showBlur, true, "canvas.showBlur");
assertEqual(renderSettings.canvas.shadowIntensity, 0.45, "canvas.shadowIntensity");
assertEqual(renderSettings.canvas.borderRadius, 18, "canvas.borderRadius");
assertEqual(renderSettings.canvas.padding, 54, "canvas.padding");
assertEqual(renderSettings.canvas.cropRegion.x, 0.1, "canvas.cropRegion.x");
assertEqual(renderSettings.timeline.zoomRegions.length, 1, "timeline.zoomRegions.length");
assertEqual(renderSettings.timeline.trimRegions.length, 1, "timeline.trimRegions.length");
assertEqual(renderSettings.timeline.annotationRegions.length, 1, "timeline.annotationRegions.length");
assertEqual(renderSettings.timeline.audioRegions.length, 1, "timeline.audioRegions.length");
assertEqual(renderSettings.cursor.data.length, 1, "cursor.data.length");
assertEqual(renderSettings.cursor.size, 1.8, "cursor.size");
assertEqual(renderSettings.cursor.smoothing, false, "cursor.smoothing");
assertEqual(renderSettings.cursor.showVectorCursor, true, "cursor.showVectorCursor");
assertEqual(renderSettings.cursor.offsetMs, -120, "cursor.offsetMs");
assertEqual(renderSettings.effects.motionBlurEnabled, false, "effects.motionBlurEnabled");
assertEqual(renderSettings.exportSettings.quality, "source", "exportSettings.quality");

console.log(JSON.stringify({
  status: "ok",
  durationMs: renderSettings.durationMs,
  zoomRegions: renderSettings.timeline.zoomRegions.length,
  trimRegions: renderSettings.timeline.trimRegions.length,
  annotationRegions: renderSettings.timeline.annotationRegions.length,
  audioRegions: renderSettings.timeline.audioRegions.length,
  cursorPoints: renderSettings.cursor.data.length,
  exportQuality: renderSettings.exportSettings.quality,
  warnings: validation.warnings,
}, null, 2));

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (!Object.is(actual, expected)) {
    fail(`Expected ${label} to be ${String(expected)}, got ${String(actual)}.`);
  }
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
