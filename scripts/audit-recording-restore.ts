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
import { summarizeSceneMigration } from "./phase1SceneMigration";
import {
  auditProjectAssetFiles,
  type ProjectAssetFileAudit,
  summarizeMissingAssetFiles,
} from "./recordingAssetFiles";

type AuditStatus = "ok" | "warn" | "fail";

const recordingsDir = process.argv[2] || path.join(
  os.homedir(),
  "Library/Application Support/toscreen/recordings",
);

const result = await auditRecordingRestore(recordingsDir);

console.log(JSON.stringify(result, null, 2));

if (result.status === "fail") {
  process.exit(1);
}

async function auditRecordingRestore(directory: string) {
  const warnings: string[] = [];
  const errors: string[] = [];

  const files = await fs.readdir(directory).catch((error) => {
    warnings.push(`Recordings directory is not readable: ${String(error)}`);
    return [] as string[];
  });

  const videoFiles = files
    .filter((file) => file.startsWith("recording-") && (file.endsWith(".webm") || file.endsWith(".mov")))
    .sort()
    .reverse();

  const latestVideo = videoFiles[0];
  if (!latestVideo) {
    return {
      status: "warn" as AuditStatus,
      recordingsDir: directory,
      warnings: [...warnings, "No recording-*.webm or recording-*.mov files found."],
      errors,
    };
  }

  const videoPath = path.join(directory, latestVideo);
  const parsed = path.parse(videoPath);
  const proxyPath = path.join(parsed.dir, `${parsed.name}-proxy.mp4`);
  const hasProxy = await pathExists(proxyPath);
  const audioCandidates = companionAudioPathCandidatesForMediaPath(videoPath);
  const audioPath = await findFirstExistingPath(audioCandidates);
  const projectCandidates = projectPathCandidatesForMediaPath(videoPath);
  const projectPath = await findFirstExistingPath(projectCandidates);

  let projectModel: {
    present: boolean;
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
    durationMs?: number;
    assets?: number;
    tracks?: number;
    clips?: number;
    scenes?: number;
    sceneMigration?: ReturnType<typeof summarizeSceneMigration>;
    assetFiles?: ProjectAssetFileAudit;
    restoredCompanionAudioPath?: string | null;
    coreRestore?: {
      sourceCameraClips: number;
      restoredZoomRegions: number;
      sourceAudioClips: number;
      restoredAudioRegions: number;
      sourceCursorClips: number;
      restoredCursorPoints: number;
      wallpaper: string;
      showBlur: boolean;
      motionBlurEnabled: boolean;
      exportQuality: string;
    };
  } = { present: false };

  if (!projectPath) {
    warnings.push("No .project.json found for the latest recording.");
  } else {
    const rawProject = await fs.readFile(projectPath, "utf8").then(JSON.parse).catch((error) => {
      errors.push(`Failed to read project JSON: ${String(error)}`);
      return null;
    });

    if (rawProject?.projectModel) {
      const validation = validateVideoEditorProject(rawProject.projectModel);
      const restored = validation.valid
        ? restoreLegacyEditorStateFromProjectModel(rawProject.projectModel)
        : null;
      const renderSettings = validation.valid
        ? getProjectRenderSettings(rawProject.projectModel)
        : null;
      const sourceCameraClips = countClips(rawProject.projectModel, "camera");
      const sourceAudioClips = countClips(rawProject.projectModel, "audio");
      const sourceCursorClips = countClips(rawProject.projectModel, "cursor");
      const restoredZoomRegions = restored?.zoomRegions.length ?? 0;
      const restoredAudioRegions = restored?.audioRegions.length ?? 0;
      const restoredCursorPoints = restored?.cursorData?.length ?? 0;
      const sceneMigration = summarizeSceneMigration(rawProject.projectModel);
      const assetFiles = await auditProjectAssetFiles(rawProject.projectModel);

      projectModel = {
        present: true,
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        durationMs: rawProject.projectModel.durationMs,
        assets: rawProject.projectModel.assets?.length,
        tracks: rawProject.projectModel.tracks?.length,
        clips: rawProject.projectModel.clips?.length,
        scenes: rawProject.projectModel.scenes?.length,
        sceneMigration,
        assetFiles,
        restoredCompanionAudioPath: restored?.companionAudioPath ?? null,
        ...(renderSettings ? {
          coreRestore: {
            sourceCameraClips,
            restoredZoomRegions,
            sourceAudioClips,
            restoredAudioRegions,
            sourceCursorClips,
            restoredCursorPoints,
            wallpaper: renderSettings.canvas.wallpaper,
            showBlur: renderSettings.canvas.showBlur,
            motionBlurEnabled: renderSettings.effects.motionBlurEnabled,
            exportQuality: renderSettings.exportSettings.quality,
          },
        } : {}),
      };
      if (!validation.valid) errors.push("ProjectModel sidecar is invalid.");
      if (validation.valid) {
        if (assetFiles.missing.length > 0) {
          errors.push(`ProjectModel asset files are missing: ${summarizeMissingAssetFiles(assetFiles)}.`);
        }
        if (sourceCameraClips > 0 && restoredZoomRegions !== sourceCameraClips) {
          errors.push(`Camera restore mismatch: expected ${sourceCameraClips} restored zoom regions, got ${restoredZoomRegions}.`);
        }
        if (sourceAudioClips > 0 && restoredAudioRegions < sourceAudioClips) {
          errors.push(`Audio restore mismatch: expected at least ${sourceAudioClips} restored audio regions, got ${restoredAudioRegions}.`);
        }
        if (sourceCursorClips > 0 && restoredCursorPoints <= 0) {
          errors.push("Cursor restore mismatch: cursor clip exists but restored cursor data is empty.");
        }
        if (!renderSettings?.canvas.wallpaper) {
          errors.push("Canvas restore mismatch: restored wallpaper is empty.");
        }
        if (!renderSettings?.exportSettings.quality) {
          errors.push("Export settings restore mismatch: restored export quality is empty.");
        }
      }
    } else {
      warnings.push("Project file exists but has no projectModel sidecar.");
    }
  }

  const status: AuditStatus = errors.length > 0
    ? "fail"
    : warnings.length > 0
      ? "warn"
      : "ok";

  return {
    status,
    recordingsDir: directory,
    latestVideo: {
      path: videoPath,
      proxyPath: hasProxy ? proxyPath : null,
      audioPath: audioPath ?? null,
      projectPath: projectPath ?? null,
    },
    candidates: {
      audio: audioCandidates,
      project: projectCandidates,
    },
    projectModel,
    warnings,
    errors,
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

function countClips(project: { clips?: Array<{ type?: string }> }, type: string) {
  return project.clips?.filter((clip) => clip.type === type).length ?? 0;
}
