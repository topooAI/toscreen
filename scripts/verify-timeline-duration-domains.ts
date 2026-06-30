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

const content = fs.readFileSync(timelineEditorPath, "utf8");

assertIncludes(
  "const projectTotalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);",
  "Timeline project duration must derive from the project-level videoDuration prop.",
);
assertIncludes(
  "const sourceTotalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000)), [sourceVideoDuration, videoDuration]);",
  "Timeline source duration must remain explicit for source-bound video and trim operations.",
);
assertIncludes(
  "const totalMs = projectTotalMs;",
  "Timeline default coordinate domain must be project duration, not source video duration.",
);
assertIncludes(
  "useTimeMap(trimRegions, sourceTotalMs)",
  "Trim time mapping must stay in the source-video duration domain.",
);
assertIncludes(
  "span: { start: 0, end: mapTime(sourceTotalMs) }",
  "Main video track rendering must stay source-bound instead of extending through black-tail project time.",
);
assertIncludes(
  "currentSourceStart < sourceTotalMs",
  "Main clip partitioning must end at source duration.",
);
assertIncludes(
  "sourceEndMs: sourceTotalMs",
  "Source-backed main clips must retain source duration as their source end.",
);
assertIncludes(
  "const clampedEnd = Math.min(projectTotalMs, Math.max(minEnd, region.endMs));",
  "Camera/Zoom regions must clamp against project duration.",
);
assertIncludes(
  "const clampedEnd = Math.min(sourceTotalMs, Math.max(minEnd, region.endMs));",
  "Trim regions must clamp against source duration.",
);

assertNotIncludes(
  "const totalMs = useMemo(() => Math.max(0, Math.round((sourceVideoDuration ?? videoDuration) * 1000))",
  "Timeline must not use sourceVideoDuration as the default totalMs domain.",
);

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "projectTotalMs derives from videoDuration",
    "sourceTotalMs derives from sourceVideoDuration fallback",
    "totalMs aliases projectTotalMs",
    "useTimeMap stays source-bound",
    "main video rendering stays source-bound",
    "Camera/Zoom clamps to project duration",
    "Trim clamps to source duration",
  ],
}, null, 2));

function assertIncludes(needle: string, message: string) {
  if (!content.includes(needle)) {
    fail(message, { needle });
  }
}

function assertNotIncludes(needle: string, message: string) {
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
