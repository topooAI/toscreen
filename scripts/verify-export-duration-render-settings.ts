import fs from "node:fs";
import path from "node:path";
import { resolveExportDurationSeconds } from "../src/lib/exporter/duration";

const trimOnlyDuration = resolveExportDurationSeconds({
  sourceDurationSeconds: 12,
  projectDurationMs: 12000,
  trimRegions: [{
    id: "trim-export-duration",
    startMs: 4000,
    endMs: 5500,
  }],
});

if (trimOnlyDuration !== 10.5) {
  fail("Trim-only exports must keep the existing trimmed source duration.", {
    trimOnlyDuration,
  });
}

const extendedProjectDuration = resolveExportDurationSeconds({
  sourceDurationSeconds: 8,
  projectDurationMs: 16000,
  trimRegions: [],
});

if (extendedProjectDuration !== 16) {
  fail("Exports must continue to ProjectModel duration when project content extends beyond the source video.", {
    extendedProjectDuration,
  });
}

const clampedTrimDuration = resolveExportDurationSeconds({
  sourceDurationSeconds: 5,
  projectDurationMs: 5000,
  trimRegions: [{
    id: "trim-out-of-range",
    startMs: -1000,
    endMs: 9000,
  }],
});

if (clampedTrimDuration !== 0) {
  fail("Trim duration calculation must clamp invalid ranges to the source duration.", {
    clampedTrimDuration,
  });
}

const repoRoot = process.cwd();
const videoEditorPath = path.join(repoRoot, "src", "components", "video-editor", "VideoEditor.tsx");
const videoExporterPath = path.join(repoRoot, "src", "lib", "exporter", "videoExporter.ts");
const audioMixerExporterPath = path.join(repoRoot, "src", "lib", "exporter", "audioMixerExporter.ts");

const videoEditorContent = fs.readFileSync(videoEditorPath, "utf8");
const videoExporterContent = fs.readFileSync(videoExporterPath, "utf8");
const audioMixerExporterContent = fs.readFileSync(audioMixerExporterPath, "utf8");

assertIncludes(
  videoEditorContent,
  "projectDurationMs: renderSettings.durationMs",
  "VideoEditor must pass ProjectModel render settings duration into VideoExporter.",
);
assertIncludes(
  videoExporterContent,
  "renderBlackTailFrames",
  "VideoExporter must render black tail frames after the source video ends.",
);
assertIncludes(
  videoExporterContent,
  "resolveExportDurationSeconds",
  "VideoExporter must use the shared export duration resolver.",
);
assertIncludes(
  audioMixerExporterContent,
  "resolveExportDurationSeconds",
  "AudioMixerExporter must use the shared export duration resolver.",
);

console.log(JSON.stringify({
  status: "ok",
  trimOnlyDuration,
  extendedProjectDuration,
  clampedTrimDuration,
  checks: [
    "VideoEditor passes renderSettings.durationMs",
    "VideoExporter uses shared duration resolver",
    "VideoExporter renders black tail frames",
    "AudioMixerExporter uses shared duration resolver",
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
