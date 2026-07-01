import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  companionAudioPathCandidatesForMediaPath,
  projectPathCandidatesForMediaPath,
} from "../electron/ipc/projectFiles";
import {
  getProjectRenderSettings,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";
import {
  parsePhase1AcceptanceState,
  phase1AcceptanceItems,
} from "./phase1AcceptanceState";
import {
  buildAcceptancePlan,
  parseHandsOnSteps,
  validateAcceptancePlanEvidence,
} from "./phase1AcceptancePlan";
import { summarizeSceneMigration } from "./phase1SceneMigration";

type HandoffStatus = "ready" | "blocked";

const repoRoot = process.cwd();
const acceptanceDocPath = path.join(repoRoot, "docs", "product", "Phase1-User-Acceptance-Record.md");
const packageJsonPath = path.join(repoRoot, "package.json");
const recordingsDir = process.argv[2] || path.join(
  os.homedir(),
  "Library/Application Support/toscreen/recordings",
);

const handoff = await buildHandoffPacket(recordingsDir);

console.log(JSON.stringify(handoff, null, 2));

if (handoff.status === "blocked") {
  process.exit(1);
}

async function buildHandoffPacket(directory: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const acceptanceContent = await fs.readFile(acceptanceDocPath, "utf8").catch((error) => {
    errors.push(`Phase 1 acceptance record is not readable: ${String(error)}`);
    return "";
  });
  const acceptance = parsePhase1AcceptanceState(acceptanceContent);
  const handsOnSteps = parseHandsOnSteps(acceptanceContent);
  const missingHandsOnStepIds = phase1AcceptanceItems
    .map((item) => item.id)
    .filter((id) => !handsOnSteps.some((step) => step.id === id));
  if (missingHandsOnStepIds.length > 0) {
    errors.push(`Phase 1 hands-on steps are missing for: ${missingHandsOnStepIds.join(", ")}`);
  }
  const acceptancePlan = buildAcceptancePlan(acceptance.checkedIds, handsOnSteps);
  const packageJson = await readPackageJson(errors);
  const packageScripts = packageJson?.scripts ?? {};
  errors.push(...validateAcceptancePlanEvidence(acceptancePlan, packageScripts));
  if (typeof packageScripts["audit:project-model-default-scene"] !== "string") {
    errors.push("Missing audit:project-model-default-scene script for Scene migration evidence.");
  }
  const latestRecording = await findLatestRecording(directory, errors, warnings);
  const projectPath = latestRecording
    ? await findFirstExistingPath(projectPathCandidatesForMediaPath(latestRecording.path))
    : null;
  const audioPath = latestRecording
    ? await findFirstExistingPath(companionAudioPathCandidatesForMediaPath(latestRecording.path))
    : null;

  let projectModelSummary: Record<string, unknown> = {
    present: false,
  };

  if (!latestRecording) {
    errors.push("No latest recording is available for hands-on acceptance.");
  }

  if (!projectPath) {
    errors.push("No .project.json sidecar is available for the latest recording.");
  } else {
    projectModelSummary = await summarizeProjectModel(projectPath, errors);
  }

  const status: HandoffStatus = errors.length > 0 ? "blocked" : "ready";

  return {
    status,
    purpose: "Phase 1 hands-on acceptance handoff packet",
    commands: {
      machineGate: "npm run audit:phase1",
      startEditor: "npm run dev:editor",
      readiness: "npm run audit:phase1-readiness",
    },
    editorRuntime: {
      startCommand: "npm run dev:editor",
      expectedDevServerUrl: "http://localhost:5173",
      windowTypeEnv: "TOSCREEN_DEV_WINDOW_TYPE=editor",
      expectedWindow: "Electron should open the editor window directly through createEditorWindow.",
      hotUpdate: "Renderer changes should arrive through Vite HMR on localhost without recording again.",
      machineEvidence: "npm run audit:electron-editor-runtime",
    },
    docs: {
      acceptanceRecord: "docs/product/Phase1-User-Acceptance-Record.md",
      projectModelReviewPacket: "docs/product/ProjectModel-Review-Packet.md",
      architecture: "docs/product/Product-and-Editor-Architecture.md",
    },
    recordingsDir: directory,
    latestRecording: latestRecording ? {
      path: latestRecording.path,
      proxyPath: latestRecording.proxyPath,
      audioPath,
      projectPath,
    } : null,
    projectModel: projectModelSummary,
    userAcceptance: {
      accepted: acceptance.checkedIds,
      pending: acceptance.pendingIds.map((id) => ({
        id,
        label: phase1AcceptanceItems.find((item) => item.id === id)?.label ?? id,
      })),
      currentPhaseStatus: acceptance.currentPhaseStatus,
      phaseReleased: acceptance.phaseReleased,
    },
    handsOnSteps,
    acceptancePlan,
    nextHumanAction: acceptance.phaseReleased
      ? "Phase 1 acceptance is already marked released."
      : "Open Electron with npm run dev:editor, load the latest recording, and follow acceptancePlan for UA-01 through UA-08.",
    warnings,
    errors,
  };
}

async function readPackageJson(errors: string[]) {
  return fs.readFile(packageJsonPath, "utf8")
    .then((content) => JSON.parse(content) as { scripts?: Record<string, string> })
    .catch((error) => {
      errors.push(`package.json is not readable for acceptance evidence validation: ${String(error)}`);
      return null;
    });
}

async function findLatestRecording(
  directory: string,
  errors: string[],
  warnings: string[],
) {
  const files = await fs.readdir(directory).catch((error) => {
    errors.push(`Recordings directory is not readable: ${String(error)}`);
    return [] as string[];
  });
  const videoFiles = files
    .filter((file) => (
      file.startsWith("recording-") &&
      !file.endsWith("-proxy.mp4") &&
      (file.endsWith(".webm") || file.endsWith(".mov"))
    ))
    .sort()
    .reverse();

  const latestVideo = videoFiles[0];
  if (!latestVideo) {
    warnings.push("No recording-*.webm or recording-*.mov files found.");
    return null;
  }

  const videoPath = path.join(directory, latestVideo);
  const parsed = path.parse(videoPath);
  const proxyPath = path.join(parsed.dir, `${parsed.name}-proxy.mp4`);
  return {
    path: videoPath,
    proxyPath: await pathExists(proxyPath) ? proxyPath : null,
  };
}

async function summarizeProjectModel(projectPath: string, errors: string[]) {
  const rawProject = await fs.readFile(projectPath, "utf8").then(JSON.parse).catch((error) => {
    errors.push(`Project sidecar is not readable: ${String(error)}`);
    return null;
  });

  if (!rawProject?.projectModel) {
    errors.push("Project sidecar has no projectModel.");
    return { present: false };
  }

  const validation = validateVideoEditorProject(rawProject.projectModel);
  if (!validation.valid) {
    errors.push("ProjectModel sidecar is invalid.");
    return {
      present: true,
      valid: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const restored = restoreLegacyEditorStateFromProjectModel(rawProject.projectModel);
  const renderSettings = getProjectRenderSettings(rawProject.projectModel);
  const sceneMigration = summarizeSceneMigration(rawProject.projectModel);

  return {
    present: true,
    valid: true,
    durationMs: rawProject.projectModel.durationMs,
    assets: rawProject.projectModel.assets?.length ?? 0,
    tracks: rawProject.projectModel.tracks?.length ?? 0,
    clips: rawProject.projectModel.clips?.length ?? 0,
    scenes: rawProject.projectModel.scenes?.length ?? 0,
    sceneMigration,
    warnings: validation.warnings,
    coreRestore: {
      zoomRegions: restored.zoomRegions.length,
      audioRegions: restored.audioRegions.length,
      cursorPoints: restored.cursorData?.length ?? 0,
      annotationRegions: restored.annotationRegions.length,
      wallpaper: renderSettings.canvas.wallpaper,
      showBlur: renderSettings.canvas.showBlur,
      motionBlurEnabled: renderSettings.effects.motionBlurEnabled,
      exportQuality: renderSettings.exportSettings.quality,
    },
  };
}

async function pathExists(filePath: string) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

async function findFirstExistingPath(candidates: string[]) {
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}
