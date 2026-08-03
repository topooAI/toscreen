import fs from "node:fs";
import path from "node:path";
import { buildMainClipSegments } from "../src/components/video-editor/timeline/timelineMainClipSegments";
import { createTimelineTimeMap } from "../src/components/video-editor/timeline/timelineTimeMap";
import type { TrimRegion } from "../src/components/video-editor/types";

function assertSegments(
  label: string,
  actual: ReturnType<typeof buildMainClipSegments>,
  expected: ReturnType<typeof buildMainClipSegments>,
) {
  const compactActual = actual.map(({ id, sourceStartMs, sourceEndMs, effectiveStartMs, effectiveEndMs }) => ({
    id,
    sourceStartMs,
    sourceEndMs,
    effectiveStartMs,
    effectiveEndMs,
  }));
  if (JSON.stringify(compactActual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(compactActual)}`);
  }
}

const multiTrimRegions: TrimRegion[] = [
  { id: "trim-a", startMs: 2000, endMs: 4000 },
  { id: "trim-b", startMs: 7000, endMs: 8000 },
];
assertSegments(
  "multiple trim regions split main clip into kept source ranges",
  buildMainClipSegments(
    multiTrimRegions,
    10000,
    createTimelineTimeMap(multiTrimRegions, 10000).mapSourceToEffective,
  ),
  [
    { id: "main-clip-0", sourceStartMs: 0, sourceEndMs: 2000, effectiveStartMs: 0, effectiveEndMs: 2000 },
    { id: "main-clip-1", sourceStartMs: 4000, sourceEndMs: 7000, effectiveStartMs: 2000, effectiveEndMs: 5000 },
    { id: "main-clip-final", sourceStartMs: 8000, sourceEndMs: 10000, effectiveStartMs: 5000, effectiveEndMs: 7000 },
  ],
);

const nestedTrimRegions: TrimRegion[] = [
  { id: "trim-outer", startMs: 1000, endMs: 5000 },
  { id: "trim-inner", startMs: 2000, endMs: 3000 },
  { id: "trim-overlap", startMs: 4500, endMs: 6500 },
];
assertSegments(
  "overlapping or nested trim regions cannot move the source cursor backwards",
  buildMainClipSegments(
    nestedTrimRegions,
    8000,
    createTimelineTimeMap(nestedTrimRegions, 8000).mapSourceToEffective,
  ),
  [
    { id: "main-clip-0", sourceStartMs: 0, sourceEndMs: 1000, effectiveStartMs: 0, effectiveEndMs: 1000 },
    { id: "main-clip-final", sourceStartMs: 6500, sourceEndMs: 8000, effectiveStartMs: 1000, effectiveEndMs: 2500 },
  ],
);

const clippedTrimRegions: TrimRegion[] = [
  { id: "trim-negative", startMs: -1000, endMs: 1000 },
  { id: "trim-tail", startMs: 9000, endMs: 12000 },
];
assertSegments(
  "out-of-range trim regions are clipped to source duration",
  buildMainClipSegments(
    clippedTrimRegions,
    10000,
    createTimelineTimeMap(clippedTrimRegions, 10000).mapSourceToEffective,
  ),
  [
    { id: "main-clip-0", sourceStartMs: 1000, sourceEndMs: 9000, effectiveStartMs: 0, effectiveEndMs: 8000 },
  ],
);

assertSegments(
  "no trim renders one full main clip",
  buildMainClipSegments([], 5000, createTimelineTimeMap([], 5000).mapSourceToEffective),
  [
    { id: "main-clip-final", sourceStartMs: 0, sourceEndMs: 5000, effectiveStartMs: 0, effectiveEndMs: 5000 },
  ],
);

const repoRoot = process.cwd();
const timelineEditorPath = path.join(repoRoot, "src/components/video-editor/timeline/TimelineEditor.tsx");
const useTimeMapPath = path.join(repoRoot, "src/components/video-editor/hooks/useTimeMap.ts");
const timelineEditorSource = fs.readFileSync(timelineEditorPath, "utf8");
const useTimeMapSource = fs.readFileSync(useTimeMapPath, "utf8");

const requiredNeedles = [
  {
    file: "TimelineEditor.tsx",
    source: timelineEditorSource,
    needles: [
      'from "./timelineMainClipSegments"',
  "useTimeMap(trimRegions, sourceTotalMs, editingSession?.document)",
      "buildMainClipSegments(trimRegions, sourceTotalMs, mapSourceToEffective)",
      "span: { start: segment.effectiveStartMs, end: segment.effectiveEndMs }",
      "sourceStartMs: segment.sourceStartMs",
      "sourceEndMs: segment.sourceEndMs",
      "totalDurationMs: segment.sourceEndMs - segment.sourceStartMs",
    ],
  },
  {
    file: "useTimeMap.ts",
    source: useTimeMapSource,
    needles: [
      "createTimelineTimeMap(trimRegions, videoDurationMs)",
      "effectiveDurationMs: timeMap.effectiveDurationMs",
      "mapSourceToEffective: timeMap.mapSourceToEffective",
      "mapEffectiveToSource: timeMap.mapEffectiveToSource",
    ],
  },
];

const missing = requiredNeedles.flatMap(({ file, source, needles }) => (
  needles
    .filter((needle) => !source.includes(needle))
    .map((needle) => `${file}:${needle}`)
));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "TimelineEditor is not wired through buildMainClipSegments.",
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "buildMainClipSegments",
  checked: [
    "multiple trim segmentation",
    "overlapping trim merge behavior",
    "out-of-range trim clipping",
    "no-trim full main clip",
    "TimelineEditor main clip wiring",
    "useTimeMap shared time-map wiring",
  ],
}, null, 2));
