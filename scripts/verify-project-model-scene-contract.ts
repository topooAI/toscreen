import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

const baseProject: VideoEditorProject = {
  id: "project-scene-contract",
  schemaVersion: 1,
  name: "Scene Contract",
  durationMs: 12000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: { wallpaper: "/wallpapers/wallpaper1.jpg", showBlur: false },
    padding: 60,
    borderRadius: 20,
    shadow: { intensity: 0.5 },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [{
    id: "asset-screen",
    type: "screen-recording",
    name: "Screen",
    sourceUrl: "file:///recordings/screen.mov",
  }],
  tracks: [
    { id: "track-video", type: "video", name: "Video", order: 0 },
    { id: "track-camera", type: "camera", name: "Camera", order: 1 },
  ],
  clips: [
    {
      id: "clip-screen-hook",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 0,
      endMs: 4000,
      props: { fitMode: "contain" },
    },
    {
      id: "clip-camera-feature",
      type: "camera",
      trackId: "track-camera",
      startMs: 4000,
      endMs: 8000,
      props: { mode: "zoom", depth: 3, focus: { cx: 0.52, cy: 0.44 } },
    },
    {
      id: "clip-screen-result",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 8000,
      endMs: 12000,
      props: { fitMode: "contain", showBlackAfterEnd: true },
    },
  ],
  scenes: [
    {
      id: "scene-hook",
      name: "Hook",
      startMs: 0,
      endMs: 4000,
      purpose: "hook",
      clipIds: ["clip-screen-hook"],
      aiSummary: "Open with the core product promise.",
    },
    {
      id: "scene-feature",
      name: "Feature",
      startMs: 4000,
      endMs: 8000,
      purpose: "feature",
      clipIds: ["clip-camera-feature"],
      aiSummary: "Show the feature moment with a camera emphasis.",
    },
    {
      id: "scene-result",
      name: "Result",
      startMs: 8000,
      endMs: 12000,
      purpose: "result",
      clipIds: ["clip-screen-result"],
      aiSummary: "End on the visible result.",
    },
  ],
  aiEditPlans: [],
  exportSettings: { quality: "good" },
};

const validResult = validateVideoEditorProject(baseProject);
if (!validResult.valid) {
  fail("Expected valid sequential product-demo scenes.", { validation: validResult });
}

const invalidProject: VideoEditorProject = {
  ...baseProject,
  id: "project-scene-contract-invalid",
  scenes: [
    {
      id: "scene-invalid-negative",
      name: "",
      startMs: -100,
      endMs: 3000,
      purpose: "intro" as never,
      clipIds: ["clip-screen-hook", "clip-screen-hook"],
      aiSummary: 42 as never,
    },
    {
      id: "scene-hook",
      name: "Overlapping scene",
      startMs: 0,
      endMs: 4000,
      purpose: "hook",
      clipIds: ["clip-screen-hook"],
    },
    {
      id: "scene-hook",
      name: "Overlapping scene duplicate",
      startMs: 2500,
      endMs: 6500,
      purpose: "demo",
      clipIds: ["clip-screen-result"],
    },
  ],
};

const invalidResult = validateVideoEditorProject(invalidProject);
const requiredErrors = [
  "Scene scene-invalid-negative name is required.",
  "Scene scene-invalid-negative purpose is invalid or missing.",
  "Scene scene-invalid-negative startMs/endMs must be non-negative.",
  "Scene scene-invalid-negative has duplicate clip id clip-screen-hook.",
  "Scene scene-invalid-negative aiSummary must be a string.",
  "Duplicate scene id: scene-hook.",
  "Scene scene-hook references clip clip-screen-result outside its time range.",
  "Scenes scene-hook and scene-hook overlap.",
];
const missingErrors = requiredErrors.filter((message) => !invalidResult.errors.includes(message));
if (invalidResult.valid || missingErrors.length > 0) {
  fail("Expected invalid scene structure to be rejected.", {
    missingErrors,
    actualErrors: invalidResult.errors,
  });
}

console.log(JSON.stringify({
  status: "ok",
  validScenes: baseProject.scenes.map((scene) => ({
    id: scene.id,
    purpose: scene.purpose,
    startMs: scene.startMs,
    endMs: scene.endMs,
  })),
  rejectedErrors: requiredErrors,
  warnings: validResult.warnings,
}, null, 2));

function fail(message: string, details: Record<string, unknown>): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
