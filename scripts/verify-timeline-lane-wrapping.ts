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

const audios: TestRegion[] = [
  { id: "audio-a", startMs: 0, endMs: 2400 },
  { id: "audio-b", startMs: 1200, endMs: 3600 },
  { id: "audio-c", startMs: 2400, endMs: 5200 },
];

const annotationAssignments = partitionIntoTimelineLanes(annotations);
const audioAssignments = partitionIntoTimelineLanes(audios);

assertNoSameLaneOverlap("annotation", annotationAssignments);
assertNoSameLaneOverlap("audio", audioAssignments);

const annotationLaneCount = new Set(annotationAssignments.map((assignment) => assignment.trackIndex)).size;
const audioLaneCount = new Set(audioAssignments.map((assignment) => assignment.trackIndex)).size;

if (annotationLaneCount !== 3) {
  throw new Error(`Expected overlapping annotations to wrap into 3 lanes, got ${annotationLaneCount}.`);
}

if (audioLaneCount !== 2) {
  throw new Error(`Expected overlapping audio clips to wrap into 2 lanes, got ${audioLaneCount}.`);
}

const touchingAnnotation = annotationAssignments.find((assignment) => assignment.item.id === "annotation-c");
if (touchingAnnotation?.trackIndex !== 0) {
  throw new Error("Expected edge-touching annotation-c to reuse lane 0.");
}

console.log(JSON.stringify({
  status: "ok",
  annotations: {
    lanes: annotationLaneCount,
    assignments: annotationAssignments.map(({ item, trackIndex }) => ({ id: item.id, trackIndex })),
  },
  audios: {
    lanes: audioLaneCount,
    assignments: audioAssignments.map(({ item, trackIndex }) => ({ id: item.id, trackIndex })),
  },
}, null, 2));

