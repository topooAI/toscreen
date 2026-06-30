import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

function createValidProject(): VideoEditorProject {
  return {
    id: "project-core-clip-contract",
    schemaVersion: 1,
    name: "Core Clip Contract",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    durationMs: 8000,
    canvas: {
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      background: { type: "color", value: "#000000" },
    },
    assets: [
      { id: "asset-screen", type: "screen-recording", name: "Screen", sourceUrl: "file:///screen.mov" },
      { id: "asset-audio", type: "audio", name: "Original Audio", sourceUrl: "file:///screen.wav" },
      { id: "asset-cursor", type: "cursor-data", name: "Cursor", sourceUrl: "cursor://recording" },
    ],
    tracks: [
      { id: "track-video", type: "video", name: "Main Screen", order: 0 },
      { id: "track-audio", type: "audio", name: "Audio", order: 1 },
      { id: "track-cursor", type: "cursor", name: "Cursor", order: 2 },
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
          crop: { x: 0, y: 0, width: 1, height: 1 },
          trimRegions: [{ id: "trim-1", startMs: 1000, endMs: 1600 }],
          fitMode: "contain",
          freezeAfterEnd: true,
          showBlackAfterEnd: true,
          companionAudioAssetId: "asset-audio",
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
            sourceUrl: "file:///screen.wav",
            path: "/tmp/screen.wav",
            sourceStartMs: 0,
            sourceEndMs: 8000,
            totalDurationMs: 8000,
            volume: 1,
            isMuted: false,
            isOriginal: true,
            isDetached: false,
            trackIndex: 0,
            audioPeaks: [0, 0.5, 1],
            audioPeaksDurationMs: 8000,
            volumeKeyframes: [
              { id: "volume-1", timeRatio: 0, volume: 1 },
              { id: "volume-2", timeRatio: 1, volume: 0.8 },
            ],
          },
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
          points: [
            {
              timestamp: 0,
              absoluteTime: 1000,
              x: 120,
              y: 180,
              cx: 0.25,
              cy: 0.35,
              isClick: false,
            },
            {
              timestamp: 400,
              x: 220,
              y: 280,
              cx: 0.45,
              cy: 0.55,
              isClick: true,
            },
          ],
          size: 1.4,
          smoothing: true,
          vectorCursor: true,
          offsetMs: -180,
        },
      },
    ],
    scenes: [],
  };
}

const validProject = createValidProject();
const validResult = validateVideoEditorProject(validProject);

if (!validResult.valid) {
  console.error(JSON.stringify({
    status: "failed",
    reason: "Valid core clip project should pass validation.",
    errors: validResult.errors,
  }, null, 2));
  process.exit(1);
}

const invalidProject: VideoEditorProject = {
  ...createValidProject(),
  id: "project-core-clip-contract-invalid",
  clips: [
    {
      ...createValidProject().clips[0],
      id: "clip-screen-invalid",
      props: {
        fitMode: "stretch",
        freezeAfterEnd: "yes",
        showBlackAfterEnd: "no",
        crop: { x: 0.8, y: 0, width: 0.4, height: -1 },
        trimRegions: [{ id: "", startMs: 2000, endMs: 1000 }],
        companionAudioAssetId: "asset-screen",
      },
    },
    {
      ...createValidProject().clips[1],
      id: "clip-audio-invalid",
      props: {
        sourceRegion: {
          id: "",
          startMs: 3000,
          endMs: 2000,
          sourceUrl: "",
          sourceStartMs: 5000,
          sourceEndMs: 1000,
          totalDurationMs: -1,
          volume: -0.5,
          isMuted: "false",
          isOriginal: "true",
          isDetached: "false",
          trackIndex: -1,
          audioPeaks: [0, Number.NaN],
          audioPeaksDurationMs: -1,
          volumeKeyframes: [{ id: "", timeRatio: 1.2, volume: -1 }],
        },
      },
    },
    {
      ...createValidProject().clips[2],
      id: "clip-cursor-invalid",
      props: {
        points: [
          {
            timestamp: Number.NaN,
            absoluteTime: "1000",
            x: 120,
            y: Number.POSITIVE_INFINITY,
            cx: "0.5",
            cy: 0.25,
            isClick: "yes",
          },
        ],
        size: 0,
        smoothing: "true",
        vectorCursor: "false",
        offsetMs: Number.NaN,
      },
    },
  ],
};

const invalidResult = validateVideoEditorProject(invalidProject);
const expectedErrors = [
  "Screen recording clip clip-screen-invalid fitMode is invalid or missing.",
  "Screen recording clip clip-screen-invalid companionAudioAssetId must reference an audio asset.",
  "Screen recording clip clip-screen-invalid crop.x + width must be no larger than 1.",
  "Screen recording clip clip-screen-invalid trimRegions[0] endMs is before startMs.",
  "Audio clip clip-audio-invalid sourceRegion must include sourceUrl or path.",
  "Audio clip clip-audio-invalid sourceRegion source range endMs is before startMs.",
  "Audio clip clip-audio-invalid sourceRegion.volume must be a finite non-negative number.",
  "Cursor clip clip-cursor-invalid points[0].timestamp must be finite.",
  "Cursor clip clip-cursor-invalid size must be positive.",
  "Cursor clip clip-cursor-invalid offsetMs must be finite.",
];

const missingExpectedErrors = expectedErrors.filter(
  (expectedError) => !invalidResult.errors.includes(expectedError),
);

if (invalidResult.valid || missingExpectedErrors.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    reason: "Invalid core clip project should fail with expected errors.",
    missingExpectedErrors,
    errors: invalidResult.errors,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  validClips: validProject.clips.map((clip) => clip.type),
  invalidErrorsChecked: expectedErrors.length,
}, null, 2));
