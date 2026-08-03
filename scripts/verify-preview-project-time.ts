import fs from "node:fs";
import path from "node:path";

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

assertIncludes(
  videoPlayback,
  "const projectTimeMs = Number.isFinite(currentTimeRef.current)",
  "VideoPlayback zoom/render loop must derive visual time from project currentTimeRef.",
);
assertIncludes(
  videoPlayback,
  "zoomRegionsRef.current,\n        projectTimeMs,",
  "Zoom interpolation must use project time, not the HTML video element time.",
);
assertNotIncludes(
  videoPlayback,
  "findInterpolatedTarget(zoomRegionsRef.current, (videoRef.current?.currentTime || 0) * 1000)",
  "Zoom interpolation must not regress to source-video currentTime.",
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
  "projectDuration > duration",
  "VideoEditor must preserve the project-duration tail path after source-video end.",
);
assertIncludes(
  videoEditor,
  "currentTimeStateRef.current >= duration - 0.05",
  "VideoEditor must guard source video events from pulling project time back at the source tail.",
);

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "VideoPlayback visual time derives from project currentTimeRef",
    "Zoom interpolation uses project time",
    "Preview has black-tail layer after source video end",
    "VideoEditor guards source-video tail events from resetting project time",
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
