import {
  createProjectFromLegacyEditorState,
  validateVideoEditorProject,
  type LegacyEditorProjectInput,
} from "../src/components/video-editor/project";

const input: LegacyEditorProjectInput = {
  projectId: "project-lane-wrapping",
  projectName: "Lane Wrapping Smoke",
  videoPath: "/tmp/toscreen-lane-wrapping-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-lane-wrapping.mov",
  companionAudioPath: "/tmp/toscreen-lane-wrapping-audio.mov",
  durationSeconds: 12,
  projectDurationSeconds: 12,
  zoomRegions: [
    { id: "zoom-1", startMs: 1000, endMs: 4200, depth: 2, focus: { cx: 0.35, cy: 0.4 } },
    { id: "zoom-2", startMs: 2600, endMs: 6200, depth: 4, focus: { cx: 0.72, cy: 0.58 } },
  ],
  trimRegions: [],
  annotationRegions: [
    annotation("annotation-1", 1800, 4400),
    annotation("annotation-2", 3000, 5200),
  ],
  audioRegions: [
    audio("audio-1", 0, 7000, "/tmp/toscreen-lane-audio-1.wav"),
    audio("audio-2", 3200, 9000, "/tmp/toscreen-lane-audio-2.wav"),
  ],
  cursorData: [],
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorOffset: 0,
  cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  wallpaper: "/wallpapers/wallpaper1.jpg",
  shadowIntensity: 0.5,
  showBlur: false,
  motionBlurEnabled: true,
  borderRadius: 20,
  padding: 60,
  aspectRatio: "16:9",
  exportQuality: "good",
  now: new Date("2026-06-30T00:00:00.000Z"),
};

const project = createProjectFromLegacyEditorState(input);
const validation = validateVideoEditorProject(project);

if (!validation.valid) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Expected lane-wrapped ProjectModel to validate.",
    validation,
  }, null, 2));
  process.exit(1);
}

const laneSummary = summarizeTrackLanes(project);
const expectedLaneCounts = {
  camera: 2,
  annotation: 2,
  audio: 2,
};

const failures = Object.entries(expectedLaneCounts).filter(([trackType, expected]) => (
  laneSummary[trackType] !== expected
));

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Expected overlapping legacy regions to be wrapped onto same-type child lanes.",
    laneSummary,
    expectedLaneCounts,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  tracks: project.tracks.length,
  clips: project.clips.length,
  laneSummary,
  warnings: validation.warnings,
}, null, 2));

function annotation(id: string, startMs: number, endMs: number): LegacyEditorProjectInput["annotationRegions"][number] {
  return {
    id,
    type: "text",
    startMs,
    endMs,
    content: id,
    textContent: id,
    position: { x: 24, y: 24 },
    size: { width: 30, height: 12 },
    style: {
      color: "#ffffff",
      backgroundColor: "rgba(15,23,42,0.72)",
      fontSize: 28,
      fontFamily: "Inter",
      fontWeight: "bold",
      fontStyle: "normal",
      textDecoration: "none",
      textAlign: "center",
    },
    zIndex: 1,
  };
}

function audio(
  id: string,
  startMs: number,
  endMs: number,
  path: string,
): LegacyEditorProjectInput["audioRegions"][number] {
  return {
    id,
    startMs,
    endMs,
    sourceStartMs: 0,
    sourceEndMs: endMs - startMs,
    totalDurationMs: endMs - startMs,
    sourceUrl: `file://${path}`,
    path,
    volume: 1,
    isOriginal: false,
    isDetached: true,
    name: id,
  };
}

function summarizeTrackLanes(project: ReturnType<typeof createProjectFromLegacyEditorState>) {
  return project.tracks.reduce<Record<string, number>>((summary, track) => {
    summary[track.type] = (summary[track.type] ?? 0) + 1;
    return summary;
  }, {});
}
