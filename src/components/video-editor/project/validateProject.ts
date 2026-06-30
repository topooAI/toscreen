import type { ProjectAsset, ProjectClip, ProjectScene, ProjectTrack, VideoEditorProject } from "./types";

export interface ProjectValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateVideoEditorProject(projectInput: unknown): ProjectValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(projectInput)) {
    return {
      valid: false,
      errors: ["Project must be an object."],
      warnings,
    };
  }

  const project = projectInput as Partial<VideoEditorProject>;

  if (!project.id) errors.push("Project id is required.");
  if (project.schemaVersion !== 1) errors.push(`Unsupported project schema version: ${project.schemaVersion}.`);
  if (typeof project.durationMs !== "number" || !Number.isFinite(project.durationMs) || project.durationMs < 0) {
    errors.push("Project durationMs must be a finite non-negative number.");
  }
  if (!project.canvas) errors.push("Project canvas settings are required.");
  const assets = Array.isArray(project.assets) ? project.assets : [];
  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  const clips = Array.isArray(project.clips) ? project.clips : [];
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  if (!Array.isArray(project.assets)) errors.push("Project assets must be an array.");
  if (!Array.isArray(project.tracks)) errors.push("Project tracks must be an array.");
  if (!Array.isArray(project.clips)) errors.push("Project clips must be an array.");
  if (!Array.isArray(project.scenes)) errors.push("Project scenes must be an array.");

  const assetIds = new Set<string>();
  assets.forEach((asset: ProjectAsset, index) => {
    if (!isRecord(asset)) {
      errors.push(`Asset at index ${index} must be an object.`);
      return;
    }
    if (!asset.id) errors.push("Asset id is required.");
    if (assetIds.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}.`);
    assetIds.add(asset.id);
    if (!asset.type) errors.push(`Asset ${asset.id || "(missing id)"} type is required.`);
    if (!asset.sourceUrl) warnings.push(`Asset ${asset.id || "(missing id)"} has no sourceUrl.`);
  });

  const trackIds = new Set<string>();
  tracks.forEach((track: ProjectTrack, index) => {
    if (!isRecord(track)) {
      errors.push(`Track at index ${index} must be an object.`);
      return;
    }
    if (!track.id) errors.push("Track id is required.");
    if (trackIds.has(track.id)) errors.push(`Duplicate track id: ${track.id}.`);
    trackIds.add(track.id);
    if (!track.type) errors.push(`Track ${track.id || "(missing id)"} type is required.`);
    if (!Number.isFinite(track.order)) errors.push(`Track ${track.id || "(missing id)"} order must be finite.`);
  });

  const clipIds = new Set<string>();
  clips.forEach((clip: ProjectClip, index) => {
    if (!isRecord(clip)) {
      errors.push(`Clip at index ${index} must be an object.`);
      return;
    }
    if (!clip.id) errors.push("Clip id is required.");
    if (clipIds.has(clip.id)) errors.push(`Duplicate clip id: ${clip.id}.`);
    clipIds.add(clip.id);

    if (!trackIds.has(clip.trackId)) {
      errors.push(`Clip ${clip.id || "(missing id)"} references missing track ${clip.trackId}.`);
    }
    if (clip.assetId && !assetIds.has(clip.assetId)) {
      errors.push(`Clip ${clip.id || "(missing id)"} references missing asset ${clip.assetId}.`);
    }
    if (!Number.isFinite(clip.startMs) || !Number.isFinite(clip.endMs)) {
      errors.push(`Clip ${clip.id || "(missing id)"} startMs/endMs must be finite.`);
    } else if (clip.endMs < clip.startMs) {
      errors.push(`Clip ${clip.id || "(missing id)"} endMs is before startMs.`);
    } else if (clip.endMs === clip.startMs) {
      warnings.push(`Clip ${clip.id || "(missing id)"} has zero duration.`);
    }
    if (typeof project.durationMs === "number" && clip.endMs > project.durationMs) {
      warnings.push(`Clip ${clip.id || "(missing id)"} extends beyond project duration.`);
    }
  });

  scenes.forEach((scene: ProjectScene, index) => {
    if (!isRecord(scene)) {
      errors.push(`Scene at index ${index} must be an object.`);
      return;
    }
    if (!scene.id) errors.push("Scene id is required.");
    if (!Number.isFinite(scene.startMs) || !Number.isFinite(scene.endMs)) {
      errors.push(`Scene ${scene.id || "(missing id)"} startMs/endMs must be finite.`);
    } else if (scene.endMs < scene.startMs) {
      errors.push(`Scene ${scene.id || "(missing id)"} endMs is before startMs.`);
    }
    if (!Array.isArray(scene.clipIds)) {
      errors.push(`Scene ${scene.id || "(missing id)"} clipIds must be an array.`);
    } else {
      scene.clipIds.forEach((clipId) => {
        if (!clipIds.has(clipId)) {
          errors.push(`Scene ${scene.id || "(missing id)"} references missing clip ${clipId}.`);
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
