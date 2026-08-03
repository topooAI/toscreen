import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  clampTimelineRange,
  resolveLeftAlignedTimelineRangeChange,
} from "../src/components/video-editor/timeline/timelineRangeZoom";

const repoRoot = process.cwd();
const timelineWrapperPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineWrapper.tsx",
);

assert.deepEqual(
  clampTimelineRange({ start: -500, end: 4500 }, 1000, 10000),
  { start: 0, end: 5000 },
  "Range clamp should preserve visible span while preventing negative starts.",
);

assert.deepEqual(
  resolveLeftAlignedTimelineRangeChange(
    { start: 2000, end: 12000 },
    () => ({ start: 4500, end: 9500 }),
    1000,
    20000,
  ),
  { start: 2000, end: 7000 },
  "Zoom should keep the normalized left edge fixed and only change visible width.",
);

assert.deepEqual(
  resolveLeftAlignedTimelineRangeChange(
    { start: 2000, end: 12000 },
    () => ({ start: 5000, end: 15000 }),
    1000,
    20000,
  ),
  { start: 5000, end: 15000 },
  "Pan should preserve the requested start when visible width does not change.",
);

assert.deepEqual(
  resolveLeftAlignedTimelineRangeChange(
    { start: 1200, end: 7200 },
    () => ({ start: 1200, end: 1210 }),
    1000,
    20000,
  ),
  { start: 1200, end: 2200 },
  "Zooming in beyond the minimum visible range should clamp to minVisibleRangeMs.",
);

assert.deepEqual(
  clampTimelineRange({ start: 0, end: 200000 }, 1000, 20000),
  { start: 0, end: 60000 },
  "Visible range should keep the existing performance max-span guardrail.",
);

assert.deepEqual(
  clampTimelineRange({ start: 3_650_000, end: 3_670_000 }, 1000, 20000),
  { start: 3_650_000, end: 3_670_000 },
  "Timeline workspace must remain pannable beyond the first hour.",
);

assert.deepEqual(
  clampTimelineRange({ start: 86_400_000, end: 86_420_000 }, 1000, 20000),
  { start: 86_400_000, end: 86_420_000 },
  "Timeline workspace must not derive its right boundary from project content duration.",
);

const timelineWrapper = fs.readFileSync(timelineWrapperPath, "utf8");
const needles = [
  "resolveLeftAlignedTimelineRangeChange(prev, updater, minVisibleRangeMs, totalMs)",
  "onRangeChanged={handleRangeChange}",
  "range={range}",
  "usePanStrategy={useInfiniteTimelineWheelStrategy}",
];
for (const needle of needles) {
  assert.ok(
    timelineWrapper.includes(needle),
    `TimelineWrapper is missing timeline range-zoom wiring: ${needle}`,
  );
}

console.log(JSON.stringify({
  status: "ok",
  helper: "timelineRangeZoom",
  checked: [
    "negative start clamp",
    "left-aligned zoom",
    "pan preserves requested start",
    "minimum visible range",
    "maximum visible span",
    "unbounded right workspace",
    "direct wheel pan strategy",
    "TimelineWrapper wiring",
  ],
}, null, 2));
