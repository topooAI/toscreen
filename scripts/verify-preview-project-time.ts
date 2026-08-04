import fs from "node:fs";
import path from "node:path";
import { createEditingRenderPlan } from "../src/components/video-editor/editing/renderPlan";
import { MAX_SOURCE_FRAME_SEEK_RETRIES, resolveSourceFrameSeekDecision } from "../src/lib/exporter/sourceFrameSeek";

const repoRoot = process.cwd();
const videoPlaybackPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "VideoPlayback.tsx",
);
const videoEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "VideoEditor.tsx",
);

const videoPlayback = fs.readFileSync(videoPlaybackPath, "utf8");
const videoEditor = fs.readFileSync(videoEditorPath, "utf8");
const frameRenderer = fs.readFileSync(path.join(repoRoot, "src", "lib", "exporter", "frameRenderer.ts"), "utf8");
const videoExporter = fs.readFileSync(path.join(repoRoot, "src", "lib", "exporter", "videoExporter.ts"), "utf8");

assertIncludes(
  videoPlayback,
  "const effectiveTimeMs = isPlayingRef.current && mappedEffectiveMs !== null",
  "VideoPlayback zoom/render loop must derive playing time from the shared effective map.",
);
assertIncludes(
  videoPlayback,
  "editingRenderPlan.previewSample(effectiveTimeMs).sourceTimeMs",
  "Preview must map effective timeline time back to source interaction time.",
);
assertIncludes(
  videoPlayback,
  "zoomRegionsRef.current,\n        sourceInteractionTimeMs,",
  "Zoom interpolation must sample source-domain Focus regions with source interaction time.",
);
assertIncludes(
  videoPlayback,
  "blackTailGraphicsRef",
  "Preview must include a black-tail layer for project time after source-video end.",
);
assertIncludes(
  videoPlayback,
  "blackTailGraphicsRef.current.visible = isPastSourceVideoEnd",
  "Black-tail layer must toggle from project time and source duration.",
);
assertIncludes(
  videoEditor,
  "projectDuration > mainTrackDuration",
  "VideoEditor must preserve the project-duration tail path after the edited Main Track ends.",
);
assertIncludes(
  videoEditor,
  "currentTimeStateRef.current >= mainTrackDuration - 0.05",
  "VideoEditor must guard source video events from pulling project time back at the edited Main Track tail.",
);
assertIncludes(
  videoExporter,
  "sourceTimeAtEffectiveTime: this.config.editingRenderPlan",
  "VideoExporter must provide the effective-to-source interaction clock to FrameRenderer.",
);
assertIncludes(
  frameRenderer,
  "const sourceInteractionTimeMs = this.config.sourceTimeAtEffectiveTime?.(effectiveTimeMs) ?? effectiveTimeMs",
  "FrameRenderer must keep effective presentation time separate from source interaction time.",
);
assertIncludes(
  frameRenderer,
  "this.updateAnimationState(sourceInteractionTimeMs)",
  "Exported Focus must sample source interaction time.",
);

const speedPlan = createEditingRenderPlan({
  schemaVersion: 1,
  clips: [{ id: "main-clip-1", sourceStartMs: 0, sourceEndMs: 14_400 }],
  speedSections: [{ id: "speed-1", projectStartMs: 0, projectEndMs: 1_964.272266721433, rate: 2, origin: "manual" }],
}, 14_400);
const sourceFocusStartMs = 1_222;
const effectiveFocusStartMs = speedPlan.timeMap.mapSourceToEffective(sourceFocusStartMs);
if (effectiveFocusStartMs === null || Math.abs(effectiveFocusStartMs - 611) > 0.001) {
  fail("Focus timeline placement must compress source time through the speed map.", { effectiveFocusStartMs });
}
const sampledSourceFocusStartMs = speedPlan.previewSample(effectiveFocusStartMs).sourceTimeMs;
if (Math.abs(sampledSourceFocusStartMs - sourceFocusStartMs) > 0.001) {
  fail("Preview Focus sampling must map the compressed timeline position back to its source timestamp.", { sampledSourceFocusStartMs });
}

const vfrNearestFrame = resolveSourceFrameSeekDecision({
  actualSourceTimeMs: 647,
  targetSourceTimeMs: 622,
  sourceFrameRate: 55.68,
  retryCount: 0,
});
if (vfrNearestFrame.retry || vfrNearestFrame.acceptNearest) {
  fail("A nearby VFR source frame must be accepted without seeking again.", vfrNearestFrame);
}
const boundedSeek = resolveSourceFrameSeekDecision({
  actualSourceTimeMs: 540,
  targetSourceTimeMs: 622,
  sourceFrameRate: 55.68,
  retryCount: MAX_SOURCE_FRAME_SEEK_RETRIES,
});
if (boundedSeek.retry || !boundedSeek.acceptNearest) {
  fail("A source frame must be accepted after the bounded seek budget is exhausted.", boundedSeek);
}
const retryDistantFrame = resolveSourceFrameSeekDecision({
  actualSourceTimeMs: 540,
  targetSourceTimeMs: 622,
  sourceFrameRate: 55.68,
  retryCount: 0,
});
if (!retryDistantFrame.retry || retryDistantFrame.acceptNearest) {
  fail("A distant source frame must retry while the bounded seek budget remains.", retryDistantFrame);
}
assertIncludes(
  videoExporter,
  "await seekVideoToSourceTime(target.sourceTimeMs / 1000)",
  "Speed export must wait for source seeking to settle before requesting another decoded frame.",
);
assertIncludes(
  videoExporter,
  "sourceSeekRetryCount += 1",
  "Speed export must count retries per effective frame.",
);

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "VideoPlayback visual time derives from shared effective time",
    "Focus timeline placement uses effective time while Preview samples source time",
    "Export maps effective frames back to source-domain Focus and cursor time",
    "Speed export accepts nearest VFR frames with bounded settled-seek retries",
    "Preview has black-tail layer after source video end",
    "VideoEditor guards source-video tail events from resetting project time",
  ],
}, null, 2));

function assertIncludes(content: string, needle: string, message: string) {
  if (!content.includes(needle)) {
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
