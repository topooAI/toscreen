import {
  validateVideoEditorProject,
  type AIEditPlan,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

const baseProject: VideoEditorProject = {
  id: "project-ai-plan-lifecycle",
  schemaVersion: 1,
  name: "AI Plan Lifecycle",
  durationMs: 10000,
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
      id: "clip-screen",
      type: "screen-recording",
      trackId: "track-video",
      assetId: "asset-screen",
      startMs: 0,
      endMs: 10000,
      props: { fitMode: "contain" },
    },
    {
      id: "clip-camera",
      type: "camera",
      trackId: "track-camera",
      startMs: 1200,
      endMs: 4200,
      props: { mode: "zoom", depth: 3, focus: { cx: 0.52, cy: 0.44 } },
    },
  ],
  scenes: [{
    id: "scene-demo",
    name: "Demo",
    startMs: 0,
    endMs: 10000,
    purpose: "demo",
    clipIds: ["clip-screen", "clip-camera"],
  }],
  aiEditPlans: [],
  exportSettings: { quality: "good" },
};

const validPlans: AIEditPlan[] = [
  plan("ai-plan-draft", "draft", ["draft", "draft"]),
  plan("ai-plan-reviewed", "reviewed", ["accepted", "rejected"]),
  plan("ai-plan-applied", "applied", ["applied", "rejected"]),
  plan("ai-plan-rejected", "rejected", ["rejected", "rejected"]),
];

for (const validPlan of validPlans) {
  const result = validateVideoEditorProject(projectWithPlan(validPlan));
  if (!result.valid) {
    fail("Expected valid AI plan lifecycle state.", {
      planStatus: validPlan.status,
      stepStatuses: validPlan.steps.map((step) => step.status),
      validation: result,
    });
  }
}

const invalidCases: Array<{ plan: AIEditPlan; expectedError: string }> = [
  {
    plan: plan("ai-plan-draft-invalid", "draft", ["draft", "accepted"]),
    expectedError: "AI edit plan ai-plan-draft-invalid draft plan can only contain draft steps.",
  },
  {
    plan: plan("ai-plan-reviewed-invalid", "reviewed", ["accepted", "draft"]),
    expectedError: "AI edit plan ai-plan-reviewed-invalid reviewed plan can only contain accepted or rejected steps.",
  },
  {
    plan: plan("ai-plan-applied-invalid", "applied", ["accepted", "rejected"]),
    expectedError: "AI edit plan ai-plan-applied-invalid applied plan can only contain applied or rejected steps.",
  },
  {
    plan: plan("ai-plan-applied-empty-invalid", "applied", ["rejected", "rejected"]),
    expectedError: "AI edit plan ai-plan-applied-empty-invalid applied plan must contain at least one applied step.",
  },
  {
    plan: plan("ai-plan-rejected-invalid", "rejected", ["rejected", "applied"]),
    expectedError: "AI edit plan ai-plan-rejected-invalid rejected plan can only contain rejected steps.",
  },
];

for (const invalidCase of invalidCases) {
  const result = validateVideoEditorProject(projectWithPlan(invalidCase.plan));
  if (result.valid || !result.errors.includes(invalidCase.expectedError)) {
    fail("Expected invalid AI plan lifecycle state to be rejected.", {
      planStatus: invalidCase.plan.status,
      stepStatuses: invalidCase.plan.steps.map((step) => step.status),
      expectedError: invalidCase.expectedError,
      validation: result,
    });
  }
}

console.log(JSON.stringify({
  status: "ok",
  validStates: validPlans.map((validPlan) => ({
    planStatus: validPlan.status,
    stepStatuses: validPlan.steps.map((step) => step.status),
  })),
  rejectedStates: invalidCases.map((invalidCase) => invalidCase.expectedError),
}, null, 2));

function plan(id: string, status: AIEditPlan["status"], stepStatuses: AIEditPlan["steps"][number]["status"][]): AIEditPlan {
  return {
    id,
    createdAt: "2026-06-30T00:00:00.000Z",
    goal: "Create a reviewable product-demo edit plan.",
    summary: "Lifecycle state fixture.",
    status,
    steps: stepStatuses.map((stepStatus, index) => ({
      id: `${id}-step-${index + 1}`,
      type: index === 0 ? "camera" : "trim",
      target: {
        clipIds: [index === 0 ? "clip-camera" : "clip-screen"],
        timeRangeMs: { startMs: index === 0 ? 1200 : 0, endMs: index === 0 ? 4200 : 600 },
      },
      status: stepStatus,
    })),
  };
}

function projectWithPlan(aiPlan: AIEditPlan): VideoEditorProject {
  return {
    ...baseProject,
    id: `project-${aiPlan.id}`,
    aiEditPlans: [aiPlan],
    activeAIEditPlanId: aiPlan.id,
  };
}

function fail(message: string, details: Record<string, unknown>): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
