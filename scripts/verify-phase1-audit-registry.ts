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
  "audit:recordings",
  "audit:preview-export-contract",
  "audit:project-duration",
  "audit:export-duration-render-settings",
  "audit:timeline-duration-domains",
  "audit:preview-project-time",
  "audit:export-black-tail-rendering",
  "audit:screenstudio-core-contract",
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
  "audit:project-model-motion-clips",
  "audit:project-model-ai-plan",
  "audit:project-model-ai-plan-lifecycle",
  "audit:project-model-review-packet",
  "audit:project-model-sidecar-parity",
  "audit:project-model-review-doc",
  "audit:phase1-ownership-list",
  "audit:phase1-readiness",
  "audit:phase1-user-acceptance-doc",
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
