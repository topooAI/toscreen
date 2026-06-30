import {
  validateVideoEditorProject,
  type ProjectClip,
  type ProjectTrack,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

type Case = {
  clipType: ProjectClip["type"];
  trackType: ProjectTrack["type"];
  props: ProjectClip["props"];
};

const cases: Case[] = [
  { clipType: "screen-recording", trackType: "video", props: { fitMode: "contain", showBlackAfterEnd: true } },
  { clipType: "video", trackType: "video", props: {} },
  { clipType: "camera", trackType: "camera", props: { mode: "zoom", depth: 2, focus: { cx: 0.5, cy: 0.5 } } },
  {
    clipType: "presenter",
    trackType: "presenter",
    props: {
      sourceKind: "camera",
      layout: "corner",
      transform: { x: 0.72, y: 0.68, width: 0.22, height: 0.22, opacity: 1 },
    },
  },
  { clipType: "text", trackType: "text", props: { text: "Value prop" } },
  { clipType: "annotation", trackType: "annotation", props: { sourceRegion: {} } },
  {
    clipType: "lottie",
    trackType: "lottie",
    props: {
      playback: { loop: false, speed: 1, direction: 1 },
      transform: { x: 0.4, y: 0.4, width: 0.2, height: 0.2, rotation: 0, opacity: 1 },
    },
  },
  { clipType: "image", trackType: "image", props: { fitMode: "contain" } },
  {
    clipType: "ui-element-motion",
    trackType: "ui-motion",
    props: { uiSourceId: "ui-source-1", elementId: "button-1", action: "highlight" },
  },
  { clipType: "audio", trackType: "audio", props: { sourceRegion: {} } },
  { clipType: "cursor", trackType: "cursor", props: { points: [], size: 1.5, smoothing: true, vectorCursor: true, offsetMs: 0 } },
];

const failures: Array<Record<string, unknown>> = [];

for (const testCase of cases) {
  const overlapping = projectFor(testCase, [
    { id: `${testCase.clipType}-a`, trackId: "track-1", startMs: 1000, endMs: 5000 },
    { id: `${testCase.clipType}-b`, trackId: "track-1", startMs: 3000, endMs: 7000 },
  ]);
  const overlappingValidation = validateVideoEditorProject(overlapping);
  const overlapError = overlappingValidation.errors.find((error) => (
    error.includes("Track track-1 has overlapping clips")
  ));

  if (!overlapError) {
    failures.push({
      clipType: testCase.clipType,
      mode: "same-track-overlap",
      expected: "validator error",
      validation: overlappingValidation,
    });
  }

  const adjacent = projectFor(testCase, [
    { id: `${testCase.clipType}-a`, trackId: "track-1", startMs: 1000, endMs: 5000 },
    { id: `${testCase.clipType}-b`, trackId: "track-1", startMs: 5000, endMs: 7000 },
  ]);
  const adjacentValidation = validateVideoEditorProject(adjacent);
  if (!adjacentValidation.valid) {
    failures.push({
      clipType: testCase.clipType,
      mode: "same-track-adjacent",
      expected: "valid touching edges",
      validation: adjacentValidation,
    });
  }

  const wrapped = projectFor(testCase, [
    { id: `${testCase.clipType}-a`, trackId: "track-1", startMs: 1000, endMs: 5000 },
    { id: `${testCase.clipType}-b`, trackId: "track-2", startMs: 3000, endMs: 7000 },
  ], true);
  const wrappedValidation = validateVideoEditorProject(wrapped);
  if (!wrappedValidation.valid) {
    failures.push({
      clipType: testCase.clipType,
      mode: "same-type-child-lane",
      expected: "valid wrapped overlap on sibling lane",
      validation: wrappedValidation,
    });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "ProjectModel clip overlap policy is incomplete.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checkedClipTypes: cases.map((testCase) => testCase.clipType),
  policy: [
    "Same-track overlap is invalid for every editable clip type.",
    "Touching clip edges are allowed.",
    "Overlap is allowed only after wrapping onto a same-type child lane.",
  ],
}, null, 2));

function projectFor(
  testCase: Case,
  spans: Array<{ id: string; trackId: string; startMs: number; endMs: number }>,
  withChildLane = false,
): VideoEditorProject {
  const tracks: ProjectTrack[] = [
    { id: "track-1", type: testCase.trackType, name: `${testCase.trackType} 1`, order: 1 },
  ];

  if (withChildLane) {
    tracks.push({
      id: "track-2",
      type: testCase.trackType,
      name: `${testCase.trackType} 2`,
      order: 2,
      parentId: "track-1",
    });
  }

  return {
    id: `project-overlap-${testCase.clipType}`,
    schemaVersion: 1,
    name: `Overlap Policy ${testCase.clipType}`,
    durationMs: 8000,
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
    assets: [],
    uiSources: [
      {
        id: "ui-source-1",
        name: "Demo UI",
        provider: "manual",
        elements: [{ id: "button-1", name: "Create", role: "button" }],
      },
    ],
    tracks,
    clips: spans.map((span) => ({
      id: span.id,
      type: testCase.clipType,
      trackId: span.trackId,
      startMs: span.startMs,
      endMs: span.endMs,
      props: testCase.props,
    } as ProjectClip)),
    scenes: [],
    exportSettings: { quality: "good" },
  };
}
