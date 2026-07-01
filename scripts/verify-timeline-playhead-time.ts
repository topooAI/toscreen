import fs from "node:fs";
import path from "node:path";
import { resolveTimelinePlayheadDisplayTime } from "../src/components/video-editor/timeline/timelinePlayheadTime";

function assertPlayhead(
  label: string,
  actual: ReturnType<typeof resolveTimelinePlayheadDisplayTime>,
  expected: ReturnType<typeof resolveTimelinePlayheadDisplayTime>,
) {
  if (
    actual.displayTimeMs !== expected.displayTimeMs
    || actual.source !== expected.source
  ) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

assertPlayhead(
  "playing video may drive playhead",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 1000,
    externalVideoTimeMs: 1250,
    isVideoPlaying: true,
  }),
  { displayTimeMs: 1250, source: "video-current-time" },
);

assertPlayhead(
  "paused video cannot pull playhead away from React state",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 3000,
    externalVideoTimeMs: 2550,
    isVideoPlaying: false,
  }),
  { displayTimeMs: 3000, source: "react-current-time" },
);

assertPlayhead(
  "dragging playhead ignores external video time",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 4000,
    externalVideoTimeMs: 1200,
    isVideoPlaying: true,
    isDragging: true,
  }),
  { displayTimeMs: 4000, source: "react-current-time" },
);

assertPlayhead(
  "freezeExternalTime forces React state",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 5200,
    externalVideoTimeMs: 6100,
    isVideoPlaying: true,
    freezeExternalTime: true,
  }),
  { displayTimeMs: 5200, source: "react-current-time" },
);

assertPlayhead(
  "trim-folded playback maps source time to effective time",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 500,
    externalVideoTimeMs: 5000,
    isVideoPlaying: true,
    mapSourceToEffective: (ms) => ms - 1500,
  }),
  { displayTimeMs: 3500, source: "video-current-time" },
);

assertPlayhead(
  "visible trim track keeps source time as display time",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 500,
    externalVideoTimeMs: 5000,
    isVideoPlaying: true,
    isTrimTrackVisible: true,
    mapSourceToEffective: (ms) => ms - 1500,
  }),
  { displayTimeMs: 5000, source: "video-current-time" },
);

assertPlayhead(
  "invalid external time falls back to React state",
  resolveTimelinePlayheadDisplayTime({
    currentTimeMs: 7000,
    externalVideoTimeMs: Number.NaN,
    isVideoPlaying: true,
  }),
  { displayTimeMs: 7000, source: "react-current-time" },
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
  'import { resolveTimelinePlayheadDisplayTime } from "./timelinePlayheadTime"',
  "resolveTimelinePlayheadDisplayTime({",
  "currentTimeMs: currentTimeMsRef.current",
  "externalVideoTimeMs: video ? video.currentTime * 1000 : undefined",
  "isDragging: isDraggingRef.current",
  "freezeExternalTime",
  "mapSourceToEffective",
  "displayTimeMs === null",
  "const finalTimeMs = displayTimeMs",
];

const missing = requiredNeedles.filter((needle) => !timelineEditor.includes(needle));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "PlaybackCursor is not wired through the playhead time helper.",
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "resolveTimelinePlayheadDisplayTime",
  checked: [
    "playing video drives playhead",
    "paused video cannot pull playhead",
    "dragging ignores external video time",
    "freezeExternalTime ignores external video time",
    "trim-folded source-to-effective mapping",
    "trim-visible source time",
    "invalid external fallback",
  ],
}, null, 2));
