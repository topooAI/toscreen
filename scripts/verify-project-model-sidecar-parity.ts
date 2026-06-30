import {
  createProjectAutosaveSnapshot,
  createProjectFromLegacyEditorState,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
  type LegacyEditorProjectInput,
} from "../src/components/video-editor/project";

const legacyInput: LegacyEditorProjectInput = {
  projectId: "project-sidecar-parity",
  projectName: "Sidecar Parity Contract",
  videoPath: "/tmp/toscreen-sidecar-parity-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-sidecar-parity.mov",
  companionAudioPath: "/tmp/toscreen-sidecar-parity-audio.mov",
  durationSeconds: 9,
  projectDurationSeconds: 13,
  zoomRegions: [{
    id: "zoom-sidecar-1",
    startMs: 1000,
    endMs: 3200,
    depth: 4,
    focus: { cx: 0.42, cy: 0.36 },
  }],
  trimRegions: [{
    id: "trim-sidecar-1",
    startMs: 7200,
    endMs: 8100,
  }],
  annotationRegions: [{
    id: "annotation-sidecar-1",
    type: "text",
    startMs: 1500,
    endMs: 5200,
    content: "Parity annotation",
    textContent: "Parity annotation",
    position: { x: 36, y: 24 },
    size: { width: 32, height: 12 },
    style: {
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.6)",
      fontSize: 28,
      fontFamily: "Inter",
      fontWeight: "600",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 2,
  }],
  audioRegions: [{
    id: "audio-sidecar-original",
    startMs: 0,
    endMs: 13000,
    sourceUrl: "file:///tmp/toscreen-sidecar-parity-audio.mov",
    path: "/tmp/toscreen-sidecar-parity-audio.mov",
    volume: 0.8,
    isOriginal: true,
    isDetached: false,
    sourceStartMs: 0,
    sourceEndMs: 13000,
    totalDurationMs: 13000,
    name: "Sidecar Original Audio",
  }],
  cursorData: [{
    timestamp: 1800,
    absoluteTime: 1800,
    x: 540,
    y: 320,
    cx: 0.45,
    cy: 0.44,
    isClick: true,
  }],
  cursorSize: 1.9,
  cursorSmoothing: false,
  showVectorCursor: false,
  cursorOffset: -120,
  cropRegion: { x: 0.02, y: 0.04, width: 0.92, height: 0.88 },
  wallpaper: "/wallpapers/wallpaper9.jpg",
  shadowIntensity: 0.48,
  showBlur: true,
  motionBlurEnabled: false,
  borderRadius: 22,
  padding: 64,
  aspectRatio: "16:9",
  exportQuality: "high",
  now: new Date("2026-06-30T00:00:00.000Z"),
};

const projectModel = createProjectFromLegacyEditorState(legacyInput);
const validation = validateVideoEditorProject(projectModel);
if (!validation.valid) {
  fail("Generated ProjectModel is invalid.", validation);
}

const savedProject = {
  ...createProjectAutosaveSnapshot(projectModel, legacyInput.audioRegions),
};

const restored = restoreLegacyEditorStateFromProjectModel(savedProject.projectModel);
const expected = legacySnapshot(savedProject);
const actual = legacySnapshot(restored);

if (JSON.stringify(expected) !== JSON.stringify(actual)) {
  fail("Saved legacy fields diverge from ProjectModel restore output.", {
    expected,
    actual,
  });
}

console.log(JSON.stringify({
  status: "ok",
  comparedFields: Object.keys(expected),
  zoomRegions: restored.zoomRegions.length,
  trimRegions: restored.trimRegions.length,
  annotationRegions: restored.annotationRegions.length,
  audioRegions: restored.audioRegions.length,
  cursorPoints: restored.cursorData?.length ?? 0,
  exportQuality: restored.exportQuality,
  warnings: validation.warnings,
}, null, 2));

function legacySnapshot(value: Record<string, unknown>) {
  return {
    zoomRegions: value.zoomRegions,
    trimRegions: value.trimRegions,
    annotationRegions: value.annotationRegions,
    audioRegions: normalizeAudioRegions(value.audioRegions),
    cropRegion: value.cropRegion,
    wallpaper: value.wallpaper,
    shadowIntensity: value.shadowIntensity,
    showBlur: value.showBlur,
    motionBlurEnabled: value.motionBlurEnabled,
    borderRadius: value.borderRadius,
    padding: value.padding,
    aspectRatio: value.aspectRatio,
    exportQuality: value.exportQuality,
    cursorData: value.cursorData,
    cursorSize: value.cursorSize,
    cursorSmoothing: value.cursorSmoothing,
    showVectorCursor: value.showVectorCursor,
    cursorOffset: value.cursorOffset,
  };
}

function normalizeAudioRegions(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((region) => {
    const { file: _file, ...serializable } = region as Record<string, unknown>;
    return serializable;
  });
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
