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
const videoEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "VideoEditor.tsx",
);
const playbackControlsPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "PlaybackControls.tsx",
);

const timelineEditorContent = fs.readFileSync(timelineEditorPath, "utf8");
const videoEditorContent = fs.readFileSync(videoEditorPath, "utf8");
const playbackControlsContent = fs.readFileSync(playbackControlsPath, "utf8");

assertIncludes(
  timelineEditorContent,
  "const projectTotalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);",
  "Timeline project duration must derive from the project-level videoDuration prop.",
);
assertIncludes(
  timelineEditorContent,
  "const sourceTotalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000)), [sourceVideoDuration, videoDuration]);",
  "Timeline source duration must remain explicit for source-bound video and trim operations.",
);
assertIncludes(
  timelineEditorContent,
  "const totalMs = projectTotalMs;",
  "Timeline default coordinate domain must be project duration, not source video duration.",
);
assertIncludes(
  timelineEditorContent,
  "useTimeMap(trimRegions, sourceTotalMs)",
  "Trim time mapping must stay in the source-video duration domain.",
);
assertIncludes(
  timelineEditorContent,
  "span: { start: 0, end: mapTime(sourceTotalMs) }",
  "Main video track rendering must stay source-bound instead of extending through black-tail project time.",
);
assertIncludes(
  timelineEditorContent,
  "buildMainClipSegments(trimRegions, sourceTotalMs, mapSourceToEffective)",
  "Main clip partitioning must go through the source-bound segmentation helper.",
);
assertIncludes(
  timelineEditorContent,
  "sourceEndMs: segment.sourceEndMs",
  "Source-backed main clips must retain source duration as their source end.",
);
assertIncludes(
  videoEditorContent,
  "persistedSourceDurationMs",
  "Restored Camera/Zoom regions must use the persisted screen-recording duration.",
);
assertIncludes(
  videoEditorContent,
  "clampZoomRegionsToRecordingDuration(",
  "Restored and generated Camera/Zoom regions must share the recording-duration boundary helper.",
);
assertIncludes(
  timelineEditorContent,
  "constrainFocusDragSpan(activeItemId, snappedSpan, zoomRegions, sourceTotalMs)",
  "Camera/Zoom drag commits must clamp against source recording duration.",
);
assertIncludes(
  timelineEditorContent,
  "constrainFocusResizeSpan(",
  "Camera/Zoom resize commits must clamp against source recording duration.",
);
assertIncludes(
  videoEditorContent,
  "videoDuration={projectDuration}",
  "VideoEditor must pass projectDuration into TimelineEditor as the project-level duration.",
);
assertIncludes(
  videoEditorContent,
  "sourceVideoDuration={duration}",
  "VideoEditor must pass the original source duration separately for source-bound operations.",
);
assertIncludes(
  timelineEditorContent,
  "duration={videoDuration}",
  "Timeline playback controls must display the project-level videoDuration prop.",
);
assertIncludes(
  playbackControlsContent,
  "onSeek(Math.min(duration, currentTime + 0.1));",
  "PlaybackControls next-frame seek must clamp against its duration prop.",
);
assertIncludes(
  playbackControlsContent,
  "{formatTime(duration)}",
  "PlaybackControls must display the duration prop as the total time.",
);

assertNotIncludes(
  timelineEditorContent,
  "const totalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000))",
  "Timeline must not use sourceVideoDuration as the default totalMs domain.",
);
assertNotIncludes(
  timelineEditorContent,
  "duration={sourceVideoDuration",
  "Timeline playback controls must not display sourceVideoDuration.",
);
assertNotIncludes(
  timelineEditorContent,
  "zoomRegionsRef.current.forEach",
  "Timeline mount and media metadata changes must not rewrite restored Camera/Zoom data.",
);
assertNotIncludes(
  videoEditorContent,
  "[recordingDurationMs, zoomRegions]",
  "Transient media duration changes must not destructively rewrite Camera/Zoom data.",
);

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "projectTotalMs derives from videoDuration",
    "sourceTotalMs derives from sourceVideoDuration fallback",
    "totalMs aliases projectTotalMs",
    "useTimeMap stays source-bound",
    "main video rendering stays source-bound",
    "main clip segmentation helper stays source-bound",
    "restored Camera/Zoom uses persisted source duration",
    "Camera/Zoom drag and resize clamp to source duration",
    "transient media duration cannot rewrite restored Camera/Zoom data",
    "VideoEditor passes projectDuration into TimelineEditor",
    "Timeline playback controls display project duration, not source duration",
    "PlaybackControls clamps forward seek and total label against duration prop",
  ],
}, null, 2));

function assertIncludes(content: string, needle: string, message: string) {
  if (!content.includes(needle)) {
    fail(message, { needle });
  }
}

function assertNotIncludes(content: string, needle: string, message: string) {
  if (content.includes(needle)) {
    fail(message, { needle });
  }
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
