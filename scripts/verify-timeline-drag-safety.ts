import fs from "node:fs";
import path from "node:path";
import { normalizeTimelineInteractionSpan } from "../src/components/video-editor/timeline/timelineSpanSafety";

function assertFiniteSpan(label: string, span: { start: number; end: number }, minDurationMs: number) {
  if (!Number.isFinite(span.start) || !Number.isFinite(span.end)) {
    throw new Error(`${label} produced a non-finite span: ${JSON.stringify(span)}`);
  }

  if (span.start < 0) {
    throw new Error(`${label} produced a negative start: ${JSON.stringify(span)}`);
  }

  if (span.end - span.start < minDurationMs) {
    throw new Error(`${label} produced a span shorter than ${minDurationMs}ms: ${JSON.stringify(span)}`);
  }
}

const cases = [
  {
    label: "nan-start",
    span: { start: Number.NaN, end: 1200 },
    minDurationMs: 100,
  },
  {
    label: "nan-end",
    span: { start: 400, end: Number.NaN },
    minDurationMs: 100,
  },
  {
    label: "infinite-end",
    span: { start: 400, end: Number.POSITIVE_INFINITY },
    minDurationMs: 100,
  },
  {
    label: "negative-start",
    span: { start: -200, end: 800 },
    minDurationMs: 100,
  },
  {
    label: "end-before-start",
    span: { start: 1200, end: 800 },
    minDurationMs: 100,
  },
  {
    label: "zero-duration",
    span: { start: 1200, end: 1200 },
    minDurationMs: 100,
  },
  {
    label: "nan-min-duration",
    span: { start: 1200, end: 1200 },
    minDurationMs: Number.NaN,
  },
] as const;

const results = cases.map(({ label, span, minDurationMs }) => {
  const normalized = normalizeTimelineInteractionSpan(span, { minItemDurationMs: minDurationMs });
  assertFiniteSpan(label, normalized, Number.isFinite(minDurationMs) ? minDurationMs : 1);
  return {
    label,
    normalized,
  };
});

const validSpan = normalizeTimelineInteractionSpan(
  { start: 200, end: 900 },
  { minItemDurationMs: 100 },
);

if (validSpan.start !== 200 || validSpan.end !== 900) {
  throw new Error(`Expected valid spans to keep their original duration: ${JSON.stringify(validSpan)}`);
}

const repoRoot = process.cwd();
const timelineWrapperPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineWrapper.tsx",
);
const timelineWrapper = fs.readFileSync(timelineWrapperPath, "utf8");

const requiredNeedles = [
  'import { normalizeTimelineInteractionSpan } from "./timelineSpanSafety"',
  "normalizeTimelineInteractionSpan(span, { minItemDurationMs })",
  "const liveSpan = clampSpanToBounds(updatedSpan)",
  "let clampedSpan = clampSpanToBounds(updatedSpan)",
];

const missing = requiredNeedles.filter((needle) => !timelineWrapper.includes(needle));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "TimelineWrapper is not wired through the span safety helper.",
    missing,
  }, null, 2));
  process.exit(1);
}

if (timelineWrapper.includes("Math.max(span.end - span.start, 0)")) {
  console.error(JSON.stringify({
    status: "failed",
    message: "TimelineWrapper still contains the old NaN-prone span duration expression.",
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "normalizeTimelineInteractionSpan",
  cases: results,
  validSpan,
}, null, 2));
