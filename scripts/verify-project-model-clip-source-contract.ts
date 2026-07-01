import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

function createValidProject(): VideoEditorProject {
  return {
    id: "project-clip-source-contract",
    schemaVersion: 1,
    name: "Clip Source Contract",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    durationMs: 9000,
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
      { id: "asset-audio", type: "audio", name: "Audio", sourceUrl: "file:///audio.wav" },
    ],
    tracks: [
      { id: "track-video", type: "video", name: "Main Video", order: 0 },
      { id: "track-camera", type: "camera", name: "Camera", order: 1 },
      { id: "track-audio", type: "audio", name: "Audio", order: 2 },
    ],
    clips: [
      {
        id: "clip-screen",
        type: "screen-recording",
        trackId: "track-video",
        assetId: "asset-screen",
        startMs: 0,
        endMs: 9000,
        sourceStartMs: 0,
        sourceEndMs: 9000,
        name: "Main Clip",
        props: {
          fitMode: "contain",
          showBlackAfterEnd: true,
        },
        legacy: {
          source: "VideoEditor",
          regionId: "main-screen",
          regionType: "screen-recording",
        },
      },
      {
        id: "clip-camera",
        type: "camera",
        trackId: "track-camera",
        startMs: 1500,
        endMs: 4500,
        props: {
          mode: "zoom",
          depth: 2,
          focus: {
            cx: 0.5,
            cy: 0.45,
          },
          easing: "catmull-rom",
        },
        legacy: {
          source: "VideoEditor",
          regionId: "zoom-1",
          regionType: "zoom",
        },
      },
      {
        id: "clip-audio",
        type: "audio",
        trackId: "track-audio",
        assetId: "asset-audio",
        startMs: 0,
        endMs: 4000,
        sourceStartMs: 500,
        sourceEndMs: 4500,
        props: {
          sourceRegion: {
            id: "audio-1",
            startMs: 0,
            endMs: 4000,
            sourceUrl: "file:///audio.wav",
            sourceStartMs: 500,
            sourceEndMs: 4500,
            totalDurationMs: 9000,
            volume: 1,
          },
        },
        legacy: {
          source: "VideoEditor",
          regionId: "audio-1",
          regionType: "audio",
        },
      },
    ],
    scenes: [],
    exportSettings: {
      quality: "good",
    },
  };
}

const validProject = createValidProject();
const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Valid clip source contract project should pass validation.", validResult);
}

const invalidProject = createValidProject() as unknown as Record<string, unknown>;
invalidProject.id = "project-clip-source-contract-invalid";
invalidProject.clips = [
  {
    ...createValidProject().clips[0],
    id: "clip-source-missing",
    name: 123,
    trackId: "",
    assetId: 42,
    sourceStartMs: 200,
    sourceEndMs: undefined,
    legacy: {
      source: "Importer",
      regionId: 123,
      regionType: "subtitle",
    },
  },
  {
    ...createValidProject().clips[1],
    id: "clip-source-reversed",
    sourceStartMs: 5000,
    sourceEndMs: 1000,
  },
  {
    ...createValidProject().clips[2],
    id: "clip-legacy-not-object",
    startMs: 5000,
    endMs: 8500,
    legacy: "legacy-region",
  },
];

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrors = [
  "Clip clip-source-missing name must be a string.",
  "Clip clip-source-missing sourceStartMs/sourceEndMs must be provided together.",
  "Clip clip-source-missing legacy.source is invalid or missing.",
  "Clip clip-source-missing legacy.regionId must be a string.",
  "Clip clip-source-missing legacy.regionType is invalid.",
  "Clip clip-source-missing trackId is required.",
  "Clip clip-source-missing assetId must be a string.",
  "Clip clip-source-reversed source range endMs is before startMs.",
  "Clip clip-legacy-not-object legacy must be an object.",
];

const missingExpectedErrors = expectedErrors.filter(
  (expectedError) => !invalidResult.errors.includes(expectedError),
);

if (invalidResult.valid || missingExpectedErrors.length > 0) {
  fail("Invalid clip source contract project should fail with expected errors.", {
    missingExpectedErrors,
    errors: invalidResult.errors,
  });
}

console.log(JSON.stringify({
  status: "ok",
  checked: {
    validProject: validProject.id,
    validClips: validProject.clips.length,
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
