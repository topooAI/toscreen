import fs from "node:fs";
import path from "node:path";
import {
  collectTimelineSnapTargets,
  getTimelineMagneticSnapSpan,
  type TimelineSnapItem,
} from "../src/components/video-editor/timeline/timelineMagneticSnap";
import {
  constrainFocusDragSpan,
  constrainFocusResizeSpan,
} from "../src/components/video-editor/timeline/timelineFocusSpan";

const VIDEO_ROW_ID = "row-video";
const ZOOM_ROW_ID = "row-zoom-0";

function assertSpan(
  label: string,
  actual: { start: number; end: number },
  expected: { start: number; end: number },
) {
  if (actual.start !== expected.start || actual.end !== expected.end) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArray(label: string, actual: number[], expected: number[]) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const items: TimelineSnapItem[] = [
  { id: "focus-a", rowId: ZOOM_ROW_ID, span: { start: 1000, end: 2000 } },
  { id: "focus-b", rowId: ZOOM_ROW_ID, span: { start: 3000, end: 4000 } },
];

assertArray(
  "snap targets contain peer edges but never the playhead",
  collectTimelineSnapTargets({
    activeItemId: "focus-a",
    items,
    currentTimeMs: 2500,
  }),
  [3000, 4000],
);

assertSpan(
  "drag snaps to a peer edge and preserves duration",
  getTimelineMagneticSnapSpan({
    activeItemId: "focus-a",
    targetSpan: { start: 2025, end: 3025 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
    interaction: "drag",
    snapThresholdMs: 80,
  }),
  { start: 2000, end: 3000 },
);

assertSpan(
  "drag outside the pixel-derived threshold remains pointer-accurate",
  getTimelineMagneticSnapSpan({
    activeItemId: "focus-a",
    targetSpan: { start: 2150, end: 3150 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
    interaction: "drag",
    snapThresholdMs: 80,
  }),
  { start: 2150, end: 3150 },
);

assertSpan(
  "deep overlap does not cause a long-distance magnetic jump",
  getTimelineMagneticSnapSpan({
    activeItemId: "focus-a",
    targetSpan: { start: 3250, end: 4250 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
    interaction: "drag",
    snapThresholdMs: 80,
  }),
  { start: 3250, end: 4250 },
);

assertSpan(
  "right resize snaps from either side of the target",
  getTimelineMagneticSnapSpan({
    activeItemId: "focus-a",
    targetSpan: { start: 1000, end: 3040 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
    interaction: "resize",
    snapThresholdMs: 80,
  }),
  { start: 1000, end: 3000 },
);

const focusItems = [
  { id: "focus-prev", startMs: 0, endMs: 1000 },
  { id: "focus-active", startMs: 1500, endMs: 2500 },
  { id: "focus-next", startMs: 3000, endMs: 4000 },
];

assertSpan(
  "focus drag is physically blocked before the next focus clip",
  constrainFocusDragSpan("focus-active", { start: 2600, end: 3600 }, focusItems, 5000),
  { start: 2000, end: 3000 },
);

assertSpan(
  "focus right resize is physically blocked at the next focus clip",
  constrainFocusResizeSpan("focus-active", { start: 1500, end: 3600 }, focusItems, 5000, 100),
  { start: 1500, end: 3000 },
);

const repoRoot = process.cwd();
const timelineEditor = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineEditor.tsx"),
  "utf8",
);
const timelineItem = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "Item.tsx"),
  "utf8",
);
const timelineWrapper = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineWrapper.tsx"),
  "utf8",
);

const requiredWiring = [
  "snapThresholdMs: number",
  "interaction: \"drag\"",
  "interaction: \"resize\"",
  "constrainFocusDragSpan",
  "constrainFocusResizeSpan",
  "const canTimelineDirectDrag = isAudio || isAnnotation",
  "return variant === \"trim\"",
  "getDragSnapThresholdMs",
  "getResizeSnapThresholdMs",
  "getMagneticResizeSnapSpan",
  "(onItemDragSpanChange ?? onItemSpanChange)",
];

const combinedSource = `${timelineEditor}\n${timelineItem}\n${timelineWrapper}`;
const missing = requiredWiring.filter((needle) => !combinedSource.includes(needle));
const forbidden = [
  "fitTimelineSnapSpanToNearbyEdges({",
  "getSourceZoomMagneticSnapSpan",
  "getSourceZoomResizeMagneticSnapSpan",
  "variant === \"zoom\" || variant === \"trim\"",
  "zoomRegionsRef.current.forEach",
  "trimRegionsRef.current.forEach",
].filter((needle) => timelineEditor.includes(needle));

const focusItemStart = timelineEditor.indexOf('variant="zoom"');
const focusItemEnd = timelineEditor.indexOf("</Item>", focusItemStart);
const focusItemSource = timelineEditor.slice(focusItemStart, focusItemEnd);
const forbiddenFocusProps = [
  "onDirectSpanChange",
  "onDirectDragSpanChange",
  "onDirectSpanPreview",
  "getVisualSnapSpan",
  "getVisualResizeSnapSpan",
].filter((needle) => focusItemSource.includes(needle));

if (missing.length > 0 || forbidden.length > 0 || forbiddenFocusProps.length > 0) {
  throw new Error(JSON.stringify({
    message: "Timeline magnetic snap wiring is inconsistent.",
    missing,
    forbidden,
    forbiddenFocusProps,
  }, null, 2));
}

console.log(JSON.stringify({
  status: "ok",
  behavior: [
    "single dnd-timeline gesture engine for Focus",
    "8px pixel-derived live threshold",
    "no playhead snap",
    "drag preserves duration",
    "resize changes one edge",
    "focus clips cannot overlap",
  ],
}, null, 2));
