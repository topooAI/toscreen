import {
  calculateLegacyProjectDurationSeconds,
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  validateVideoEditorProject,
  type LegacyEditorProjectInput,
} from "../src/components/video-editor/project";

const input: LegacyEditorProjectInput = {
  projectId: "project-duration-contract",
  projectName: "Project Duration Contract",
  videoPath: "/tmp/toscreen-duration-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-duration.mov",
  companionAudioPath: "/tmp/toscreen-duration-original-audio.mov",
  durationSeconds: 8,
  projectDurationSeconds: 0,
  zoomRegions: [{
    id: "zoom-after-video-end",
    startMs: 9000,
    endMs: 13000,
    depth: 3,
    focus: { cx: 0.55, cy: 0.42 },
  }],
  trimRegions: [{
    id: "trim-inside-source",
    startMs: 2000,
    endMs: 2600,
  }],
  annotationRegions: [{
    id: "annotation-after-video-end",
    type: "text",
    startMs: 11000,
    endMs: 14500,
    content: "After main video",
    textContent: "After main video",
    position: { x: 30, y: 30 },
    size: { width: 30, height: 12 },
    style: {
      color: "#ffffff",
      backgroundColor: "rgba(0,0,0,0.55)",
      fontSize: 24,
      fontFamily: "Inter",
      fontWeight: "600",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 1,
  }],
  audioRegions: [
    {
      id: "original-audio-after-video-end",
      startMs: 0,
      endMs: 16000,
      sourceUrl: "file:///tmp/toscreen-duration-original-audio.mov",
      path: "/tmp/toscreen-duration-original-audio.mov",
      volume: 1,
      isOriginal: true,
      isDetached: false,
      sourceStartMs: 0,
      sourceEndMs: 16000,
      totalDurationMs: 16000,
      name: "Original audio continues",
    },
    {
      id: "detached-audio-before-original-end",
      startMs: 3000,
      endMs: 15000,
      sourceUrl: "file:///tmp/toscreen-duration-music.wav",
      path: "/tmp/toscreen-duration-music.wav",
      volume: 0.7,
      isOriginal: false,
      isDetached: true,
      sourceStartMs: 0,
      sourceEndMs: 12000,
      totalDurationMs: 12000,
      name: "Detached music",
    },
  ],
  cursorData: [],
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
  now: new Date("2026-07-01T00:00:00.000Z"),
};

const durationSeconds = calculateLegacyProjectDurationSeconds(input);
if (durationSeconds !== 16) {
  fail("Project duration must be determined by the latest clip end, including original audio and Camera/Zoom clips.", {
    durationSeconds,
  });
}

const explicitMinimumDuration = calculateLegacyProjectDurationSeconds({
  ...input,
  projectDurationSeconds: 18,
});
if (explicitMinimumDuration !== 18) {
  fail("Explicit projectDurationSeconds must remain a minimum duration floor.", {
    explicitMinimumDuration,
  });
}

const project = createProjectFromLegacyEditorState({
  ...input,
  projectDurationSeconds: durationSeconds,
});
const validation = validateVideoEditorProject(project);
if (!validation.valid) {
  fail("ProjectModel generated from duration contract is invalid.", validation);
}

const renderSettings = getProjectRenderSettings(project);
if (project.durationMs !== 16000 || renderSettings.durationMs !== 16000) {
  fail("ProjectModel and render settings must share the same project duration.", {
    projectDurationMs: project.durationMs,
    renderSettingsDurationMs: renderSettings.durationMs,
  });
}

console.log(JSON.stringify({
  status: "ok",
  sourceDurationSeconds: input.durationSeconds,
  projectDurationSeconds: durationSeconds,
  explicitMinimumDuration,
  projectDurationMs: project.durationMs,
  zoomEndMs: input.zoomRegions[0].endMs,
  annotationEndMs: input.annotationRegions[0].endMs,
  originalAudioEndMs: input.audioRegions[0].endMs,
  warnings: validation.warnings,
}, null, 2));

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
