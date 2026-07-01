import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, "package.json");
const phase1AuditPath = path.join(repoRoot, "scripts", "audit-phase1.ts");
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "product",
  "Product-and-Editor-Architecture.md",
);

const requiredAuditScripts = [
  "audit:project-model-smoke",
  "audit:project-model-restore",
  "audit:project-model-roundtrip",
  "audit:project-model-canvas-settings",
  "audit:project-model-entity-schema",
  "audit:project-model-ui-source-schema",
  "audit:recordings",
  "audit:recording-asset-files",
  "audit:preview-export-contract",
  "audit:export-background-parity",
  "audit:project-duration",
  "audit:export-duration-render-settings",
  "audit:timeline-duration-domains",
  "audit:timeline-track-origin",
  "audit:timeline-lane-wrapping",
  "audit:timeline-drag-safety",
  "audit:timeline-magnetic-snap",
  "audit:timeline-range-zoom",
  "audit:timeline-seek-mapping",
  "audit:timeline-playhead-time",
  "audit:audio-resize-bounds",
  "audit:timeline-waveform-layout",
  "audit:original-audio-accordion",
  "audit:main-video-thumbnails",
  "audit:timeline-trim-row-hidden",
  "audit:main-clip-segmentation",
  "audit:preview-project-time",
  "audit:export-black-tail-rendering",
  "audit:screenstudio-core-contract",
  "audit:screenstudio-control-wiring",
  "audit:electron-editor-runtime",
  "audit:export-entrypoints",
  "audit:project-model-future",
  "audit:project-model-multisource",
  "audit:project-model-camera",
  "audit:project-model-camera-migration",
  "audit:project-model-track-compatibility",
  "audit:project-model-lane-wrapping",
  "audit:project-model-clip-overlap-policy",
  "audit:project-model-track-hierarchy",
  "audit:project-model-asset-compatibility",
  "audit:project-model-core-clips",
  "audit:project-model-annotations",
  "audit:project-model-motion-clips",
  "audit:project-model-ai-plan",
  "audit:project-model-ai-plan-lifecycle",
  "audit:project-model-review-packet",
  "audit:project-model-sidecar-parity",
  "audit:project-model-scenes",
  "audit:project-model-default-scene",
  "audit:project-model-review-doc",
  "audit:phase1-ownership-list",
  "audit:phase1-readiness",
  "audit:phase1-acceptance-state",
  "audit:phase1-user-acceptance-doc",
  "audit:phase1-user-review-packet",
  "audit:timeline-acceptance-doc",
  "audit:timeline-debug-signal",
  "audit:timeline-resize-handles",
  "audit:timeline-clip-style",
  "audit:phase1-handoff",
  "audit:export-audio-render-settings",
  "audit:preview-audio-render-settings",
  "audit:phase1-registry",
];

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};
const phase1AuditContent = fs.readFileSync(phase1AuditPath, "utf8");
const architectureDocContent = fs.readFileSync(architectureDocPath, "utf8");

const packageScripts = packageJson.scripts ?? {};

const missingFromPackage = requiredAuditScripts.filter(
  (scriptName) => typeof packageScripts[scriptName] !== "string",
);

const missingFromPhase1Aggregate = requiredAuditScripts.filter(
  (scriptName) => !phase1AuditContent.includes(`"${scriptName}"`),
);

const missingFromArchitectureDoc = requiredAuditScripts.filter(
  (scriptName) => !architectureDocContent.includes(`npm run ${scriptName}`),
);

const missingPhase1Script = typeof packageScripts["audit:phase1"] !== "string";

if (
  missingPhase1Script ||
  missingFromPackage.length > 0 ||
  missingFromPhase1Aggregate.length > 0 ||
  missingFromArchitectureDoc.length > 0
) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Phase 1 audit registry is out of sync. Keep package.json, scripts/audit-phase1.ts, and the architecture doc aligned.",
    missingPhase1Script,
    missingFromPackage,
    missingFromPhase1Aggregate,
    missingFromArchitectureDoc,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  phase1Script: "audit:phase1",
  checked: requiredAuditScripts,
}, null, 2));
