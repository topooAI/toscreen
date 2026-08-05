import fs from "node:fs";
import path from "node:path";
import {
  prepareCursorTrack,
  sampleCursorTrack,
} from "../src/components/video-editor/videoPlayback/cursorTrack";
import {
  computeRegionStrength,
  findInterpolatedTarget,
} from "../src/components/video-editor/videoPlayback/zoomRegionUtils";
import {
  clampZoomRegionsToRecordingDuration,
  generateAutoZooms,
} from "../src/lib/autoZoom/generator";
import type { CursorDataPoint, ZoomRegion } from "../src/components/video-editor/types";

function assertClose(label: string, actual: number, expected: number, tolerance = 0.0001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

const cursorInput: CursorDataPoint[] = [
  { timestamp: 140, x: 0.203, y: 0.203, cx: 0.203, cy: 0.203 },
  { timestamp: 100, x: 0.2, y: 0.2, cx: 0.2, cy: 0.2 },
  { timestamp: 120, x: 0.2025, y: 0.2025, cx: 0.2025, cy: 0.2025 },
  { timestamp: 140, x: 0.2035, y: 0.2035, cx: 0.2035, cy: 0.2035, isClick: true },
];
const cursorTrack = prepareCursorTrack(cursorInput, true);
if (cursorTrack.length !== 4 || cursorTrack[0].timestamp !== 0 || !cursorTrack[3].isClick) {
  throw new Error("Cursor preparation must sort points, add a t=0 anchor, merge duplicates, and preserve clicks.");
}
if (cursorTrack[2].cx <= cursorTrack[1].cx || cursorTrack[2].cx >= cursorTrack[3].cx) {
  throw new Error("Local cursor smoothing must reduce noise without freezing movement into steps.");
}

const cursorSample = sampleCursorTrack(cursorTrack, 110);
if (!cursorSample) throw new Error("Expected a cursor sample.");
if (
  cursorSample.x <= cursorTrack[1].cx
  || cursorSample.x >= cursorTrack[2].cx
  || cursorSample.y <= cursorTrack[1].cy
  || cursorSample.y >= cursorTrack[2].cy
) {
  throw new Error("Cursor interpolation must stay smooth and bounded between stabilized samples.");
}

const stationaryGapTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.2, y: 0.3, cx: 0.2, cy: 0.3 },
  { timestamp: 1000, x: 0.201, y: 0.301, cx: 0.201, cy: 0.301 },
], true);
const stationaryGapSample = sampleCursorTrack(stationaryGapTrack, 500);
if (!stationaryGapSample) throw new Error("Expected a stationary-gap cursor sample.");
assertClose("cursor holds x during telemetry gap", stationaryGapSample.x, 0.2);
assertClose("cursor holds y during telemetry gap", stationaryGapSample.y, 0.3);

const continuousMotionTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.2, y: 0.3, cx: 0.2, cy: 0.3 },
  { timestamp: 100, x: 0.8, y: 0.7, cx: 0.8, cy: 0.7 },
], false);
const continuousMotionSample = sampleCursorTrack(continuousMotionTrack, 50);
if (!continuousMotionSample || continuousMotionSample.x <= 0.2 || continuousMotionSample.x >= 0.8) {
  throw new Error("Consecutive native cursor samples must interpolate smoothly.");
}

const captureGlitchTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.9, y: 0.9, cx: 0.9, cy: 0.9 },
  { timestamp: 20, x: 0.4, y: 0.5, cx: 0.4, cy: 0.5 },
  { timestamp: 40, x: 0.405, y: 0.505, cx: 0.405, cy: 0.505 },
], true);
if (captureGlitchTrack[0].cx !== 0.4) {
  throw new Error("The synthetic leading cursor teleport must be removed from legacy recordings.");
}

const directManipulationTrack = prepareCursorTrack([
  { timestamp: 100, x: 0.2, y: 0.3, cx: 0.2, cy: 0.3, type: "mousedown" },
  { timestamp: 120, x: 0.4, y: 0.3, cx: 0.4, cy: 0.3, type: "drag" },
  { timestamp: 140, x: 0.7, y: 0.3, cx: 0.7, cy: 0.3, type: "drag" },
  { timestamp: 200, x: 0.7, y: 0.3, cx: 0.7, cy: 0.3, type: "mouseup" },
], true);
if (
  directManipulationTrack[2].cx !== 0.4
  || directManipulationTrack[3].cx !== 0.7
  || directManipulationTrack[0].isPointerDown
  || !sampleCursorTrack(directManipulationTrack, 130)?.isPointerDown
  || sampleCursorTrack(directManipulationTrack, 200)?.isPointerDown
) {
  throw new Error("Drag samples must stay unfiltered and remain pressed until the recorded mouseup event.");
}

const firstZoom: ZoomRegion = {
  id: "zoom-a",
  startMs: 0,
  endMs: 1400,
  depth: 2,
  focus: { cx: 0.25, cy: 0.25 },
};
const secondZoom: ZoomRegion = {
  id: "zoom-b",
  startMs: 1400,
  endMs: 2800,
  depth: 4,
  focus: { cx: 0.75, cy: 0.75 },
};

assertClose("zoom starts unzoomed", computeRegionStrength(firstZoom, 0), 0);
assertClose("zoom reaches full strength after 700ms", computeRegionStrength(firstZoom, 700), 1);

const adjacentBoundary = findInterpolatedTarget([firstZoom, secondZoom], 1400);
if (adjacentBoundary.strength !== 1 || adjacentBoundary.depth !== 2) {
  throw new Error("Adjacent focus clips must hand off without zooming out at their shared boundary.");
}
const adjacentMidpoint = findInterpolatedTarget([firstZoom, secondZoom], 1750);
if (
  adjacentMidpoint.strength !== 1
  || (adjacentMidpoint.depth ?? 0) <= firstZoom.depth
  || (adjacentMidpoint.depth ?? 0) >= secondZoom.depth
  || (adjacentMidpoint.focus?.cx ?? 0) <= firstZoom.focus.cx
  || (adjacentMidpoint.focus?.cx ?? 0) >= secondZoom.focus.cx
) {
  throw new Error("Connected focus clips must pan and zoom continuously between camera targets.");
}

const separatedZoom: ZoomRegion = {
  ...secondZoom,
  startMs: 5_220,
  endMs: 6_620,
};
const separatedGap = findInterpolatedTarget([firstZoom, separatedZoom], 1560);
if (separatedGap.strength !== 0 || separatedGap.region !== null) {
  throw new Error("Long-idle Focus clips must close to the base view instead of panning across the gap.");
}

const bridgedZoom: ZoomRegion = {
  ...secondZoom,
  startMs: 2_600,
  endMs: 4_000,
};
const bridgedGap = findInterpolatedTarget([firstZoom, bridgedZoom], 2_000);
if (
  bridgedGap.strength !== 1
  || (bridgedGap.depth ?? 0) <= firstZoom.depth
  || (bridgedGap.depth ?? 0) >= bridgedZoom.depth
  || (bridgedGap.focus?.cx ?? 0) <= firstZoom.focus.cx
  || (bridgedGap.focus?.cx ?? 0) >= bridgedZoom.focus.cx
) {
  throw new Error("Short Focus gaps must bridge camera targets without returning to the base view.");
}

const autoFocus: ZoomRegion = {
  id: "zoom-auto",
  startMs: 0,
  endMs: 1400,
  depth: 3,
  focus: { cx: 0.1, cy: 0.1 },
  focusMode: "auto",
  source: "auto",
};
const autoTarget = findInterpolatedTarget([autoFocus], 700, [
  { timestamp: 0, x: 0.2, y: 0.3, cx: 0.2, cy: 0.3 },
  { timestamp: 100, x: 0.242857, y: 0.328571, cx: 0.242857, cy: 0.328571 },
  { timestamp: 200, x: 0.285714, y: 0.357143, cx: 0.285714, cy: 0.357143 },
  { timestamp: 300, x: 0.328571, y: 0.385714, cx: 0.328571, cy: 0.385714 },
  { timestamp: 400, x: 0.371429, y: 0.414286, cx: 0.371429, cy: 0.414286 },
  { timestamp: 500, x: 0.414286, y: 0.442857, cx: 0.414286, cy: 0.442857 },
  { timestamp: 600, x: 0.457143, y: 0.471429, cx: 0.457143, cy: 0.471429 },
  { timestamp: 700, x: 0.5, y: 0.5, cx: 0.5, cy: 0.5 },
  { timestamp: 800, x: 0.542857, y: 0.528571, cx: 0.542857, cy: 0.528571 },
  { timestamp: 900, x: 0.585714, y: 0.557143, cx: 0.585714, cy: 0.557143 },
  { timestamp: 1000, x: 0.628571, y: 0.585714, cx: 0.628571, cy: 0.585714 },
  { timestamp: 1100, x: 0.671429, y: 0.614286, cx: 0.671429, cy: 0.614286 },
  { timestamp: 1200, x: 0.714286, y: 0.642857, cx: 0.714286, cy: 0.642857 },
  { timestamp: 1300, x: 0.757143, y: 0.671429, cx: 0.757143, cy: 0.671429 },
  { timestamp: 1400, x: 0.8, y: 0.7, cx: 0.8, cy: 0.7 },
]);
assertClose("generated focus remains fixed x", autoTarget.focus?.cx ?? 0, autoFocus.focus.cx);
assertClose("generated focus remains fixed y", autoTarget.focus?.cy ?? 0, autoFocus.focus.cy);

const moveOnlyZooms = generateAutoZooms([
  { timestamp: 0, cx: 0.1, cy: 0.1, type: "move" },
  { timestamp: 100, cx: 0.2, cy: 0.2, type: "move" },
  { timestamp: 200, cx: 0.3, cy: 0.3, type: "move" },
], { totalDurationMs: 3000 });
if (moveOnlyZooms.length !== 0) {
  throw new Error("Ordinary cursor movement must not create arbitrary Focus clips.");
}

const generatedZooms = generateAutoZooms([
  { timestamp: 1000, cx: 0.2, cy: 0.3, type: "click" },
  { timestamp: 1600, cx: 0.21, cy: 0.31, type: "click" },
  { timestamp: 4200, cx: 0.8, cy: 0.7, type: "click" },
], { totalDurationMs: 5000 });
if (generatedZooms.length !== 2) {
  throw new Error(`Expected two semantic camera intents, got ${generatedZooms.length}.`);
}
for (let index = 0; index < generatedZooms.length; index += 1) {
  const region = generatedZooms[index];
  if (
    region.focusMode !== "manual"
    || region.source !== "auto"
    || region.endMs > 5000
    || region.endMs - region.startMs < 900
  ) {
    throw new Error(`Invalid generated Focus region: ${JSON.stringify(region)}`);
  }
  if (index > 0 && generatedZooms[index - 1].endMs !== region.startMs) {
    throw new Error("Nearby automatic Focus regions must share an exact camera-transition boundary.");
  }
}

const wheelOnlyZooms = generateAutoZooms([
  { timestamp: 1000, cx: 0.4, cy: 0.4, type: "wheel" },
  { timestamp: 1020, cx: 0.4, cy: 0.42, type: "wheel" },
], { totalDurationMs: 3000 });
if (wheelOnlyZooms.length !== 0) {
  throw new Error("Scrolling alone must not create automatic Focus clips.");
}

const boundedZooms = clampZoomRegionsToRecordingDuration([
  {
    id: "before-start",
    startMs: -500,
    endMs: 1000,
    depth: 2,
    focus: { cx: 0.2, cy: 0.3 },
  },
  {
    id: "past-end",
    startMs: 4500,
    endMs: 6500,
    depth: 3,
    focus: { cx: 0.8, cy: 0.7 },
  },
  {
    id: "outside",
    startMs: 6000,
    endMs: 7000,
    depth: 3,
    focus: { cx: 0.5, cy: 0.5 },
  },
], 5000);
if (
  boundedZooms.length !== 2
  || boundedZooms[0].startMs !== 0
  || boundedZooms[1].endMs !== 5000
) {
  throw new Error(`Focus regions must be clamped to the recording duration: ${JSON.stringify(boundedZooms)}`);
}

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const cursorRenderer = read("src/components/video-editor/hooks/useCursorRenderer.ts");
const frameRenderer = read("src/lib/exporter/frameRenderer.ts");
const zoomControls = read("src/components/video-editor/sidebar/ZoomControls.tsx");
const mouseTracker = read("electron/mouseTracker.ts");
const videoEditor = read("src/components/video-editor/VideoEditor.tsx");
const videoPlayback = read("src/components/video-editor/VideoPlayback.tsx");
const timelineEditor = read("src/components/video-editor/timeline/TimelineEditor.tsx");
const timelineMediaAvailability = read("src/components/video-editor/timeline/timelineMediaAvailability.ts");
const cursorTrackSource = read("src/components/video-editor/videoPlayback/cursorTrack.ts");
const ipcHandlers = read("electron/ipc/handlers.ts");

const required = [
  [cursorRenderer, "prepareCursorTrack(cursorData, cursorSmoothing, mediaDurationMs)"],
  [cursorRenderer, "currentTimeMs = currentFrameMediaTimeMs;"],
  [frameRenderer, "sampleCursorTrack(cursorData, currentTimeMs)"],
  [zoomControls, "ZOOM_DEPTH_SCALES[depth]"],
  [mouseTracker, "screen.getCursorScreenPoint()"],
  [mouseTracker, "captureNativeEventTime(e.time)"],
  [videoEditor, "Loading telemetry must never overwrite"],
  [timelineMediaAvailability, "clip.type === 'screen-recording'"],
  [videoEditor, "persistedSourceDurationMs"],
  [videoEditor, "!originalVideoPath || !initialProjectLoadComplete"],
  [videoEditor, "!restoredSavedProjectRef.current"],
  [videoPlayback, "if (!blackTailGraphics.destroyed)"],
  [videoPlayback, "blackTailGraphicsRef.current === blackTailGraphics"],
  [videoPlayback, "if (!isPlayingRef.current) currentTimeRef.current = currentTime * 1000"],
  [videoEditor, "const sourceVideoIsPlaying = Boolean("],
  [videoEditor, "if (sourceVideoIsPlaying)"],
  [videoEditor, "console.error('Video replay failed:', err)"],
  [cursorTrackSource, "stabilizeStationaryNoise"],
  [cursorTrackSource, "removeLeadingCaptureGlitch"],
  [cursorTrackSource, "CURSOR_CONTINUOUS_MOTION_GAP_MS"],
  [cursorTrackSource, "catmullRom"],
  [cursorRenderer, "cursorLayer.style.clipPath"],
  [cursorRenderer, "videoSprite.getBounds?.()"],
  [cursorRenderer, "sample.isPointerDown ? 0.86 : 1"],
  [ipcHandlers, "selectNativeCursorSidecar"],
  [ipcHandlers, "source: 'native-cursor'"],
  [ipcHandlers, "'event-cursor-with-native-shapes'"],
  [cursorTrackSource, "point.isPointerDown"],
] as const;
const missing = required
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, needle]) => needle);
const forbidden = [
  [cursorRenderer, "catmullRom"],
  [frameRenderer, "catmullRom"],
  [zoomControls, "1.8×"],
  [zoomControls, "2.2×"],
  [videoEditor, "[recordingDurationMs, zoomRegions]"],
  [timelineEditor, "zoomRegionsRef.current.forEach"],
  [videoPlayback, "blackTailGraphics.destroy(true)"],
  [mouseTracker, "this.addEvent(initialPosition.x, initialPosition.y, 'move')"],
  [cursorRenderer, "if (isVisible) {"],
  [cursorRenderer, "(container.mask as any)?.getBounds?.()"],
  [cursorRenderer, "performance.now() - lastRVFCTime"],
] as const;
const forbiddenHits = forbidden
  .filter(([source, needle]) => source.includes(needle))
  .map(([, needle]) => needle);

if (missing.length > 0 || forbiddenHits.length > 0) {
  throw new Error(JSON.stringify({ missing, forbiddenHits }, null, 2));
}

console.log(JSON.stringify({
  status: "ok",
  cursor: "native event clock, presented-frame PTS, stationary-gap holds, bounded interpolation, and video-mask clipping",
  camera: "fixed, behavior-segmented shots with bounded duration and adaptive depth",
  zoomLabels: "single source of truth",
}, null, 2));
