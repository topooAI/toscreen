import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const tsxCommand = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  isWindows ? "tsx.cmd" : "tsx",
);

const outputPath = path.join(os.tmpdir(), `toscreen-project-model-smoke-${process.pid}.project.json`);

try {
  runStep("create-project-model-smoke-fixture", [
    "scripts/create-project-model-smoke-fixture.ts",
    outputPath,
  ]);
  runStep("verify-project-model", [
    "scripts/verify-project-model.ts",
    outputPath,
  ]);

  const savedProject = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const projectModel = savedProject.projectModel;
  if (!projectModel) {
    fail("Smoke fixture did not include projectModel.");
  }
  assertEqual(projectModel.assets.length, 5, "assets.length");
  assertEqual(projectModel.tracks.length, 5, "tracks.length");
  assertEqual(projectModel.clips.length, 4, "clips.length");
  assertEqual(projectModel.durationMs, 10000, "durationMs");

  console.log(JSON.stringify({
    status: "ok",
    fixturePath: outputPath,
    assets: projectModel.assets.length,
    tracks: projectModel.tracks.length,
    clips: projectModel.clips.length,
    durationMs: projectModel.durationMs,
  }, null, 2));
} finally {
  try {
    fs.unlinkSync(outputPath);
  } catch {
    // Best-effort cleanup only.
  }
}

function runStep(id: string, args: string[]) {
  const result = spawnSync(tsxCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`${id} failed.`, { exitCode: result.status });
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (!Object.is(actual, expected)) {
    fail(`Expected ${label} to be ${String(expected)}, got ${String(actual)}.`);
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
