import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

function createValidProject(): VideoEditorProject {
  return {
    id: "project-ui-source-schema-contract",
    schemaVersion: 1,
    name: "UI Source Schema Contract",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    durationMs: 5000,
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
      {
        id: "asset-ui-source",
        type: "ui-source",
        name: "UI Source",
        sourceUrl: "figma://file/demo",
      },
    ],
    uiSources: [{
      id: "ui-source-product",
      name: "Product UI Source",
      provider: "figma",
      sourceUrl: "figma://file/demo",
      filePath: "/tmp/product-ui.fig",
      capturedAt: "2026-07-01T00:00:00.000Z",
      elements: [{
        id: "button-submit",
        name: "Submit button",
        role: "button",
        stableSelector: "[data-testid='submit']",
        bounds: {
          x: 120,
          y: 240,
          width: 180,
          height: 48,
        },
      }],
    }],
    tracks: [
      { id: "track-ui-motion", type: "ui-motion", name: "UI Motion", order: 0 },
    ],
    clips: [
      {
        id: "clip-ui-motion",
        type: "ui-element-motion",
        trackId: "track-ui-motion",
        assetId: "asset-ui-source",
        startMs: 0,
        endMs: 3000,
        props: {
          uiSourceId: "ui-source-product",
          elementId: "button-submit",
          action: "highlight",
          from: {
            opacity: 0.4,
          },
          to: {
            opacity: 1,
            width: 220,
            height: 56,
          },
          easing: "smooth",
        },
      },
    ],
    scenes: [{
      id: "scene-demo",
      name: "Demo",
      startMs: 0,
      endMs: 5000,
      purpose: "demo",
      clipIds: ["clip-ui-motion"],
    }],
    exportSettings: {
      quality: "good",
    },
  };
}

const validProject = createValidProject();
const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Valid UI source schema project should pass validation.", validResult);
}

const invalidProject = createValidProject() as unknown as Record<string, unknown>;
invalidProject.id = "project-ui-source-schema-invalid";
invalidProject.uiSources = [{
  id: "",
  name: "",
  provider: "photoshop",
  sourceUrl: 123,
  filePath: 456,
  capturedAt: 789,
  elements: [{
    id: "",
    name: 123,
    role: "table-cell",
    stableSelector: 456,
    bounds: {
      x: Number.NaN,
      y: 10,
      width: 0,
      height: -4,
    },
  }],
}];

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrors = [
  "UI source id is required.",
  "UI source (missing id) name is required.",
  "UI source (missing id) provider is invalid or missing.",
  "UI source (missing id) sourceUrl must be a string.",
  "UI source (missing id) filePath must be a string.",
  "UI source (missing id) capturedAt must be a string.",
  "UI source (missing id) element id is required.",
  "UI source (missing id) element (missing id) name must be a string.",
  "UI source (missing id) element (missing id) stableSelector must be a string.",
  "UI source (missing id) element (missing id) role is invalid.",
  "UI source (missing id) element (missing id) bounds.x must be finite.",
  "UI source (missing id) element (missing id) bounds.width must be positive.",
  "UI source (missing id) element (missing id) bounds.height must be positive.",
  "Clip clip-ui-motion references missing UI source ui-source-product.",
];

const missingExpectedErrors = expectedErrors.filter(
  (expectedError) => !invalidResult.errors.includes(expectedError),
);

if (invalidResult.valid || missingExpectedErrors.length > 0) {
  fail("Invalid UI source schema project should fail with expected errors.", {
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
