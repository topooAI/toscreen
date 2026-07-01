import fs from "node:fs";
import path from "node:path";
import {
  FALLBACK_TRACK_START_PX,
  TIMELINE_BREATHING_GAP_PX,
  TIMELINE_SIDEBAR_WIDTH_PX,
  resolveTrackStartPx,
} from "../src/components/video-editor/timeline/timelineTrackOrigin";

function assertEqual(label: string, actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

assertEqual(
  "fallback track origin includes sidebar and breathing gap",
  FALLBACK_TRACK_START_PX,
  TIMELINE_SIDEBAR_WIDTH_PX + TIMELINE_BREATHING_GAP_PX,
);

assertEqual(
  "measured track origin uses track rect relative to timeline rect",
  resolveTrackStartPx({
    timelineLeftPx: 200,
    trackLeftPx: 356,
  }),
  156,
);

assertEqual(
  "negative measurements clamp to zero",
  resolveTrackStartPx({
    timelineLeftPx: 356,
    trackLeftPx: 200,
  }),
  0,
);

assertEqual(
  "missing measurement falls back to unified origin",
  resolveTrackStartPx({
    timelineLeftPx: Number.NaN,
    trackLeftPx: 356,
  }),
  FALLBACK_TRACK_START_PX,
);

const repoRoot = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const timelineEditor = read("src/components/video-editor/timeline/TimelineEditor.tsx");
const row = read("src/components/video-editor/timeline/Row.tsx");
const trackOrigin = read("src/components/video-editor/timeline/timelineTrackOrigin.ts");

const requiredNeedles = [
  {
    file: "timelineTrackOrigin.ts",
    content: trackOrigin,
    needles: [
      "TIMELINE_SIDEBAR_WIDTH_PX = 140",
      "TIMELINE_BREATHING_GAP_PX = 16",
      "FALLBACK_TRACK_START_PX = TIMELINE_SIDEBAR_WIDTH_PX + TIMELINE_BREATHING_GAP_PX",
      "resolveTrackStartPx",
    ],
  },
  {
    file: "Row.tsx",
    content: row,
    needles: [
      "TIMELINE_BREATHING_GAP_PX",
      "TIMELINE_SIDEBAR_WIDTH_PX",
      'data-timeline-track-area="true"',
      "marginLeft: TIMELINE_BREATHING_GAP_PX",
      "width: TIMELINE_SIDEBAR_WIDTH_PX",
    ],
  },
  {
    file: "TimelineEditor.tsx",
    content: timelineEditor,
    needles: [
      "FALLBACK_TRACK_START_PX",
      "resolveTrackStartPx",
      "getTrackStartPx(timeline)",
      "setTrackStartPx(getTrackStartPx(timeline))",
      "width: FALLBACK_TRACK_START_PX",
      "trackStartPx={trackStartPx}",
      "trackStartPx,",
      "TimelineAxis",
      "PlaybackCursor",
      "resolveTimelineSeekFromClientX({",
    ],
  },
];

const missing = requiredNeedles.flatMap(({ file, content, needles }) => (
  needles
    .filter((needle) => !content.includes(needle))
    .map((needle) => ({ file, needle }))
));

if (missing.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Timeline track origin wiring is incomplete.",
    missing,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  helper: "resolveTrackStartPx",
  origin: {
    sidebarPx: TIMELINE_SIDEBAR_WIDTH_PX,
    breathingGapPx: TIMELINE_BREATHING_GAP_PX,
    fallbackTrackStartPx: FALLBACK_TRACK_START_PX,
  },
  checked: [
    "fallback origin",
    "measured origin",
    "negative clamp",
    "invalid measurement fallback",
    "Row track area wiring",
    "Timeline axis/cursor/seek shared trackStartPx wiring",
  ],
}, null, 2));
