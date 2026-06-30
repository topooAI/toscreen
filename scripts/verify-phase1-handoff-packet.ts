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

type HandoffStatus = "ready" | "blocked";
type HandsOnStep = {
  id: string;
  label: string;
  step: string;
  failureNote: string;
};
type AcceptancePlanItem = HandsOnStep & {
  status: "accepted" | "pending";
  machineEvidence: string[];
};

const machineEvidenceByAcceptanceId: Record<string, string[]> = {
  "UA-01": [
    "npm run audit:project-model-review-doc",
    "npm run audit:project-model-review-packet",
  ],
  "UA-02": [
    "npm run audit:recordings",
    "npm run audit:project-model-restore",
    "npm run audit:project-model-sidecar-parity",
  ],
  "UA-03": [
    "npm run audit:timeline-acceptance-doc",
    "npm run audit:electron-editor-runtime",
  ],
  "UA-04": [
    "npm run audit:screenstudio-core-contract",
    "npm run audit:electron-editor-runtime",
  ],
  "UA-05": [
    "npm run audit:preview-export-contract",
    "npm run audit:export-duration-render-settings",
    "npm run audit:export-black-tail-rendering",
  ],
  "UA-06": [
    "npm run audit:project-model-camera",
    "npm run audit:project-model-camera-migration",
  ],
  "UA-07": [
    "npm run audit:project-model-ai-plan",
    "npm run audit:project-model-ai-plan-lifecycle",
  ],
  "UA-08": [
    "npm run audit:phase1-readiness",
    "npm run audit:phase1-acceptance-state",
  ],
};

const repoRoot = process.cwd();
const acceptanceDocPath = path.join(repoRoot, "docs", "product", "Phase1-User-Acceptance-Record.md");
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

function buildAcceptancePlan(
  checkedIds: string[],
  handsOnSteps: HandsOnStep[],
): AcceptancePlanItem[] {
  const stepById = new Map(handsOnSteps.map((step) => [step.id, step]));
  return phase1AcceptanceItems.map((item) => {
    const step = stepById.get(item.id);
    return {
      id: item.id,
      label: item.label,
      status: checkedIds.includes(item.id) ? "accepted" : "pending",
      step: step?.step ?? "",
      failureNote: step?.failureNote ?? "",
      machineEvidence: machineEvidenceByAcceptanceId[item.id] ?? [],
    };
  });
}

function parseHandsOnSteps(content: string): HandsOnStep[] {
  const itemById = new Map(phase1AcceptanceItems.map((item) => [item.id, item]));
  const sectionStart = content.indexOf("### 3.1 实机验收步骤 / Hands-On Acceptance Steps");
  if (sectionStart < 0) return [];
  const nextSectionStart = content.indexOf("\n## 4.", sectionStart);
  const section = nextSectionStart >= 0
    ? content.slice(sectionStart, nextSectionStart)
    : content.slice(sectionStart);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("| UA-"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      id: cells[1],
      step: cells[2],
      failureNote: cells[3],
    }))
    .filter(({ id, step, failureNote }) => (
      itemById.has(id) &&
      step.length > 0 &&
      failureNote.length > 0 &&
      step !== "实机步骤 / Hands-On Step" &&
      failureNote !== "失败记录 / Failure Note"
    ))
    .map(({ id, step, failureNote }) => ({
      id,
      label: itemById.get(id)?.label ?? id,
      step,
      failureNote,
    }));
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

  return {
    present: true,
    valid: true,
    durationMs: rawProject.projectModel.durationMs,
    assets: rawProject.projectModel.assets?.length ?? 0,
    tracks: rawProject.projectModel.tracks?.length ?? 0,
    clips: rawProject.projectModel.clips?.length ?? 0,
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
