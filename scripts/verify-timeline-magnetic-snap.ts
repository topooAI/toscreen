import fs from "node:fs";
import path from "node:path";
import {
  collectTimelineSnapTargets,
  getTimelineMagneticSnapResult,
  getTimelineMagneticSnapSpan,
  getTimelineSnapThresholdMs,
  type TimelineSnapItem,
} from "../src/components/video-editor/timeline/timelineMagneticSnap";

const VIDEO_ROW_ID = "row-video";
const ZOOM_ROW_ID = "row-zoom-0";

function assertSpan(label: string, actual: { start: number; end: number }, expected: { start: number; end: number }) {
  if (actual.start !== expected.start || actual.end !== expected.end) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArray(label: string, actual: number[], expected: number[]) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label} expected ${expectedJson}, got ${actualJson}`);
  }
}

const items: TimelineSnapItem[] = [
  { id: "zoom-a", rowId: ZOOM_ROW_ID, span: { start: 1000, end: 2000 } },
  { id: "zoom-a-part-1", rowId: ZOOM_ROW_ID, span: { start: 2100, end: 2300 } },
  { id: "zoom-peer", rowId: ZOOM_ROW_ID, span: { start: 3000, end: 4000 } },
  { id: "video-track", rowId: VIDEO_ROW_ID, span: { start: 0, end: 8000 } },
  { id: "annotation-peer", rowId: "row-annotation-0", span: { start: 1200, end: 1800 } },
];

const snapTargets = collectTimelineSnapTargets({
  activeItemId: "zoom-a",
  items,
  currentTimeMs: 2500,
  videoRowId: VIDEO_ROW_ID,
});

assertArray("snap targets exclude self, same base part, and other rows", snapTargets, [
  2500,
  3000,
  4000,
  0,
  8000,
]);

if (getTimelineSnapThresholdMs(2000) !== 300) {
  throw new Error("Expected snap threshold to cap at 300ms.");
}

if (getTimelineSnapThresholdMs(100) !== 50) {
  throw new Error("Expected snap threshold to floor at 50ms.");
}

assertSpan(
  "drag start snaps to peer edge inside threshold",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 2920, end: 3920 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 3000, end: 4000 },
);

assertSpan(
  "drag end snaps to playhead inside threshold",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 1420, end: 2420 },
    items,
    currentTimeMs: 2500,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 1500, end: 2500 },
);

assertSpan(
  "target outside threshold does not snap",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 2700, end: 3700 },
    items,
    currentTimeMs: 6000,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 2700, end: 3700 },
);

assertSpan(
  "self original edge is not a sticky snap target",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 1050, end: 2050 },
    items,
    currentTimeMs: 6000,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 1050, end: 2050 },
);

assertSpan(
  "resize-left snaps only the left edge",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 40, end: 2000 },
    items,
    currentTimeMs: 6000,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 0, end: 2000 },
);

assertSpan(
  "resize-right snaps only the right edge",
  getTimelineMagneticSnapSpan({
    activeItemId: "zoom-a",
    targetSpan: { start: 1000, end: 3940 },
    items,
    currentTimeMs: 6000,
    intervalMs: 1000,
    videoRowId: VIDEO_ROW_ID,
  }),
  { start: 1000, end: 4000 },
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
  'Magnet } from "lucide-react"',
  'getTimelineMagneticSnapResult',
  'getTimelineMagneticSnapSpan',
  "isMagneticSnapEnabled",
  "setIsMagneticSnapEnabled",
  "snapGuideMs",
  "return getTimelineMagneticSnapSpan({",
  "return getTimelineMagneticSnapResult({",
  "activeItemId",
  "targetSpan",
  "items: timelineItems",
  "currentTimeMs: activeCurrentTimeMs",
  "intervalMs: timelineScale.intervalMs",
  "videoRowId: VIDEO_ROW_ID",
  "isMagneticSnapEnabled={isMagneticSnapEnabled}",
  "getMagneticSnapResult={getMagneticSnapResultForSpan}",
  "onSnapGuideChange={setSnapGuideMs}",
  "getDirectSnapSpan={getDirectSnapSpan}",
];

const missing = requiredNeedles.filter((needle) => !timelineEditor.includes(needle));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "TimelineEditor is not wired through the magnetic snap helper.",
    missing,
  }, null, 2));
  process.exit(1);
}

const snapResult = getTimelineMagneticSnapResult({
  activeItemId: "zoom-a",
  targetSpan: { start: 2920, end: 3920 },
  items,
  currentTimeMs: 2500,
  intervalMs: 1000,
  videoRowId: VIDEO_ROW_ID,
});

assertSpan("snap result exposes snapped span", snapResult.span, { start: 3000, end: 4000 });
if (snapResult.targetMs !== 3000 || snapResult.edge !== "start") {
  throw new Error(`Expected snap result target 3000/start, got ${JSON.stringify(snapResult)}`);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "getTimelineMagneticSnapSpan",
  snapTargets,
  threshold: {
    min: getTimelineSnapThresholdMs(100),
    cap: getTimelineSnapThresholdMs(2000),
  },
}, null, 2));
