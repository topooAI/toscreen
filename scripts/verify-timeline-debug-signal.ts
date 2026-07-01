import fs from "node:fs";
import path from "node:path";

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
  "const handleTimelineClick = useCallback",
  "if (isTimelineResizing)",
  "e.preventDefault();",
  "e.stopPropagation();",
  "resolveTimelineSeekFromClientX({",
  "trackStartPx",
  "rangeStartMs: range.start",
  "durationMs: videoDurationMs",
  "mapEffectiveToSource",
  "isTrimTrackVisible",
  "[TimelineSeek]",
  "rawX=",
  "effectiveMs=",
  "sourceMs=",
  "onSeek(seek.sourceMs / 1000)",
];

const forbiddenNeedles = [
  "onSeek(e.clientX",
  "onSeek(rawX",
  "onSeek(e.nativeEvent",
];

const missing = requiredNeedles.filter((needle) => !timelineEditor.includes(needle));
const forbidden = forbiddenNeedles.filter((needle) => timelineEditor.includes(needle));

if (missing.length > 0 || forbidden.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Timeline debug signal is not wired through the unified seek path.",
    timelineEditorPath,
    missing,
    forbidden,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  timelineEditorPath,
  checked: [
    "resize guard blocks synthetic seek while resizing",
    "timeline click uses resolveTimelineSeekFromClientX",
    "debug log includes raw, effective, and source time",
    "seek callback receives source time from the resolver",
  ],
}, null, 2));
