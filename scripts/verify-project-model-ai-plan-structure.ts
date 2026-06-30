import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const validProject: VideoEditorProject = {
  id: "project-ai-plan-structure-smoke",
  schemaVersion: 1,
  name: "AI Plan Structure Smoke",
  durationMs: 10000,
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
      id: "clip-screen",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 0,
      endMs: 10000,
      props: {
        fitMode: "contain",
      },
    },
    {
      id: "clip-camera",
      type: "camera",
      trackId: "track-camera",
      startMs: 1200,
      endMs: 4200,
      props: {
        mode: "zoom",
        depth: 3,
        focus: { cx: 0.52, cy: 0.44 },
      },
    },
  ],
  scenes: [{
    id: "scene-demo",
    name: "Demo scene",
    startMs: 0,
    endMs: 10000,
    purpose: "demo",
    clipIds: ["clip-screen", "clip-camera"],
  }],
  aiEditPlans: [{
    id: "ai-plan-demo",
    createdAt: "2026-06-30T00:00:00.000Z",
    goal: "Tighten the product demo and emphasize the feature moment.",
    summary: "Add one camera emphasis and trim the opening pause.",
    status: "draft",
    steps: [
      {
        id: "ai-step-camera",
        type: "camera",
        target: {
          clipIds: ["clip-camera"],
          trackIds: ["track-camera"],
          sceneIds: ["scene-demo"],
          timeRangeMs: {
            startMs: 1200,
            endMs: 4200,
          },
        },
        params: {
          depth: 3,
        },
        rationale: "The feature interaction is visually small in the recording.",
        status: "draft",
      },
      {
        id: "ai-step-trim",
        type: "trim",
        target: {
          clipIds: ["clip-screen"],
          timeRangeMs: {
            startMs: 0,
            endMs: 600,
          },
        },
        params: {
          remove: true,
        },
        rationale: "The recording starts with a short pause.",
        status: "draft",
      },
    ],
  }],
  activeAIEditPlanId: "ai-plan-demo",
  exportSettings: {
    quality: "good",
  },
};

const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Expected valid AI edit plan project.", validResult);
}

const invalidProject = cloneProject(validProject);
invalidProject.aiEditPlans = invalidProject.aiEditPlans?.map((plan) => ({
  ...plan,
  status: "queued" as never,
  steps: plan.steps.map((step) => (
    step.id === "ai-step-camera"
      ? {
        ...step,
        type: "magic" as never,
        status: "waiting" as never,
        target: {
          ...step.target,
          timeRangeMs: {
            startMs: 5000,
            endMs: 1200,
          },
        },
      }
      : step
  )),
}));

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrorFragments = [
  "status is invalid or missing",
  "type is invalid or missing",
  "target timeRangeMs endMs is before startMs",
];
const missingFragments = expectedErrorFragments.filter((fragment) => (
  !invalidResult.errors.some((error) => error.includes(fragment))
));

if (invalidResult.valid || missingFragments.length > 0) {
  fail("Expected invalid AI edit plan structure errors.", {
    invalidResult,
    missingFragments,
  });
}

console.log(JSON.stringify({
  status: "ok",
  aiEditPlans: validProject.aiEditPlans?.length ?? 0,
  steps: validProject.aiEditPlans?.reduce((total, plan) => total + plan.steps.length, 0) ?? 0,
  invalidErrors: invalidResult.errors.filter((error) => (
    expectedErrorFragments.some((fragment) => error.includes(fragment))
  )),
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
