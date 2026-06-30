import { spawnSync } from "node:child_process";
import path from "node:path";

interface AuditStep {
  id: string;
  command: string;
  args: string[];
}

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const tscCommand = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  isWindows ? "tsc.cmd" : "tsc",
);

const steps: AuditStep[] = [
  {
    id: "typescript",
    command: tscCommand,
    args: ["--noEmit"],
  },
  {
    id: "phase1-audit-registry",
    command: npmCommand,
    args: ["run", "audit:phase1-registry"],
  },
  {
    id: "project-model-smoke",
    command: npmCommand,
    args: ["run", "audit:project-model-smoke"],
  },
  {
    id: "project-model-restore",
    command: npmCommand,
    args: ["run", "audit:project-model-restore"],
  },
  {
    id: "project-model-roundtrip",
    command: npmCommand,
    args: ["run", "audit:project-model-roundtrip"],
  },
  {
    id: "recording-restore",
    command: npmCommand,
    args: ["run", "audit:recordings"],
  },
  {
    id: "preview-export-contract",
    command: npmCommand,
    args: ["run", "audit:preview-export-contract"],
  },
  {
    id: "project-duration",
    command: npmCommand,
    args: ["run", "audit:project-duration"],
  },
  {
    id: "export-entrypoints",
    command: npmCommand,
    args: ["run", "audit:export-entrypoints"],
  },
  {
    id: "future-model-entries",
    command: npmCommand,
    args: ["run", "audit:project-model-future"],
  },
  {
    id: "multisource-model-entries",
    command: npmCommand,
    args: ["run", "audit:project-model-multisource"],
  },
  {
    id: "camera-model-entries",
    command: npmCommand,
    args: ["run", "audit:project-model-camera"],
  },
  {
    id: "camera-migration",
    command: npmCommand,
    args: ["run", "audit:project-model-camera-migration"],
  },
  {
    id: "track-clip-compatibility",
    command: npmCommand,
    args: ["run", "audit:project-model-track-compatibility"],
  },
  {
    id: "project-model-lane-wrapping",
    command: npmCommand,
    args: ["run", "audit:project-model-lane-wrapping"],
  },
  {
    id: "project-model-track-hierarchy",
    command: npmCommand,
    args: ["run", "audit:project-model-track-hierarchy"],
  },
  {
    id: "project-model-asset-compatibility",
    command: npmCommand,
    args: ["run", "audit:project-model-asset-compatibility"],
  },
  {
    id: "project-model-ai-plan",
    command: npmCommand,
    args: ["run", "audit:project-model-ai-plan"],
  },
  {
    id: "project-model-review-packet",
    command: npmCommand,
    args: ["run", "audit:project-model-review-packet"],
  },
  {
    id: "project-model-sidecar-parity",
    command: npmCommand,
    args: ["run", "audit:project-model-sidecar-parity"],
  },
  {
    id: "project-model-review-doc",
    command: npmCommand,
    args: ["run", "audit:project-model-review-doc"],
  },
  {
    id: "export-audio-render-settings",
    command: npmCommand,
    args: ["run", "audit:export-audio-render-settings"],
  },
  {
    id: "preview-audio-render-settings",
    command: npmCommand,
    args: ["run", "audit:preview-audio-render-settings"],
  },
];

const results: Array<{ id: string; status: "ok" | "failed"; exitCode: number | null }> = [];

for (const step of steps) {
  console.log(`\n[phase1-audit] ${step.id}: ${step.command} ${step.args.join(" ")}`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  const exitCode = result.status;
  if (exitCode !== 0) {
    results.push({ id: step.id, status: "failed", exitCode });
    console.error(JSON.stringify({
      status: "failed",
      failedStep: step.id,
      results,
    }, null, 2));
    process.exit(exitCode ?? 1);
  }

  results.push({ id: step.id, status: "ok", exitCode });
}

console.log(JSON.stringify({
  status: "ok",
  results,
}, null, 2));
