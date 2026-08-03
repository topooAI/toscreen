import type { CursorDataPoint } from "../types";

const CURSOR_CONTINUOUS_MOTION_GAP_MS = 120;
const CURSOR_STATIONARY_DISTANCE = 0.004;
const CURSOR_STATIONARY_SMOOTHING_WINDOW_MS = 80;
const CURSOR_SHAPE_DROPOUT_MAX_MS = 220;

export interface CursorTrackSample {
  x: number;
  y: number;
  index: number;
  isPointerDown: boolean;
  cursorType: string;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizePoint(point: CursorDataPoint): CursorDataPoint | null {
  const timestamp = Number(point.timestamp);
  const cx = Number(point.cx ?? point.x);
  const cy = Number(point.cy ?? point.y);
  if (!Number.isFinite(timestamp) || !Number.isFinite(cx) || !Number.isFinite(cy)) {
    return null;
  }

  return {
    ...point,
    timestamp,
    cx: clamp01(cx),
    cy: clamp01(cy),
    x: clamp01(cx),
    y: clamp01(cy),
  };
}

function removeLeadingCaptureGlitch(points: CursorDataPoint[]): CursorDataPoint[] {
  if (points.length < 3 || points[0].isClick) return points;
  const firstDurationMs = points[1].timestamp - points[0].timestamp;
  const firstDistance = Math.hypot(points[1].cx - points[0].cx, points[1].cy - points[0].cy);
  const nextDistance = Math.hypot(points[2].cx - points[1].cx, points[2].cy - points[1].cy);
  if (firstDurationMs <= 50 && firstDistance >= 0.25 && nextDistance <= 0.05) {
    return points.slice(1);
  }
  return points;
}

function stabilizePointerDownCursorShape(points: CursorDataPoint[]): CursorDataPoint[] {
  const stabilized = points.map(point => ({ ...point }));
  let intervalStart = -1;

  const commitInterval = (intervalEnd: number) => {
    if (intervalStart < 0 || intervalEnd <= intervalStart) return;

    const candidates = new Map<string, { count: number; first: number; last: number }>();
    for (let index = intervalStart; index <= intervalEnd; index += 1) {
      const point = stabilized[index];
      if (point.type !== 'drag' && !point.isPointerDown) continue;
      const cursorType = point.cursorType || 'default';
      if (cursorType === 'default' || cursorType === 'none') continue;

      const candidate = candidates.get(cursorType);
      if (candidate) {
        candidate.count += 1;
        candidate.last = point.timestamp;
      } else {
        candidates.set(cursorType, { count: 1, first: point.timestamp, last: point.timestamp });
      }
    }

    const persistentCandidate = [...candidates.entries()]
      .filter(([, candidate]) => candidate.count >= 3 && candidate.last - candidate.first >= 40)
      .sort((left, right) => right[1].count - left[1].count)[0];
    if (!persistentCandidate) return;

    const [cursorType] = persistentCandidate;
    for (let index = intervalStart; index <= intervalEnd; index += 1) {
      stabilized[index].cursorType = cursorType;
    }
  };

  let pointerDown = false;
  for (let index = 0; index < stabilized.length; index += 1) {
    const point = stabilized[index];
    const startsPointerDown = point.type === 'mousedown' || (!pointerDown && point.isPointerDown);
    if (startsPointerDown) {
      pointerDown = true;
      intervalStart = index;
    }

    if (pointerDown && point.type === 'mouseup') {
      commitInterval(index);
      pointerDown = false;
      intervalStart = -1;
    }
  }

  if (pointerDown) commitInterval(stabilized.length - 1);
  return stabilized;
}

function stabilizeCursorShapeDropouts(points: CursorDataPoint[]): CursorDataPoint[] {
  const stabilized = points.map(point => ({ ...point }));

  // The native sampler can briefly report either side of a cursor transition.
  // Because the complete track is available, reject short A-B-A and A-B-C-A
  // glitches without adding live debounce latency. Repeat to collapse adjacent
  // noisy clusters while preserving every sustained state change.
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;

    for (let index = 1; index < stabilized.length - 1;) {
      const cursorType = stabilized[index].cursorType || 'default';
      const runStart = index;
      while (
        index < stabilized.length
        && (stabilized[index].cursorType || 'default') === cursorType
      ) {
        index += 1;
      }

      if (index >= stabilized.length) break;

      const previousType = stabilized[runStart - 1].cursorType || 'default';
      if (cursorType === previousType) continue;

      let returnIndex = index;
      while (
        returnIndex < stabilized.length
        && stabilized[returnIndex].timestamp - stabilized[runStart].timestamp
          <= CURSOR_SHAPE_DROPOUT_MAX_MS
        && (stabilized[returnIndex].cursorType || 'default') !== previousType
      ) {
        returnIndex += 1;
      }

      const returnsToPreviousType = returnIndex < stabilized.length
        && (stabilized[returnIndex].cursorType || 'default') === previousType
        && stabilized[returnIndex].timestamp - stabilized[runStart].timestamp
          <= CURSOR_SHAPE_DROPOUT_MAX_MS;
      if (!returnsToPreviousType) continue;

      for (let runIndex = runStart; runIndex < returnIndex; runIndex += 1) {
        stabilized[runIndex].cursorType = previousType;
      }
      changed = true;
      index = returnIndex;
    }

    if (!changed) break;
  }

  return stabilized;
}

function stabilizeStationaryNoise(points: CursorDataPoint[]): CursorDataPoint[] {
  return points.map((point, index) => {
    const previousPoint = points[index - 1];
    const nextPoint = points[index + 1];
    const isSemanticAnchor = point.isClick
      || point.isPointerDown
      || point.type === 'mousedown'
      || point.type === 'mouseup'
      || point.type === 'drag';

    if (!previousPoint || !nextPoint || isSemanticAnchor) return { ...point };

    const previousGapMs = point.timestamp - previousPoint.timestamp;
    const nextGapMs = nextPoint.timestamp - point.timestamp;
    const previousDistance = Math.hypot(point.cx - previousPoint.cx, point.cy - previousPoint.cy);
    const nextDistance = Math.hypot(nextPoint.cx - point.cx, nextPoint.cy - point.cy);
    const isStationaryNoise = previousGapMs <= CURSOR_STATIONARY_SMOOTHING_WINDOW_MS
      && nextGapMs <= CURSOR_STATIONARY_SMOOTHING_WINDOW_MS
      && previousDistance <= CURSOR_STATIONARY_DISTANCE
      && nextDistance <= CURSOR_STATIONARY_DISTANCE;

    if (!isStationaryNoise) return { ...point };

    // Centered smoothing removes tiny stationary jitter without shifting the
    // motion in time. Meaningful movement keeps every recorded coordinate.
    const stabilizedX = previousPoint.cx * 0.25 + point.cx * 0.5 + nextPoint.cx * 0.25;
    const stabilizedY = previousPoint.cy * 0.25 + point.cy * 0.5 + nextPoint.cy * 0.25;
    return {
      ...point,
      cx: stabilizedX,
      cy: stabilizedY,
      x: stabilizedX,
      y: stabilizedY,
    };
  });
}

export function prepareCursorTrack(
  points: readonly CursorDataPoint[],
  stabilize = true,
  _mediaDurationMs?: number,
): CursorDataPoint[] {
  // IPC normalizes every cursor stream to the video's first encoded frame.
  // Reinterpreting absolute clocks or inferring an offset from track duration
  // here would apply a second, recording-dependent time shift.
  const sorted = points
    .map(normalizePoint)
    .filter((point): point is CursorDataPoint => point !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const deduplicated: CursorDataPoint[] = [];
  for (const point of sorted) {
    const previous = deduplicated[deduplicated.length - 1];
    if (previous && previous.timestamp === point.timestamp) {
      deduplicated[deduplicated.length - 1] = {
        ...point,
        isClick: Boolean(previous.isClick || point.isClick),
        cursorType: point.cursorType ?? previous.cursorType,
      };
      continue;
    }
    deduplicated.push({ ...point });
  }

  const cleaned = stabilizeCursorShapeDropouts(
    stabilizePointerDownCursorShape(removeLeadingCaptureGlitch(deduplicated)),
  );
  let pointerDown = false;
  const stateful = cleaned.map((point) => {
    if (point.type === 'mousedown' || point.type === 'drag') pointerDown = true;
    if (point.type === 'mouseup') pointerDown = false;
    return {
      ...point,
      isClick: point.isClick || point.type === 'mousedown',
      isPointerDown: point.isPointerDown ?? pointerDown,
    };
  });
  if (!stabilize) return stateful;

  const stabilized = stabilizeStationaryNoise(stateful);

  if (stabilized[0]?.timestamp > 0) {
    stabilized.unshift({
      ...stabilized[0],
      timestamp: 0,
      type: 'move',
      isClick: false,
      isPointerDown: false,
    });
  }

  return stabilized;
}

function catmullRom(
  previous: number,
  start: number,
  end: number,
  next: number,
  progress: number,
): number {
  const progress2 = progress * progress;
  const progress3 = progress2 * progress;
  const value = 0.5 * (
    (2 * start)
    + (-previous + end) * progress
    + (2 * previous - 5 * start + 4 * end - next) * progress2
    + (-previous + 3 * start - 3 * end + next) * progress3
  );

  // Cursor coordinates must not overshoot the actual segment endpoints.
  return Math.min(Math.max(start, end), Math.max(Math.min(start, end), value));
}

export function sampleCursorTrack(
  points: readonly CursorDataPoint[],
  timeMs: number,
): CursorTrackSample | null {
  if (points.length === 0) return null;
  if (points.length === 1 || timeMs <= points[0].timestamp) {
    return { x: points[0].cx, y: points[0].cy, index: 0, isPointerDown: Boolean(points[0].isPointerDown), cursorType: points[0].cursorType || 'default' };
  }

  const lastIndex = points.length - 1;
  if (timeMs >= points[lastIndex].timestamp) {
    return { x: points[lastIndex].cx, y: points[lastIndex].cy, index: lastIndex, isPointerDown: Boolean(points[lastIndex].isPointerDown), cursorType: points[lastIndex].cursorType || 'default' };
  }

  let left = 0;
  let right = lastIndex - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    if (points[middle].timestamp <= timeMs && points[middle + 1].timestamp > timeMs) {
      const first = points[middle];
      const second = points[middle + 1];
      const durationMs = Math.max(1, second.timestamp - first.timestamp);

      // The event recorder emits only coordinate changes. After a long gap the
      // cursor remained at the first point until the next native event; drawing
      // a spline across the whole gap would invent motion that never happened.
      if (durationMs > CURSOR_CONTINUOUS_MOTION_GAP_MS) {
        return { x: first.cx, y: first.cy, index: middle, isPointerDown: Boolean(first.isPointerDown), cursorType: first.cursorType || 'default' };
      }

      const progress = clamp01((timeMs - first.timestamp) / durationMs);
      const previous = points[Math.max(0, middle - 1)];
      const next = points[Math.min(lastIndex, middle + 2)];
      return {
        x: catmullRom(previous.cx, first.cx, second.cx, next.cx, progress),
        y: catmullRom(previous.cy, first.cy, second.cy, next.cy, progress),
        index: middle,
        isPointerDown: Boolean(first.isPointerDown),
        cursorType: first.cursorType || 'default',
      };
    }

    if (points[middle].timestamp > timeMs) right = middle - 1;
    else left = middle + 1;
  }

  return null;
}
