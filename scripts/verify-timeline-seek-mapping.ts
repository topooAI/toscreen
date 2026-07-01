import fs from "node:fs";
import path from "node:path";
import { resolveTimelineSeekFromClientX } from "../src/components/video-editor/timeline/timelineSeekMapping";

function assertSeek(
  label: string,
  actual: { effectiveMs: number; sourceMs: number; isBreathingArea: boolean },
  expected: { effectiveMs: number; sourceMs: number; isBreathingArea: boolean },
) {
  if (
    actual.effectiveMs !== expected.effectiveMs
    || actual.sourceMs !== expected.sourceMs
    || actual.isBreathingArea !== expected.isBreathingArea
  ) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const baseOptions = {
  timelineLeftPx: 100,
  trackStartPx: 156,
  rangeStartMs: 0,
  durationMs: 10_000,
  pixelsToValue: (pixels: number) => pixels * 10,
};

assertSeek(
  "left breathing area resets to zero",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 240,
  }),
  { effectiveMs: 0, sourceMs: 0, isBreathingArea: true },
);

assertSeek(
  "track origin maps to zero",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 256,
  }),
  { effectiveMs: 0, sourceMs: 0, isBreathingArea: false },
);

assertSeek(
  "track click maps through pixelsToValue",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 556,
  }),
  { effectiveMs: 3000, sourceMs: 3000, isBreathingArea: false },
);

assertSeek(
  "visible range start offsets effective time",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    rangeStartMs: 2000,
    clientX: 556,
  }),
  { effectiveMs: 5000, sourceMs: 5000, isBreathingArea: false },
);

assertSeek(
  "seek clamps to project duration",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 2000,
  }),
  { effectiveMs: 10_000, sourceMs: 10_000, isBreathingArea: false },
);

assertSeek(
  "trim-folded effective time maps to source time",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 556,
    mapEffectiveToSource: (ms) => ms + 1500,
  }),
  { effectiveMs: 3000, sourceMs: 4500, isBreathingArea: false },
);

assertSeek(
  "trim-folded source time is not capped by project duration",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 2000,
    mapEffectiveToSource: (ms) => ms + 2500,
  }),
  { effectiveMs: 10_000, sourceMs: 12_500, isBreathingArea: false },
);

assertSeek(
  "visible trim track keeps effective time as source time",
  resolveTimelineSeekFromClientX({
    ...baseOptions,
    clientX: 556,
    mapEffectiveToSource: (ms) => ms + 1500,
    isTrimTrackVisible: true,
  }),
  { effectiveMs: 3000, sourceMs: 3000, isBreathingArea: false },
);

const repoRoot = process.cwd();
const timelineEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineEditor.tsx",
);
const timelineEditor = fs.readFileSync(timelineEditorPath, "utf8");

const requiredNeedles = [
  'import { resolveTimelineSeekFromClientX } from "./timelineSeekMapping"',
  "resolveTimelineSeekFromClientX({",
  "clientX: e.clientX",
  "timelineLeftPx: rect.left",
  "trackStartPx",
  "rangeStartMs: range.start",
  "durationMs: videoDurationMs",
  "pixelsToValue",
  "mapEffectiveToSource",
  "isTrimTrackVisible",
  "[TimelineSeek]",
];

const missing = requiredNeedles.filter((needle) => !timelineEditor.includes(needle));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "TimelineEditor is not wired through the seek mapping helper.",
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "resolveTimelineSeekFromClientX",
  checked: [
    "left breathing area",
    "track origin",
    "pixelsToValue mapping",
    "range offset",
    "duration clamp",
    "trim-folded source mapping",
    "trim-folded source time beyond project duration",
    "trim-visible effective mapping",
  ],
}, null, 2));
