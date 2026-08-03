import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";
import type { ProjectRenderSettings } from "../src/components/video-editor/project";
import type { LegacyEditorProjectInput } from "../src/components/video-editor/project";

const originalInput: LegacyEditorProjectInput = {
  projectId: "project-roundtrip",
  projectName: "Roundtrip Contract",
  videoPath: "/tmp/toscreen-roundtrip-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-roundtrip.mov",
  companionAudioPath: "/tmp/toscreen-roundtrip-audio.mov",
  durationSeconds: 12,
  projectDurationSeconds: 16,
  zoomRegions: [{
    id: "zoom-roundtrip-1",
    startMs: 1000,
    endMs: 4500,
    depth: 5,
    focus: { cx: 0.37, cy: 0.62 },
  }],
  trimRegions: [{
    id: "trim-roundtrip-1",
    startMs: 8000,
    endMs: 9200,
  }],
  annotationRegions: [{
    id: "annotation-roundtrip-1",
    type: "text",
    startMs: 2200,
    endMs: 6200,
    content: "Roundtrip annotation",
    textContent: "Roundtrip annotation",
    position: { x: 42, y: 36 },
    size: { width: 28, height: 14 },
    style: {
      color: "#f8fafc",
      backgroundColor: "rgba(15,23,42,0.72)",
      fontSize: 30,
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 4,
  }],
  audioRegions: [{
    id: "audio-roundtrip-original",
    startMs: 0,
    endMs: 16000,
    sourceUrl: "file:///tmp/toscreen-roundtrip-audio.mov",
    path: "/tmp/toscreen-roundtrip-audio.mov",
    volume: 0.75,
    isOriginal: true,
    isDetached: false,
    sourceStartMs: 0,
    sourceEndMs: 16000,
    totalDurationMs: 16000,
    name: "Roundtrip Original Audio",
  }, {
    id: "audio-roundtrip-broll",
    startMs: 5000,
    endMs: 9000,
    sourceUrl: "file:///tmp/toscreen-roundtrip-broll.wav",
    path: "/tmp/toscreen-roundtrip-broll.wav",
    volume: 0.35,
    isOriginal: false,
    isDetached: true,
    sourceStartMs: 400,
    sourceEndMs: 4400,
    totalDurationMs: 6000,
    name: "Roundtrip B-roll Audio",
    trackIndex: 2,
  }],
  cursorData: [{
    timestamp: 1400,
    absoluteTime: 1400,
    x: 640,
    y: 360,
    cx: 0.5,
    cy: 0.5,
    isClick: true,
  }],
  cursorSize: 1.7,
  cursorSmoothing: false,
  showVectorCursor: true,
  cursorStyle: "custom",
  cursorCustomImages: {
    default: "data:image/png;base64,ZGVmYXVsdA==",
    pointer: "data:image/png;base64,cG9pbnRlcg==",
    text: "data:image/png;base64,dGV4dA==",
  },
  cursorOffset: -90,
  cropRegion: { x: 0.08, y: 0.06, width: 0.82, height: 0.88 },
  wallpaper: "/wallpapers/wallpaper12.jpg",
  shadowIntensity: 0.52,
  showBlur: true,
  motionBlurEnabled: false,
  borderRadius: 24,
  padding: 58,
  aspectRatio: "16:9",
  exportQuality: "source",
  now: new Date("2026-06-30T00:00:00.000Z"),
};

const firstProject = createProjectFromLegacyEditorState(originalInput);
assertValidProject(firstProject, "firstProject");

const firstSettings = getProjectRenderSettings(firstProject);
const restored = restoreLegacyEditorStateFromProjectModel(firstProject);

const secondProject = createProjectFromLegacyEditorState({
  ...originalInput,
  companionAudioPath: restored.companionAudioPath,
  projectDurationSeconds: firstSettings.durationMs / 1000,
  zoomRegions: restored.zoomRegions,
  trimRegions: restored.trimRegions,
  annotationRegions: restored.annotationRegions,
  audioRegions: restored.audioRegions,
  cursorData: restored.cursorData ?? [],
  cursorSize: restored.cursorSize ?? originalInput.cursorSize,
  cursorSmoothing: restored.cursorSmoothing ?? originalInput.cursorSmoothing,
  showVectorCursor: restored.showVectorCursor ?? originalInput.showVectorCursor,
  cursorStyle: restored.cursorStyle ?? originalInput.cursorStyle,
  cursorCustomImages: restored.cursorCustomImages ?? originalInput.cursorCustomImages,
  cursorOffset: restored.cursorOffset ?? originalInput.cursorOffset,
  cropRegion: restored.cropRegion,
  wallpaper: restored.wallpaper,
  shadowIntensity: restored.shadowIntensity,
  showBlur: restored.showBlur,
  motionBlurEnabled: restored.motionBlurEnabled ?? originalInput.motionBlurEnabled,
  borderRadius: restored.borderRadius,
  padding: restored.padding,
  aspectRatio: restored.aspectRatio,
  exportQuality: restored.exportQuality,
  now: new Date("2026-06-30T00:00:00.000Z"),
});
assertValidProject(secondProject, "secondProject");

const secondSettings = getProjectRenderSettings(secondProject);
assertRenderSettingsEqual(firstSettings, secondSettings);

console.log(JSON.stringify({
  status: "ok",
  durationMs: secondSettings.durationMs,
  zoomRegions: secondSettings.timeline.zoomRegions.length,
  trimRegions: secondSettings.timeline.trimRegions.length,
  annotationRegions: secondSettings.timeline.annotationRegions.length,
  audioRegions: secondSettings.timeline.audioRegions.length,
  cursorPoints: secondSettings.cursor.data.length,
  exportQuality: secondSettings.exportSettings.quality,
}, null, 2));

function assertValidProject(project: unknown, label: string) {
  const validation = validateVideoEditorProject(project);
  if (!validation.valid) {
    fail(`${label} validation failed.`, validation);
  }
}

function assertRenderSettingsEqual(first: ProjectRenderSettings, second: ProjectRenderSettings) {
  const firstSnapshot = renderSettingsSnapshot(first);
  const secondSnapshot = renderSettingsSnapshot(second);
  const firstJson = JSON.stringify(firstSnapshot);
  const secondJson = JSON.stringify(secondSnapshot);
  if (firstJson !== secondJson) {
    fail("Render settings changed after ProjectModel roundtrip.", {
      first: firstSnapshot,
      second: secondSnapshot,
    });
  }
}

function renderSettingsSnapshot(settings: ProjectRenderSettings) {
  return {
    durationMs: settings.durationMs,
    canvas: settings.canvas,
    timeline: {
      zoomRegions: settings.timeline.zoomRegions,
      trimRegions: settings.timeline.trimRegions,
      annotationRegions: settings.timeline.annotationRegions,
      audioRegions: settings.timeline.audioRegions.map(({ file: _file, ...region }) => region),
    },
    cursor: settings.cursor,
    effects: settings.effects,
    exportSettings: settings.exportSettings,
  };
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
