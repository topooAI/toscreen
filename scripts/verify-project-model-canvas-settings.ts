import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

function createValidProject(): VideoEditorProject {
  return {
    id: "project-canvas-settings-contract",
    schemaVersion: 1,
    name: "Canvas Settings Contract",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    durationMs: 8000,
    canvas: {
      aspectRatio: "16:9",
      background: {
        wallpaper: "linear-gradient(135deg, rgba(12,18,32,1), rgba(71,85,105,1))",
        showBlur: true,
      },
      padding: 56,
      borderRadius: 18,
      shadow: {
        intensity: 0.45,
      },
      cropRegion: {
        x: 0.05,
        y: 0.04,
        width: 0.9,
        height: 0.88,
      },
    },
    assets: [
      { id: "asset-screen", type: "screen-recording", name: "Screen", sourceUrl: "file:///screen.mov" },
    ],
    tracks: [
      { id: "track-video", type: "video", name: "Main Screen", order: 0 },
    ],
    clips: [
      {
        id: "clip-screen",
        type: "screen-recording",
        trackId: "track-video",
        assetId: "asset-screen",
        startMs: 0,
        endMs: 8000,
        sourceStartMs: 0,
        sourceEndMs: 8000,
        props: {
          fitMode: "contain",
          freezeAfterEnd: false,
          showBlackAfterEnd: true,
        },
      },
    ],
    scenes: [
      {
        id: "scene-demo",
        name: "Demo",
        startMs: 0,
        endMs: 8000,
        purpose: "demo",
        clipIds: ["clip-screen"],
      },
    ],
    exportSettings: {
      quality: "good",
    },
    legacyState: {
      motionBlurEnabled: false,
    },
  };
}

const validProject = createValidProject();
const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Valid canvas settings project should pass validation.", validResult);
}

const invalidProject = createValidProject() as unknown as Record<string, unknown>;
invalidProject.id = "project-canvas-settings-invalid";
invalidProject.canvas = {
  aspectRatio: "21:9",
  background: {
    wallpaper: "",
    showBlur: "yes",
  },
  padding: -1,
  borderRadius: Number.NaN,
  shadow: {
    intensity: -0.5,
  },
  cropRegion: {
    x: 0.8,
    y: 0,
    width: 0.4,
    height: 1,
  },
};
invalidProject.exportSettings = {
  quality: "high",
};
invalidProject.legacyState = {
  motionBlurEnabled: "true",
};

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrors = [
  "Project canvas aspectRatio is invalid or missing.",
  "Project canvas background.wallpaper is required.",
  "Project canvas background.showBlur must be boolean.",
  "Project canvas padding must be a finite non-negative number.",
  "Project canvas borderRadius must be a finite non-negative number.",
  "Project canvas shadow.intensity must be a finite non-negative number.",
  "Project canvas cropRegion.x + width must be no larger than 1.",
  "Project exportSettings.quality is invalid or missing.",
  "Project legacyState.motionBlurEnabled must be boolean.",
];

const missingExpectedErrors = expectedErrors.filter(
  (expectedError) => !invalidResult.errors.includes(expectedError),
);

if (invalidResult.valid || missingExpectedErrors.length > 0) {
  fail("Invalid canvas settings project should fail with expected errors.", {
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
