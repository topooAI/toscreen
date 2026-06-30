import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const validProject: VideoEditorProject = {
  id: "project-asset-compatibility-smoke",
  schemaVersion: 1,
  name: "Asset Compatibility Smoke",
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
    { id: "asset-screen", type: "screen-recording", name: "Screen", sourceUrl: "file:///screen.mov" },
    { id: "asset-video", type: "video", name: "B-roll", sourceUrl: "file:///broll.mp4" },
    { id: "asset-audio", type: "audio", name: "Voice", sourceUrl: "file:///voice.wav" },
    { id: "asset-image", type: "image", name: "Logo", sourceUrl: "file:///logo.png" },
    { id: "asset-lottie", type: "lottie", name: "CTA", sourceUrl: "file:///cta.json" },
    { id: "asset-digital-human", type: "digital-human", name: "Presenter", sourceUrl: "toscreen://digital-human/host" },
    { id: "asset-cursor", type: "cursor-data", name: "Cursor", sourceUrl: "toscreen://cursor/data" },
  ],
  tracks: [
    { id: "track-video", type: "video", name: "Video", order: 0 },
    { id: "track-presenter", type: "presenter", name: "Presenter", order: 1 },
    { id: "track-audio", type: "audio", name: "Audio", order: 2 },
    { id: "track-image", type: "image", name: "Image", order: 3 },
    { id: "track-lottie", type: "lottie", name: "Lottie", order: 4 },
    { id: "track-cursor", type: "cursor", name: "Cursor", order: 5 },
  ],
  clips: [
    {
      id: "clip-screen",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 0,
      endMs: 2000,
      props: { fitMode: "contain" },
    },
    {
      id: "clip-video",
      type: "video",
      trackId: "track-video",
      assetId: "asset-video",
      startMs: 2000,
      endMs: 4000,
      props: {},
    },
    {
      id: "clip-presenter",
      type: "presenter",
      trackId: "track-presenter",
      assetId: "asset-digital-human",
      startMs: 0,
      endMs: 3000,
      props: {
        sourceKind: "digital-human",
        layout: "corner",
        transform: { x: 0.72, y: 0.58, width: 0.2, height: 0.32, opacity: 1 },
      },
    },
    {
      id: "clip-audio",
      type: "audio",
      trackId: "track-audio",
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
          sourceUrl: "file:///voice.wav",
          path: "/voice.wav",
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
      startMs: 4000,
      endMs: 6000,
      props: {},
    },
    {
      id: "clip-lottie",
      type: "lottie",
      trackId: "track-lottie",
      assetId: "asset-lottie",
      startMs: 6000,
      endMs: 7600,
      props: {
        playback: { loop: false, speed: 1, direction: 1 },
        transform: { x: 0.4, y: 0.4, width: 0.2, height: 0.2, rotation: 0, opacity: 1 },
      },
    },
    {
      id: "clip-cursor",
      type: "cursor",
      trackId: "track-cursor",
      assetId: "asset-cursor",
      startMs: 0,
      endMs: 8000,
      props: {
        points: [{ timestamp: 0, x: 100, y: 100, cx: 0.1, cy: 0.1 }],
        size: 1.5,
        smoothing: true,
        vectorCursor: true,
        offsetMs: 0,
      },
    },
  ],
  scenes: [{
    id: "scene-asset-compatibility",
    name: "Asset compatibility",
    startMs: 0,
    endMs: 8000,
    purpose: "demo",
    clipIds: [
      "clip-screen",
      "clip-video",
      "clip-presenter",
      "clip-audio",
      "clip-image",
      "clip-lottie",
      "clip-cursor",
    ],
  }],
  exportSettings: {
    quality: "good",
  },
};

const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Expected valid asset-compatible project.", validResult);
}

const invalidProject = cloneProject(validProject);
invalidProject.clips = invalidProject.clips.map((clip) => (
  clip.id === "clip-audio" ? { ...clip, assetId: "asset-image" } : clip
));

const invalidResult = validateVideoEditorProject(invalidProject);
const compatibilityErrors = invalidResult.errors.filter((error) => error.includes("cannot reference asset"));

if (invalidResult.valid || compatibilityErrors.length !== 1) {
  fail("Expected one asset/clip compatibility error.", invalidResult);
}

console.log(JSON.stringify({
  status: "ok",
  validAssets: validProject.assets.length,
  validClips: validProject.clips.length,
  compatibilityErrors,
  warnings: validResult.warnings,
}, null, 2));

function cloneProject(project: VideoEditorProject): VideoEditorProject {
  return JSON.parse(JSON.stringify(project)) as VideoEditorProject;
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
