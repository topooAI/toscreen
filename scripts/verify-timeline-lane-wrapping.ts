import fs from "node:fs";
import path from "node:path";
import { partitionIntoTimelineLanes } from "../src/components/video-editor/timeline/lanePartition";

interface TestRegion {
  id: string;
  startMs: number;
  endMs: number;
}

function laneCount(items: TestRegion[]): number {
  return new Set(partitionIntoTimelineLanes(items).map(({ trackIndex }) => trackIndex)).size;
}

const overlappingAnnotations: TestRegion[] = [
  { id: "annotation-a", startMs: 1000, endMs: 3000 },
  { id: "annotation-b", startMs: 1500, endMs: 2500 },
];
const overlappingAudio: TestRegion[] = [
  { id: "audio-a", startMs: 0, endMs: 2400 },
  { id: "audio-b", startMs: 1200, endMs: 3600 },
];

if (laneCount(overlappingAnnotations) !== 2 || laneCount(overlappingAudio) !== 2) {
  throw new Error("Annotation and audio clips must still wrap when their content overlaps.");
}

const repoRoot = process.cwd();
const timelineEditor = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineEditor.tsx"),
  "utf8",
);

const required = [
  "const partitionedAnnotations = partitionIntoTimelineLanes(annotationRegions || [])",
  "const partitionedAudios = partitionIntoTimelineLanes(filteredAudios)",
  'const ZOOM_ROW_ID = "row-zoom-0"',
  'const CAMERA_ROW_ID = "row-camera-0"',
  "rowId: region.kind === 'camera' ? CAMERA_ROW_ID : ZOOM_ROW_ID",
  "constrainFocusDragSpan",
  "constrainFocusResizeSpan",
];
const forbidden = [
  "const partitionedZooms = partitionIntoTimelineLanes(zoomRegions)",
  "rowId: `row-zoom-${trackIndex}`",
].filter((needle) => timelineEditor.includes(needle));
const missing = required.filter((needle) => !timelineEditor.includes(needle));

if (missing.length > 0 || forbidden.length > 0) {
  throw new Error(JSON.stringify({
    message: "Focus and Camera Motion must use separate single instruction lanes; only layered media may wrap.",
    missing,
    forbidden,
  }, null, 2));
}

console.log(JSON.stringify({
  status: "ok",
  focusLanes: 1,
  cameraMotionLanes: 1,
  annotationLanes: laneCount(overlappingAnnotations),
  audioLanes: laneCount(overlappingAudio),
}, null, 2));
