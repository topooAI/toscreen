import {
  createProjectFromLegacyEditorState,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
  type LegacyEditorProjectInput,
} from "../src/components/video-editor/project";

const legacyInput: LegacyEditorProjectInput = {
  projectId: "project-camera-migration",
  projectName: "Camera Migration Contract",
  videoPath: "/tmp/toscreen-camera-migration-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-camera-migration.mov",
  companionAudioPath: null,
  durationSeconds: 11,
  projectDurationSeconds: 11,
  zoomRegions: [
    {
      id: "legacy-focus-zoom-1",
      startMs: 1000,
      endMs: 3600,
      depth: 5,
      focus: { cx: 0.22, cy: 0.38 },
    },
    {
      id: "legacy-focus-zoom-2",
      startMs: 3600,
      endMs: 6200,
      depth: 2,
      focus: { cx: 0.66, cy: 0.44 },
    },
  ],
  trimRegions: [],
  annotationRegions: [],
  audioRegions: [],
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

const project = createProjectFromLegacyEditorState(legacyInput);
const validation = validateVideoEditorProject(project);

if (!validation.valid) {
  fail("Generated ProjectModel is invalid.", validation);
}

const cameraTrack = project.tracks.find((track) => track.id === "track-camera-main");
if (!cameraTrack || cameraTrack.type !== "camera" || cameraTrack.name !== "Camera") {
  fail("Legacy Focus/Zoom regions must migrate into a Camera track without changing runtime UI semantics.", cameraTrack);
}

const cameraClips = project.clips.filter((clip) => clip.type === "camera");
if (cameraClips.length !== legacyInput.zoomRegions.length) {
  fail("Every legacy zoom region must map to exactly one Camera clip.", {
    expected: legacyInput.zoomRegions.length,
    actual: cameraClips.length,
  });
}

for (const region of legacyInput.zoomRegions) {
  const clip = cameraClips.find((candidate) => candidate.legacy?.regionId === region.id);
  if (!clip) {
    fail("Camera clip is missing legacy region identity.", region);
  }

  if (
    clip.props.mode !== "zoom" ||
    clip.startMs !== region.startMs ||
    clip.endMs !== region.endMs ||
    clip.props.depth !== region.depth ||
    clip.props.focus?.cx !== region.focus.cx ||
    clip.props.focus?.cy !== region.focus.cy ||
    clip.props.sourceRegion?.id !== region.id
  ) {
    fail("Camera clip does not preserve the legacy zoom region contract.", {
      region,
      clip,
    });
  }
}

const restored = restoreLegacyEditorStateFromProjectModel(project);
if (JSON.stringify(restored.zoomRegions) !== JSON.stringify(legacyInput.zoomRegions)) {
  fail("Restoring ProjectModel must return the original legacy zoom regions exactly.", {
    expected: legacyInput.zoomRegions,
    actual: restored.zoomRegions,
  });
}

console.log(JSON.stringify({
  status: "ok",
  cameraTrack: cameraTrack.id,
  cameraClips: cameraClips.length,
  legacyZoomRegions: legacyInput.zoomRegions.length,
  restoredZoomRegions: restored.zoomRegions.length,
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
