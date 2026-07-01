import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const auditRecordingRestorePath = path.join(repoRoot, "scripts", "audit-recording-restore.ts");
const phase1AcceptancePlanPath = path.join(repoRoot, "scripts", "phase1AcceptancePlan.ts");

const files = {
  auditRecordingRestore: fs.readFileSync(auditRecordingRestorePath, "utf8"),
  phase1AcceptancePlan: fs.readFileSync(phase1AcceptancePlanPath, "utf8"),
};

const checks = [
  {
    area: "recording-restore-asset-file-audit",
    file: auditRecordingRestorePath,
    content: files.auditRecordingRestore,
    needles: [
      "import { fileURLToPath } from \"node:url\";",
      "assetFiles?: {",
      "const assetFiles = await auditProjectAssetFiles(rawProject.projectModel);",
      "assetFiles,",
      "ProjectModel asset files are missing",
      "async function auditProjectAssetFiles(",
      "function localFilePathFromAssetSource(",
      "source.startsWith(\"file://\")",
      "path.isAbsolute(source)",
      "reason: \"non-local source\"",
    ],
  },
  {
    area: "ua02-machine-evidence",
    file: phase1AcceptancePlanPath,
    content: files.phase1AcceptancePlan,
    needles: [
      "\"UA-02\": [",
      "npm run audit:recordings",
      "npm run audit:recording-asset-files",
    ],
  },
];

const failures = checks
  .map((check) => ({
    area: check.area,
    file: check.file,
    missing: check.needles.filter((needle) => !check.content.includes(needle)),
  }))
  .filter((failure) => failure.missing.length > 0);

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Recording restore asset-file contract is broken.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checks: checks.map((check) => check.area),
}, null, 2));
