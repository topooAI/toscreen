import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

function createValidProject(): VideoEditorProject {
  return {
    id: "project-entity-schema-contract",
    schemaVersion: 1,
    name: "Entity Schema Contract",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    durationMs: 6000,
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
      cropRegion: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    },
    assets: [
      { id: "asset-screen", type: "screen-recording", name: "Screen", sourceUrl: "file:///screen.mov" },
      { id: "asset-cursor", type: "cursor-data", name: "Cursor", sourceUrl: "cursor://recording" },
    ],
    tracks: [
      { id: "track-video", type: "video", name: "Main Screen", order: 0 },
      { id: "track-cursor", type: "cursor", name: "Cursor", order: 1 },
    ],
    clips: [
      {
        id: "clip-screen",
        type: "screen-recording",
        trackId: "track-video",
        assetId: "asset-screen",
        startMs: 0,
        endMs: 6000,
        props: {
          fitMode: "contain",
          showBlackAfterEnd: true,
        },
      },
      {
        id: "clip-cursor",
        type: "cursor",
        trackId: "track-cursor",
        assetId: "asset-cursor",
        startMs: 0,
        endMs: 6000,
        props: {
          points: [{
            timestamp: 0,
            x: 120,
            y: 240,
            cx: 0.2,
            cy: 0.4,
            isClick: false,
          }],
          size: 1.5,
          smoothing: true,
          vectorCursor: true,
          offsetMs: -150,
        },
      },
    ],
    scenes: [{
      id: "scene-demo",
      name: "Demo",
      startMs: 0,
      endMs: 6000,
      purpose: "demo",
      clipIds: ["clip-screen", "clip-cursor"],
    }],
    aiEditPlans: [{
      id: "plan-draft",
      createdAt: "2026-07-01T00:00:00.000Z",
      goal: "Draft plan",
      status: "draft",
      steps: [{
        id: "step-draft",
        type: "camera",
        status: "draft",
      }],
    }],
    activeAIEditPlanId: "plan-draft",
    exportSettings: {
      quality: "good",
    },
  };
}

const validProject = createValidProject();
const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Valid entity-schema project should pass validation.", validResult);
}

const invalidProject = createValidProject() as unknown as Record<string, unknown>;
invalidProject.id = 42;
invalidProject.name = "";
invalidProject.createdAt = "";
invalidProject.updatedAt = 123;
invalidProject.activeAIEditPlanId = 99;
invalidProject.assets = [
  { id: "", type: "spreadsheet", name: "", sourceUrl: "file:///bad.xlsx" },
];
invalidProject.tracks = [
  { id: "", type: "spreadsheet", name: "", order: Number.NaN },
];
invalidProject.clips = [
  {
    id: "",
    type: "spreadsheet",
    trackId: "missing-track",
    startMs: 0,
    endMs: 1000,
    props: {},
  },
];
invalidProject.scenes = [];
invalidProject.aiEditPlans = [];

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrors = [
  "Project id is required.",
  "Project name is required.",
  "Project createdAt is required.",
  "Project updatedAt is required.",
  "Project activeAIEditPlanId must be a string.",
  "Asset id is required.",
  "Asset (missing id) type is invalid or missing.",
  "Asset (missing id) name is required.",
  "Track id is required.",
  "Track (missing id) type is invalid or missing.",
  "Track (missing id) name is required.",
  "Clip id is required.",
  "Clip (missing id) type is invalid or missing.",
];

const missingExpectedErrors = expectedErrors.filter(
  (expectedError) => !invalidResult.errors.includes(expectedError),
);

if (invalidResult.valid || missingExpectedErrors.length > 0) {
  fail("Invalid entity-schema project should fail with expected errors.", {
    missingExpectedErrors,
    errors: invalidResult.errors,
  });
}

console.log(JSON.stringify({
  status: "ok",
  checked: {
    validProject: validProject.id,
    invalidErrors: expectedErrors.length,
  },
}, null, 2));

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
