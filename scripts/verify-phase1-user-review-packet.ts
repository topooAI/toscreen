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
  buildAcceptancePlan,
  parseHandsOnSteps,
  validateAcceptancePlanEvidence,
} from "./phase1AcceptancePlan";
import { parsePhase1AcceptanceState } from "./phase1AcceptanceState";
import { summarizeSceneMigration } from "./phase1SceneMigration";
import {
  auditProjectAssetFiles,
  summarizeMissingAssetFiles,
} from "./recordingAssetFiles";

const repoRoot = process.cwd();
const recordingsDir = process.argv[2] || path.join(
  os.homedir(),
  "Library/Application Support/toscreen/recordings",
);

const packageJsonPath = path.join(repoRoot, "package.json");
const acceptanceDocPath = path.join(
  repoRoot,
  "docs",
  "product",
  "Phase1-User-Acceptance-Record.md",
);
const reviewPacketPath = path.join(
  repoRoot,
  "docs",
  "product",
  "ProjectModel-Review-Packet.md",
);
const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "product",
  "Product-and-Editor-Architecture.md",
);

const requiredCapabilityPhrases = [
  "Screen recording",
  "Camera / Zoom / Focus",
  "Presenter / Digital human",
  "B-roll / Cutaway",
  "Lottie",
  "UI-aware motion",
  "AI Edit Plan",
];

const requiredReviewQuestions = [
  "这个模型是否能支撑 Phase 1 的 Screen Studio-grade foundation",
  "`Camera Clip` 是否给未来 3D 运镜留下足够空间",
  "多源画面在 Phase 1 是只保留模型入口，还是进入真实 UI 和剪辑能力",
  "`AI Edit Plan` 是否应该坚持“先生成可审阅计划，再应用到时间轴”",
  "Lottie 和 UI-aware motion 是 Phase 1 只做模型，还是开始做导入和编辑 UI",
  "当前 Track / Clip / Asset / Scene 结构是否足够支撑后续 AI 自动剪辑",
];

const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};
const acceptanceDoc = await fs.readFile(acceptanceDocPath, "utf8");
const reviewPacket = await fs.readFile(reviewPacketPath, "utf8");
const architectureDoc = await fs.readFile(architectureDocPath, "utf8");
const packageScripts = packageJson.scripts ?? {};

const acceptanceState = parsePhase1AcceptanceState(acceptanceDoc);
const acceptancePlan = buildAcceptancePlan(
  acceptanceState.checkedIds,
  parseHandsOnSteps(acceptanceDoc),
);

const warnings: string[] = [];
const errors = [
  ...validateAcceptancePlanEvidence(acceptancePlan, packageScripts),
  ...(typeof packageScripts["audit:project-model-default-scene"] === "string"
    ? []
    : ["Missing audit:project-model-default-scene script for Scene migration evidence."]),
  ...requiredCapabilityPhrases
    .filter((phrase) => !reviewPacket.includes(phrase))
    .map((phrase) => `ProjectModel review packet is missing capability phrase: ${phrase}`),
  ...requiredReviewQuestions
    .filter((phrase) => !reviewPacket.includes(phrase))
    .map((phrase) => `ProjectModel review packet is missing user review question: ${phrase}`),
];

if (!architectureDoc.includes("PH1-57 用户模型确认 / User model review")) {
  errors.push("Architecture doc is missing the PH1-57 user model review checkpoint.");
}
if (!architectureDoc.includes("sceneMigration")) {
  errors.push("Architecture doc is missing the sceneMigration review-packet note.");
}

const latestRecording = await findLatestRecording(recordingsDir, warnings, errors);
const status = errors.length > 0 ? "failed" : "ready";

console.log(JSON.stringify({
  status,
  purpose: "Phase 1 user review packet",
  phaseComplete: acceptanceState.phaseReleased,
  releaseBoundary: acceptanceState.phaseReleased
    ? "The acceptance record is marked released."
    : "This packet prepares user review but does not mark Phase 1 complete.",
  docs: {
    acceptanceRecord: "docs/product/Phase1-User-Acceptance-Record.md",
    projectModelReviewPacket: "docs/product/ProjectModel-Review-Packet.md",
    architecture: "docs/product/Product-and-Editor-Architecture.md",
  },
  commands: {
    machineGate: "npm run audit:phase1",
    readiness: "npm run audit:phase1-readiness",
    handoff: "npm run audit:phase1-handoff",
    startEditor: "npm run dev:editor",
  },
  userAcceptance: {
    accepted: acceptanceState.checkedIds,
    pending: acceptanceState.pendingIds,
    currentPhaseStatus: acceptanceState.currentPhaseStatus,
  },
  modelReview: {
    requiredCapabilities: requiredCapabilityPhrases,
    openQuestions: requiredReviewQuestions,
  },
  acceptancePlan: acceptancePlan.map((item) => ({
    id: item.id,
    label: item.label,
    status: item.status,
    machineEvidence: item.machineEvidence,
    step: item.step,
  })),
  latestRecording,
  nextHumanAction: acceptanceState.phaseReleased
    ? "Phase 1 is marked released; review the next phase plan before continuing."
    : "Open the latest recording in Electron, follow acceptancePlan, and only then check UA items in the acceptance record.",
  warnings,
  errors,
}, null, 2));

if (status === "failed") {
  process.exit(1);
}

async function findLatestRecording(
  directory: string,
  warnings: string[],
  errors: string[],
) {
  const files = await fs.readdir(directory).catch((error) => {
    errors.push(`Recordings directory is not readable: ${String(error)}`);
    return [] as string[];
  });
  const latestFile = files
    .filter((file) => file.startsWith("recording-"))
    .filter((file) => file.endsWith(".mov") || file.endsWith(".webm"))
    .filter((file) => !file.includes("-proxy"))
    .sort()
    .reverse()[0];

  if (!latestFile) {
    errors.push("No recording-*.mov or recording-*.webm file found for hands-on review.");
    return null;
  }

  const videoPath = path.join(directory, latestFile);
  const parsed = path.parse(videoPath);
  const proxyPath = path.join(parsed.dir, `${parsed.name}-proxy.mp4`);
  const audioPath = await findFirstExistingPath(companionAudioPathCandidatesForMediaPath(videoPath));
  const projectPath = await findFirstExistingPath(projectPathCandidatesForMediaPath(videoPath));

  if (!audioPath) warnings.push("Latest recording has no companion audio file.");
  if (!projectPath) {
    errors.push("Latest recording has no project sidecar for ProjectModel review.");
    return {
      path: videoPath,
      proxyPath: await pathExists(proxyPath) ? proxyPath : null,
      audioPath,
      projectPath: null,
      projectModel: null,
    };
  }

  const projectJson = await fs.readFile(projectPath, "utf8")
    .then((content) => JSON.parse(content))
    .catch((error) => {
      errors.push(`Latest project sidecar is not readable JSON: ${String(error)}`);
      return null;
    });
  const projectModel = projectJson?.projectModel;
  if (!projectModel) {
    errors.push("Latest project sidecar has no projectModel.");
    return {
      path: videoPath,
      proxyPath: await pathExists(proxyPath) ? proxyPath : null,
      audioPath,
      projectPath,
      projectModel: null,
    };
  }

  const validation = validateVideoEditorProject(projectModel);
  if (!validation.valid) {
    errors.push("Latest projectModel is invalid.");
  }
  const sceneMigration = summarizeSceneMigration(projectModel);
  const assetFiles = await auditProjectAssetFiles(projectModel);
  if (assetFiles.missing.length > 0) {
    errors.push(`Latest projectModel asset files are missing: ${summarizeMissingAssetFiles(assetFiles)}.`);
  }
  const restored = validation.valid
    ? restoreLegacyEditorStateFromProjectModel(projectModel)
    : null;
  const renderSettings = validation.valid
    ? getProjectRenderSettings(projectModel)
    : null;

  return {
    path: videoPath,
    proxyPath: await pathExists(proxyPath) ? proxyPath : null,
    audioPath,
    projectPath,
    projectModel: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      durationMs: projectModel.durationMs,
      assets: projectModel.assets?.length ?? 0,
      tracks: projectModel.tracks?.length ?? 0,
      clips: projectModel.clips?.length ?? 0,
      scenes: projectModel.scenes?.length ?? 0,
      sceneMigration,
      assetFiles,
      aiEditPlans: projectModel.aiEditPlans?.length ?? 0,
      restored: restored ? {
        zoomRegions: restored.zoomRegions.length,
        audioRegions: restored.audioRegions.length,
        cursorPoints: restored.cursorData?.length ?? 0,
        annotationRegions: restored.annotationRegions.length,
      } : null,
      renderSettings: renderSettings ? {
        wallpaper: renderSettings.canvas.wallpaper,
        showBlur: renderSettings.canvas.showBlur,
        motionBlurEnabled: renderSettings.effects.motionBlurEnabled,
        exportQuality: renderSettings.exportSettings.quality,
        durationMs: renderSettings.durationMs,
      } : null,
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
