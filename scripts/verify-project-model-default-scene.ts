import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";

const project = createProjectFromLegacyEditorState({
  projectId: "project-default-scene",
  projectName: "Default Scene Contract",
  videoPath: "/tmp/default-scene-proxy.mp4",
  originalVideoPath: "/tmp/default-scene.mov",
  companionAudioPath: "/tmp/default-scene-audio.mov",
  durationSeconds: 6,
  projectDurationSeconds: 9,
  zoomRegions: [{
    id: "zoom-default-scene",
    startMs: 1000,
    endMs: 3200,
    depth: 3,
    focus: { cx: 0.44, cy: 0.52 },
  }],
  trimRegions: [],
  annotationRegions: [{
    id: "annotation-default-scene",
    type: "text",
    startMs: 4200,
    endMs: 7200,
    content: "Default scene annotation",
    textContent: "Default scene annotation",
    position: { x: 40, y: 40 },
    size: { width: 30, height: 12 },
    style: {
      color: "#ffffff",
      backgroundColor: "rgba(15,23,42,0.7)",
      fontSize: 28,
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 4,
  }],
  audioRegions: [{
    id: "audio-default-scene",
    startMs: 0,
    endMs: 9000,
    sourceUrl: "file:///tmp/default-scene-audio.mov",
    path: "/tmp/default-scene-audio.mov",
    volume: 1,
    isOriginal: true,
    isDetached: false,
    sourceStartMs: 0,
    sourceEndMs: 9000,
    totalDurationMs: 9000,
    name: "Default Scene Audio",
  }],
  cursorData: [{
    timestamp: 1200,
    x: 420,
    y: 320,
    cx: 0.5,
    cy: 0.5,
    isClick: true,
  }],
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorOffset: -180,
  cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  wallpaper: "/wallpapers/wallpaper1.jpg",
  shadowIntensity: 0.6,
  showBlur: false,
  motionBlurEnabled: true,
  borderRadius: 20,
  padding: 60,
  aspectRatio: "16:9",
  exportQuality: "good",
  now: new Date("2026-06-30T00:00:00.000Z"),
});

const validation = validateVideoEditorProject(project);
if (!validation.valid) {
  fail("ProjectModel with default scene should validate.", validation);
}

const scene = project.scenes[0];
if (!scene) {
  fail("Legacy adapter should create one default scene for non-empty projects.", project);
}

const renderSettings = getProjectRenderSettings(project);
const clipIds = project.clips.map((clip) => clip.id);
const missingClipIds = clipIds.filter((clipId) => !scene.clipIds.includes(clipId));

if (scene.purpose !== "demo") {
  fail("Default scene should use demo purpose.", scene);
}

if (scene.startMs !== 0 || scene.endMs !== renderSettings.durationMs) {
  fail("Default scene should cover the full ProjectModel duration.", {
    scene,
    durationMs: renderSettings.durationMs,
  });
}

if (missingClipIds.length > 0) {
  fail("Default scene should reference every generated clip.", {
    missingClipIds,
    sceneClipIds: scene.clipIds,
    clipIds,
  });
}

console.log(JSON.stringify({
  status: "ok",
  durationMs: renderSettings.durationMs,
  scenes: project.scenes.length,
  defaultScene: {
    id: scene.id,
    purpose: scene.purpose,
    startMs: scene.startMs,
    endMs: scene.endMs,
    clipIds: scene.clipIds.length,
  },
  clips: project.clips.length,
}, null, 2));

function fail(message: string, details: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
