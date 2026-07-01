import fs from "node:fs";
import path from "node:path";
import {
  clampAudioResizeSpanToSource,
  getAudioWaveformLeftPx,
  resolveAudioResizeBounds,
} from "../src/components/video-editor/timeline/timelineAudioResizeBounds";

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertClose(label: string, actual: number, expected: number, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

const bounds = resolveAudioResizeBounds({
  span: { start: 5000, end: 8000 },
  sourceStartMs: 1200,
  sourceTotalMs: 10000,
  pxPerMs: 0.25,
});

assertEqual("left source wall in ms", bounds.minAllowedStartMs, 3800);
assertEqual("right source wall in ms", bounds.maxAllowedEndMs, 13800);
assertClose("left source wall in px", bounds.minAllowedLeftPx, 950);
assertClose("right source wall in px", bounds.maxAllowedWidthPx, 2200);
assertClose("waveform source offset", bounds.waveformLeftPx, -300);
assertClose("waveform helper offset", getAudioWaveformLeftPx(1200, 0.25), -300);

const clampedLeft = clampAudioResizeSpanToSource(
  { start: 2000, end: 8000 },
  bounds,
  "start",
);
assertEqual("left resize clamps to source start", clampedLeft.start, 3800);
assertEqual("left resize keeps end", clampedLeft.end, 8000);

const clampedRight = clampAudioResizeSpanToSource(
  { start: 5000, end: 20000 },
  bounds,
  "end",
);
assertEqual("right resize keeps start", clampedRight.start, 5000);
assertEqual("right resize clamps to source end", clampedRight.end, 13800);

const fallbackBounds = resolveAudioResizeBounds({
  span: { start: Number.NaN, end: Number.POSITIVE_INFINITY },
  sourceStartMs: Number.NaN,
  sourceTotalMs: Number.NEGATIVE_INFINITY,
  pxPerMs: Number.NaN,
});
assertEqual("fallback start is finite", Number.isFinite(fallbackBounds.minAllowedStartMs), true);
assertEqual("fallback end is finite", Number.isFinite(fallbackBounds.maxAllowedEndMs), true);
assertEqual("fallback px is finite", Number.isFinite(fallbackBounds.maxAllowedWidthPx), true);

const repoRoot = process.cwd();
const itemPath = path.join(repoRoot, "src/components/video-editor/timeline/Item.tsx");
const timelineEditorPath = path.join(repoRoot, "src/components/video-editor/timeline/TimelineEditor.tsx");
const itemSource = fs.readFileSync(itemPath, "utf8");
const timelineEditorSource = fs.readFileSync(timelineEditorPath, "utf8");

const itemNeedles = [
  'from "./timelineAudioResizeBounds"',
  "getAudioWaveformLeftPx(sourceStartMs, pxPerMs)",
  "resolveAudioResizeBounds({",
  "sourceTotalMs: trueTotalDurMs",
  "audioResizeBounds.minAllowedLeftPx",
  "audioResizeBounds.maxAllowedWidthPx",
  "svgElem.style.transform",
];

const timelineNeedles = [
  'from "./timelineAudioResizeBounds"',
  "clampAudioResizeSpanToSource(targetSpan, audioResizeBounds, \"start\")",
  "clampAudioResizeSpanToSource(targetSpan, audioResizeBounds, \"end\")",
  "sourceTotalMs: maxDuration",
  "onAudioSpanChange?.(id, targetSpan)",
];

const missing = [
  ...itemNeedles.filter((needle) => !itemSource.includes(needle)).map((needle) => `Item.tsx:${needle}`),
  ...timelineNeedles.filter((needle) => !timelineEditorSource.includes(needle)).map((needle) => `TimelineEditor.tsx:${needle}`),
];

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Audio resize bounds helper is not wired through timeline audio resize paths.",
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "timelineAudioResizeBounds",
  checked: [
    "waveform source offset",
    "left source boundary wall",
    "right source boundary wall",
    "invalid numeric fallback",
    "Item.tsx DOM resize-wall wiring",
    "TimelineEditor.tsx committed-span clamp wiring",
  ],
}, null, 2));
