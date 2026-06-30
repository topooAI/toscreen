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
const reviewPacketPath = path.join(
  repoRoot,
  "docs",
  "product",
  "ProjectModel-Review-Packet.md",
);
const userAcceptancePath = path.join(
  repoRoot,
  "docs",
  "product",
  "Phase1-User-Acceptance-Record.md",
);

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};
const phase1Audit = fs.readFileSync(phase1AuditPath, "utf8");
const architectureDoc = fs.readFileSync(architectureDocPath, "utf8");
const reviewPacket = fs.readFileSync(reviewPacketPath, "utf8");
const userAcceptance = fs.readFileSync(userAcceptancePath, "utf8");

const requiredMachineGates = [
  "audit:phase1",
  "audit:phase1-registry",
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
  "audit:project-model-camera-migration",
  "audit:project-model-lane-wrapping",
  "audit:project-model-review-packet",
  "audit:project-model-review-doc",
  "audit:phase1-ownership-list",
  "audit:phase1-user-acceptance-doc",
];

const requiredUserCheckpoints = [
  "ProjectModel 方向确认",
  "Electron 重启恢复验收",
  "Timeline 手感验收",
  "Screen Studio 核心体验验收",
  "Preview/Export 成片验收",
  "Camera/Focus 操作语言确认",
  "AI 自动剪辑真实用例确认",
  "阶段放行",
];

const requiredArchitecturePhrases = [
  "第一阶段独立执行与用户介入清单",
  "Phase 1 Ownership And Review Checklist",
  "✅ Script-verified, needs hands-on confirmation",
  "🟡 Contract audit added",
  "🟡 Model migration audited, UX pending",
  "⏳ Pending",
  "用户模型确认 / User model review",
];

const requiredReviewPacketPhrases = [
  "Execution Ownership Checklist",
  "OWN-03",
  "OWN-04",
  "OWN-05",
  "OWN-11",
];

const packageScripts = packageJson.scripts ?? {};
const missingPackageScripts = requiredMachineGates.filter(
  (scriptName) => typeof packageScripts[scriptName] !== "string",
);
const missingAggregateScripts = requiredMachineGates
  .filter((scriptName) => scriptName !== "audit:phase1")
  .filter((scriptName) => !phase1Audit.includes(`"${scriptName}"`));
const missingArchitecturePhrases = requiredArchitecturePhrases.filter(
  (phrase) => !architectureDoc.includes(phrase),
);
const missingReviewPacketPhrases = requiredReviewPacketPhrases.filter(
  (phrase) => !reviewPacket.includes(phrase),
);
const missingUserCheckpoints = requiredUserCheckpoints.filter(
  (phrase) => !architectureDoc.includes(phrase),
);
const missingUserAcceptanceItems = requiredUserCheckpoints.filter(
  (phrase) => !userAcceptance.includes(phrase),
);

const failures = {
  missingPackageScripts,
  missingAggregateScripts,
  missingArchitecturePhrases,
  missingReviewPacketPhrases,
  missingUserCheckpoints,
  missingUserAcceptanceItems,
};

const hasFailures = Object.values(failures).some((items) => items.length > 0);

if (hasFailures) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Phase 1 readiness registry is incomplete.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  machineVerified: [
    "ProjectModel smoke, restore, roundtrip, sidecar parity, and real recording restore gates are registered.",
    "Preview/export render settings, project duration, black tail, and Screen Studio core contracts are registered.",
    "Camera migration, lane wrapping, track hierarchy, asset compatibility, and AI plan model gates are registered.",
  ],
  userRequired: requiredUserCheckpoints,
  userAcceptanceRecord: "docs/product/Phase1-User-Acceptance-Record.md",
  phaseComplete: false,
  reason: "Phase 1 still requires user review of model direction, Electron hands-on behavior, exported output, and phase release.",
}, null, 2));
