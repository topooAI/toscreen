import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const project: VideoEditorProject = {
  id: "project-multisource-smoke",
  schemaVersion: 1,
  name: "Multi-source Product Demo Smoke",
  durationMs: 12000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: {
      wallpaper: "/wallpapers/wallpaper1.jpg",
      showBlur: true,
    },
    padding: 54,
    borderRadius: 18,
    shadow: {
      intensity: 0.45,
    },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [
    {
      id: "asset-screen-main",
      type: "screen-recording",
      name: "Main product recording",
      sourceUrl: "file:///recordings/product-demo.mov",
      metadata: {
        role: "primary-screen",
      },
    },
    {
      id: "asset-digital-human-host",
      type: "digital-human",
      name: "AI presenter",
      sourceUrl: "toscreen://digital-human/host",
      metadata: {
        role: "presenter",
      },
    },
    {
      id: "asset-broll-product-shot",
      type: "video",
      name: "Product B-roll",
      sourceUrl: "file:///assets/product-broll.mp4",
      metadata: {
        role: "b-roll",
      },
    },
    {
      id: "asset-voice-main",
      type: "audio",
      name: "Presenter voice",
      sourceUrl: "file:///assets/presenter-voice.wav",
      metadata: {
        role: "presenter-voice",
      },
    },
  ],
  tracks: [
    { id: "track-video-main", type: "video", name: "Main Screen", order: 0 },
    { id: "track-camera-main", type: "camera", name: "Camera", order: 1 },
    { id: "track-presenter-main", type: "presenter", name: "Presenter", order: 2 },
    { id: "track-broll-main", type: "video", name: "B-roll", order: 3 },
  ],
  clips: [
    {
      id: "clip-screen-main",
      type: "screen-recording",
      trackId: "track-video-main",
      assetId: "asset-screen-main",
      startMs: 0,
      endMs: 12000,
      sourceStartMs: 0,
      sourceEndMs: 12000,
      name: "Main product recording",
      props: {
        fitMode: "contain",
        freezeAfterEnd: true,
      },
    },
    {
      id: "clip-camera-push-in",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 1600,
      endMs: 4600,
      name: "Feature push-in",
      props: {
        mode: "three-d",
        easing: "smooth",
        threeD: {
          rotateX: 4,
          rotateY: -8,
          rotateZ: 0,
          translateZ: 160,
          perspective: 1200,
          depthOfField: 0.25,
        },
      },
    },
    {
      id: "clip-presenter-host",
      type: "presenter",
      trackId: "track-presenter-main",
      assetId: "asset-digital-human-host",
      startMs: 0,
      endMs: 6200,
      name: "Corner AI presenter",
      props: {
        sourceKind: "digital-human",
        layout: "corner",
        transform: {
          x: 0.74,
          y: 0.58,
          width: 0.2,
          height: 0.34,
          opacity: 1,
          borderRadius: 24,
        },
        backgroundRemoval: true,
        eyeContactCorrection: true,
        voiceSync: {
          audioAssetId: "asset-voice-main",
        },
      },
    },
    {
      id: "clip-broll-cutaway",
      type: "video",
      trackId: "track-broll-main",
      assetId: "asset-broll-product-shot",
      startMs: 6200,
      endMs: 8800,
      sourceStartMs: 500,
      sourceEndMs: 3100,
      name: "Feature B-roll cutaway",
      props: {
        layout: "cutaway",
        transform: {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          opacity: 1,
        },
      },
    },
  ],
  scenes: [{
    id: "scene-demo-with-presenter",
    name: "Demo with presenter and B-roll",
    startMs: 0,
    endMs: 12000,
    purpose: "demo",
    clipIds: [
      "clip-screen-main",
      "clip-camera-push-in",
      "clip-presenter-host",
      "clip-broll-cutaway",
    ],
    aiSummary: "Product demo with a digital presenter, 3D camera emphasis, and a B-roll cutaway.",
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

const presenterClips = project.clips.filter((clip) => clip.type === "presenter").length;
const cameraClips = project.clips.filter((clip) => clip.type === "camera").length;
const brollClips = project.clips.filter((clip) => clip.assetId === "asset-broll-product-shot").length;

if (presenterClips !== 1 || cameraClips !== 1 || brollClips !== 1) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Expected one presenter, one camera, and one B-roll clip in the multi-source smoke project.",
    presenterClips,
    cameraClips,
    brollClips,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  assets: project.assets.length,
  tracks: project.tracks.length,
  clips: project.clips.length,
  presenterClips,
  cameraClips,
  brollClips,
  warnings: result.warnings,
}, null, 2));
