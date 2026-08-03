export interface TimelineLaneItem {
  startMs: number;
  endMs: number;
}

export interface TimelineLaneAssignment<T extends TimelineLaneItem> {
  item: T;
  trackIndex: number;
}

const LANE_TOUCH_TOLERANCE_MS = 2;

export function partitionIntoTimelineLanes<T extends TimelineLaneItem>(
  items: readonly T[],
): TimelineLaneAssignment<T>[] {
  const sorted = items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => (
      a.item.startMs - b.item.startMs
      || a.item.endMs - b.item.endMs
      || a.originalIndex - b.originalIndex
    ));

  const laneEndMs: number[] = [];
  const assignments: TimelineLaneAssignment<T>[] = [];

  for (const { item } of sorted) {
    const reusableLaneIndex = laneEndMs.findIndex((endMs) => item.startMs >= endMs - LANE_TOUCH_TOLERANCE_MS);
    const trackIndex = reusableLaneIndex >= 0 ? reusableLaneIndex : laneEndMs.length;

    laneEndMs[trackIndex] = Math.max(laneEndMs[trackIndex] ?? Number.NEGATIVE_INFINITY, item.endMs);
    assignments.push({ item, trackIndex });
  }

  return assignments;
}
