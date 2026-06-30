import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const project: VideoEditorProject = {
  id: "project-camera-smoke",
  schemaVersion: 1,
  name: "Camera Model Smoke",
  durationMs: 12000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: {
      wallpaper: "/wallpapers/wallpaper1.jpg",
      showBlur: false,
    },
    padding: 60,
    borderRadius: 20,
    shadow: {
      intensity: 0.5,
    },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [{
    id: "asset-screen-camera-smoke",
    type: "screen-recording",
    name: "Camera smoke screen recording",
    sourceUrl: "file:///recordings/camera-smoke.mov",
  }],
  tracks: [
    { id: "track-video-main", type: "video", name: "Main Screen", order: 0 },
    { id: "track-camera-main", type: "camera", name: "Camera", order: 1 },
  ],
  clips: [
    {
      id: "clip-screen-main",
      type: "screen-recording",
      trackId: "track-video-main",
      assetId: "asset-screen-camera-smoke",
      startMs: 0,
      endMs: 12000,
      sourceStartMs: 0,
      sourceEndMs: 12000,
      props: {
        fitMode: "contain",
        freezeAfterEnd: true,
      },
    },
    {
      id: "clip-camera-zoom",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 500,
      endMs: 2500,
      name: "Zoom to toolbar",
      props: {
        mode: "zoom",
        depth: 3,
        focus: { cx: 0.28, cy: 0.18 },
        easing: "smooth",
      },
    },
    {
      id: "clip-camera-pan",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 2500,
      endMs: 4400,
      name: "Pan to table",
      props: {
        mode: "pan",
        focus: { cx: 0.64, cy: 0.52 },
        easing: "catmull-rom",
      },
    },
    {
      id: "clip-camera-focus",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 4400,
      endMs: 6200,
      name: "Focus CTA",
      props: {
        mode: "focus",
        focus: { cx: 0.78, cy: 0.78 },
        easing: "spring",
      },
    },
    {
      id: "clip-camera-three-d",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 6200,
      endMs: 9800,
      name: "3D product camera",
      props: {
        mode: "three-d",
        easing: "smooth",
        threeD: {
          rotateX: 5,
          rotateY: -12,
          rotateZ: 0,
          translateZ: 180,
          perspective: 1200,
          depthOfField: 0.2,
        },
      },
    },
  ],
  scenes: [{
    id: "scene-camera-smoke",
    name: "Camera smoke scene",
    startMs: 0,
    endMs: 12000,
    purpose: "demo",
    clipIds: [
      "clip-screen-main",
      "clip-camera-zoom",
      "clip-camera-pan",
      "clip-camera-focus",
      "clip-camera-three-d",
    ],
    aiSummary: "Camera model smoke covering zoom, pan, focus, and 3D movement.",
  }],
  exportSettings: {
    quality: "good",
  },
};

const result = validateVideoEditorProject(project);

if (!result.valid) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

const cameraModes = new Set(project.clips.flatMap((clip) => (
  clip.type === "camera" ? [clip.props.mode] : []
)));
const expectedModes = ["zoom", "pan", "focus", "three-d"];
const missingModes = expectedModes.filter((mode) => !cameraModes.has(mode));

if (missingModes.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Camera smoke project is missing required camera modes.",
    missingModes,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  cameraClips: project.clips.filter((clip) => clip.type === "camera").length,
  cameraModes: expectedModes,
  warnings: result.warnings,
}, null, 2));
