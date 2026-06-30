import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const validProject: VideoEditorProject = {
  id: "project-track-compatibility-smoke",
  schemaVersion: 1,
  name: "Track Compatibility Smoke",
  durationMs: 8000,
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
  assets: [
    {
      id: "asset-screen",
      type: "screen-recording",
      name: "Screen",
      sourceUrl: "file:///recordings/screen.mov",
    },
    {
      id: "asset-audio",
      type: "audio",
      name: "Voice",
      sourceUrl: "file:///recordings/voice.wav",
    },
    {
      id: "asset-image",
      type: "image",
      name: "Logo",
      sourceUrl: "file:///assets/logo.png",
    },
  ],
  tracks: [
    { id: "track-video", type: "video", name: "Video", order: 0 },
    { id: "track-camera", type: "camera", name: "Camera", order: 1 },
    { id: "track-annotation", type: "annotation", name: "Annotation", order: 2 },
    { id: "track-audio", type: "audio", name: "Audio", order: 3 },
    { id: "track-voice", type: "voice", name: "Voice", order: 4 },
    { id: "track-image", type: "image", name: "Image", order: 5 },
    { id: "track-cursor", type: "cursor", name: "Cursor", order: 6 },
  ],
  clips: [
    {
      id: "clip-screen",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 0,
      endMs: 8000,
      props: {
        fitMode: "contain",
      },
    },
    {
      id: "clip-camera",
      type: "camera",
      trackId: "track-camera",
      startMs: 1000,
      endMs: 3000,
      props: {
        mode: "zoom",
        depth: 2,
        focus: { cx: 0.5, cy: 0.5 },
      },
    },
    {
      id: "clip-annotation",
      type: "annotation",
      trackId: "track-annotation",
      startMs: 3000,
      endMs: 5000,
      props: {
        sourceRegion: {
          id: "annotation-1",
          type: "highlight",
          startMs: 3000,
          endMs: 5000,
          x: 0.2,
          y: 0.2,
          width: 0.2,
          height: 0.1,
          color: "#ffffff",
        },
      },
    },
    {
      id: "clip-audio",
      type: "audio",
      trackId: "track-voice",
      assetId: "asset-audio",
      startMs: 0,
      endMs: 8000,
      props: {
        sourceRegion: {
          id: "audio-1",
          startMs: 0,
          endMs: 8000,
          sourceStartMs: 0,
          sourceEndMs: 8000,
          sourceUrl: "file:///recordings/voice.wav",
          path: "/recordings/voice.wav",
          name: "Voice",
          volume: 1,
        },
      },
    },
    {
      id: "clip-image",
      type: "image",
      trackId: "track-image",
      assetId: "asset-image",
      startMs: 5000,
      endMs: 8000,
      props: {
        transform: {
          x: 0.8,
          y: 0.08,
          width: 0.12,
          height: 0.12,
          opacity: 1,
        },
      },
    },
    {
      id: "clip-cursor",
      type: "cursor",
      trackId: "track-cursor",
      startMs: 0,
      endMs: 8000,
      props: {
        points: [{
          timestamp: 0,
          x: 100,
          y: 100,
          cx: 0.2,
          cy: 0.2,
        }],
        size: 1.5,
        smoothing: true,
        vectorCursor: true,
        offsetMs: 0,
      },
    },
  ],
  scenes: [{
    id: "scene-track-compatibility",
    name: "Track compatibility",
    startMs: 0,
    endMs: 8000,
    purpose: "demo",
    clipIds: [
      "clip-screen",
      "clip-camera",
      "clip-annotation",
      "clip-audio",
      "clip-image",
      "clip-cursor",
    ],
  }],
  exportSettings: {
    quality: "good",
  },
};

const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Expected valid track-compatible project.",
    result: validResult,
  }, null, 2));
  process.exit(1);
}

const invalidProject = cloneProject(validProject);
invalidProject.clips = invalidProject.clips.map((clip) => (
  clip.id === "clip-camera" ? { ...clip, trackId: "track-video" } : clip
));

const invalidResult = validateVideoEditorProject(invalidProject);
const compatibilityErrors = invalidResult.errors.filter((error) => error.includes("cannot be placed on track"));

if (invalidResult.valid || compatibilityErrors.length !== 1) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Expected one track/clip compatibility error.",
    invalidResult,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  validClips: validProject.clips.length,
  compatibilityErrors,
  warnings: validResult.warnings,
}, null, 2));

function cloneProject(project: VideoEditorProject): VideoEditorProject {
  return JSON.parse(JSON.stringify(project)) as VideoEditorProject;
}
