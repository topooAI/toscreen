import fs from "node:fs";
import path from "node:path";
import { partitionIntoTimelineLanes } from "../src/components/video-editor/timeline/lanePartition";

interface TestRegion {
  id: string;
  startMs: number;
  endMs: number;
}

function assertNoSameLaneOverlap(
  label: string,
  assignments: ReturnType<typeof partitionIntoTimelineLanes<TestRegion>>,
) {
  const byLane = new Map<number, TestRegion[]>();

  for (const assignment of assignments) {
    const lane = byLane.get(assignment.trackIndex) ?? [];
    lane.push(assignment.item);
    byLane.set(assignment.trackIndex, lane);
  }

  for (const [trackIndex, lane] of byLane) {
    const sorted = [...lane].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.startMs < previous.endMs) {
        throw new Error(`${label} lane ${trackIndex} overlaps: ${previous.id} and ${current.id}`);
      }
    }
  }
}

const annotations: TestRegion[] = [
  { id: "annotation-a", startMs: 1000, endMs: 3000 },
  { id: "annotation-b", startMs: 1800, endMs: 2600 },
  { id: "annotation-c", startMs: 3000, endMs: 4200 },
  { id: "annotation-d", startMs: 2000, endMs: 5000 },
];

const zooms: TestRegion[] = [
  { id: "zoom-a", startMs: 1000, endMs: 3600 },
  { id: "zoom-b", startMs: 2200, endMs: 4200 },
  { id: "zoom-c", startMs: 4200, endMs: 5600 },
];

const audios: TestRegion[] = [
  { id: "audio-a", startMs: 0, endMs: 2400 },
  { id: "audio-b", startMs: 1200, endMs: 3600 },
  { id: "audio-c", startMs: 2400, endMs: 5200 },
];

const annotationAssignments = partitionIntoTimelineLanes(annotations);
const zoomAssignments = partitionIntoTimelineLanes(zooms);
const audioAssignments = partitionIntoTimelineLanes(audios);

assertNoSameLaneOverlap("annotation", annotationAssignments);
assertNoSameLaneOverlap("zoom", zoomAssignments);
assertNoSameLaneOverlap("audio", audioAssignments);

const annotationLaneCount = new Set(annotationAssignments.map((assignment) => assignment.trackIndex)).size;
const zoomLaneCount = new Set(zoomAssignments.map((assignment) => assignment.trackIndex)).size;
const audioLaneCount = new Set(audioAssignments.map((assignment) => assignment.trackIndex)).size;

if (annotationLaneCount !== 3) {
  throw new Error(`Expected overlapping annotations to wrap into 3 lanes, got ${annotationLaneCount}.`);
}

if (zoomLaneCount !== 2) {
  throw new Error(`Expected overlapping zoom clips to wrap into 2 lanes, got ${zoomLaneCount}.`);
}

if (audioLaneCount !== 2) {
  throw new Error(`Expected overlapping audio clips to wrap into 2 lanes, got ${audioLaneCount}.`);
}

const touchingAnnotation = annotationAssignments.find((assignment) => assignment.item.id === "annotation-c");
if (touchingAnnotation?.trackIndex !== 0) {
  throw new Error("Expected edge-touching annotation-c to reuse lane 0.");
}

const repoRoot = process.cwd();
const timelineEditor = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineEditor.tsx"),
  "utf8",
);
const row = fs.readFileSync(
  path.join(repoRoot, "src", "components", "video-editor", "timeline", "Row.tsx"),
  "utf8",
);

const wiringNeedles = [
  {
    file: "TimelineEditor.tsx",
    content: timelineEditor,
    needle: "const partitionedZooms = partitionIntoTimelineLanes(zoomRegions)",
  },
  {
    file: "TimelineEditor.tsx",
    content: timelineEditor,
    needle: "rowId: `row-zoom-${trackIndex}`",
  },
  {
    file: "TimelineEditor.tsx",
    content: timelineEditor,
    needle: "item.rowId.startsWith(\"row-zoom-\")",
  },
  {
    file: "TimelineEditor.tsx",
    content: timelineEditor,
    needle: "Zoom/Annotation overlap is resolved by visual lane wrapping",
  },
  {
    file: "Row.tsx",
    content: row,
    needle: "id.startsWith(\"row-zoom-\")",
  },
] as const;

const missingWiring = wiringNeedles
  .filter(({ content, needle }) => !content.includes(needle))
  .map(({ file, needle }) => ({ file, needle }));

if (missingWiring.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Timeline lane wrapping helper exists, but UI wiring is incomplete.",
    missingWiring,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  wiring: "TimelineEditor renders Zoom/Focus, Annotation, and Audio through visual lane partitioning.",
  annotations: {
    lanes: annotationLaneCount,
    assignments: annotationAssignments.map(({ item, trackIndex }) => ({ id: item.id, trackIndex })),
  },
  zooms: {
    lanes: zoomLaneCount,
    assignments: zoomAssignments.map(({ item, trackIndex }) => ({ id: item.id, trackIndex })),
  },
  audios: {
    lanes: audioLaneCount,
    assignments: audioAssignments.map(({ item, trackIndex }) => ({ id: item.id, trackIndex })),
  },
}, null, 2));
