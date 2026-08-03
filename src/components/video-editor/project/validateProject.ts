import type {
  AIEditPlan,
  ProjectAsset,
  ProjectClip,
  ProjectScene,
  ProjectTrack,
  ProjectUISource,
  VideoEditorProject,
} from "./types";

export interface ProjectValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_ASSET_TYPES = [
  "screen-recording",
  "video",
  "audio",
  "image",
  "lottie",
  "digital-human",
  "ui-source",
  "cursor-data",
  "font",
] as const;

const VALID_TRACK_TYPES = [
  "video",
  "camera",
  "presenter",
  "text",
  "annotation",
  "lottie",
  "image",
  "ui-motion",
  "audio",
  "voice",
  "music",
  "cursor",
] as const;

const VALID_CLIP_TYPES = [
  "screen-recording",
  "video",
  "audio",
  "camera",
  "presenter",
  "text",
  "annotation",
  "lottie",
  "image",
  "ui-element-motion",
  "cursor",
] as const;

const VALID_UI_SOURCE_PROVIDERS = [
  "figma",
  "dom-snapshot",
  "screenshot",
  "design-file",
  "manual",
] as const;

const VALID_UI_ELEMENT_ROLES = [
  "frame",
  "component",
  "text",
  "button",
  "input",
  "image",
  "icon",
  "custom",
] as const;

const VALID_LEGACY_REGION_TYPES = [
  "zoom",
  "trim",
  "annotation",
  "audio",
  "screen-recording",
  "cursor",
] as const;

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

  if (typeof project.id !== "string" || !project.id.trim()) errors.push("Project id is required.");
  if (typeof project.name !== "string" || !project.name.trim()) errors.push("Project name is required.");
  if (typeof project.createdAt !== "string" || !project.createdAt.trim()) {
    errors.push("Project createdAt is required.");
  }
  if (typeof project.updatedAt !== "string" || !project.updatedAt.trim()) {
    errors.push("Project updatedAt is required.");
  }
  if (project.schemaVersion !== 1) errors.push(`Unsupported project schema version: ${project.schemaVersion}.`);
  if (typeof project.durationMs !== "number" || !Number.isFinite(project.durationMs) || project.durationMs < 0) {
    errors.push("Project durationMs must be a finite non-negative number.");
  }
  if (!project.canvas) {
    errors.push("Project canvas settings are required.");
  } else {
    validateProjectCanvasSettings(project.canvas, errors);
  }
  validateProjectExportSettings(project.exportSettings, errors);
  validateLegacyRuntimeSettings(project.legacyState, errors);
  validateEditingDocument(project.editingDocument, errors);
  const assets = Array.isArray(project.assets) ? project.assets : [];
  const uiSources = Array.isArray(project.uiSources) ? project.uiSources : [];
  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  const clips = Array.isArray(project.clips) ? project.clips : [];
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const aiEditPlans = Array.isArray(project.aiEditPlans) ? project.aiEditPlans : [];
  if (!Array.isArray(project.assets)) errors.push("Project assets must be an array.");
  if (project.uiSources !== undefined && !Array.isArray(project.uiSources)) {
    errors.push("Project uiSources must be an array.");
  }
  if (!Array.isArray(project.tracks)) errors.push("Project tracks must be an array.");
  if (!Array.isArray(project.clips)) errors.push("Project clips must be an array.");
  if (!Array.isArray(project.scenes)) errors.push("Project scenes must be an array.");
  if (project.aiEditPlans !== undefined && !Array.isArray(project.aiEditPlans)) {
    errors.push("Project aiEditPlans must be an array.");
  }

  const assetIds = new Set<string>();
  const assetsById = new Map<string, ProjectAsset>();
  assets.forEach((asset: ProjectAsset, index) => {
    if (!isRecord(asset)) {
      errors.push(`Asset at index ${index} must be an object.`);
      return;
    }
    if (typeof asset.id !== "string" || !asset.id.trim()) {
      errors.push("Asset id is required.");
    } else {
      if (assetIds.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}.`);
      assetIds.add(asset.id);
      assetsById.set(asset.id, asset);
    }
    if (!isOneOf(asset.type, VALID_ASSET_TYPES)) {
      errors.push(`Asset ${asset.id || "(missing id)"} type is invalid or missing.`);
    }
    if (typeof asset.name !== "string" || !asset.name.trim()) {
      errors.push(`Asset ${asset.id || "(missing id)"} name is required.`);
    }
    if (!asset.sourceUrl) warnings.push(`Asset ${asset.id || "(missing id)"} has no sourceUrl.`);
  });

  const uiSourceIds = new Set<string>();
  const uiElementIdsBySource = new Map<string, Set<string>>();
  uiSources.forEach((uiSource: ProjectUISource, index) => {
    if (!isRecord(uiSource)) {
      errors.push(`UI source at index ${index} must be an object.`);
      return;
    }
    if (typeof uiSource.id !== "string" || !uiSource.id.trim()) {
      errors.push("UI source id is required.");
    } else {
      if (uiSourceIds.has(uiSource.id)) errors.push(`Duplicate UI source id: ${uiSource.id}.`);
      uiSourceIds.add(uiSource.id);
    }
    if (typeof uiSource.name !== "string" || !uiSource.name.trim()) {
      errors.push(`UI source ${uiSource.id || "(missing id)"} name is required.`);
    }
    if (!isOneOf(uiSource.provider, VALID_UI_SOURCE_PROVIDERS)) {
      errors.push(`UI source ${uiSource.id || "(missing id)"} provider is invalid or missing.`);
    }
    validateOptionalString(uiSource.sourceUrl, `UI source ${uiSource.id || "(missing id)"} sourceUrl`, errors);
    validateOptionalString(uiSource.filePath, `UI source ${uiSource.id || "(missing id)"} filePath`, errors);
    validateOptionalString(uiSource.capturedAt, `UI source ${uiSource.id || "(missing id)"} capturedAt`, errors);
    if (!Array.isArray(uiSource.elements)) {
      errors.push(`UI source ${uiSource.id || "(missing id)"} elements must be an array.`);
      return;
    }

    const elementIds = new Set<string>();
    uiSource.elements.forEach((element, elementIndex) => {
      if (!isRecord(element)) {
        errors.push(`UI source ${uiSource.id || "(missing id)"} element at index ${elementIndex} must be an object.`);
        return;
      }
      if (typeof element.id !== "string" || !element.id.trim()) {
        errors.push(`UI source ${uiSource.id || "(missing id)"} element id is required.`);
      } else {
        if (elementIds.has(element.id)) {
          errors.push(`UI source ${uiSource.id || "(missing id)"} has duplicate element id: ${element.id}.`);
        }
        elementIds.add(element.id);
      }
      validateOptionalString(element.name, `UI source ${uiSource.id || "(missing id)"} element ${element.id || "(missing id)"} name`, errors);
      validateOptionalString(element.stableSelector, `UI source ${uiSource.id || "(missing id)"} element ${element.id || "(missing id)"} stableSelector`, errors);
      if (element.role !== undefined && !isOneOf(element.role, VALID_UI_ELEMENT_ROLES)) {
        errors.push(`UI source ${uiSource.id || "(missing id)"} element ${element.id || "(missing id)"} role is invalid.`);
      }
      validateOptionalUIElementBounds(
        element.bounds,
        `UI source ${uiSource.id || "(missing id)"} element ${element.id || "(missing id)"} bounds`,
        errors,
      );
    });
    uiElementIdsBySource.set(uiSource.id, elementIds);
  });

  const trackIds = new Set<string>();
  const tracksById = new Map<string, ProjectTrack>();
  tracks.forEach((track: ProjectTrack, index) => {
    if (!isRecord(track)) {
      errors.push(`Track at index ${index} must be an object.`);
      return;
    }
    if (typeof track.id !== "string" || !track.id.trim()) {
      errors.push("Track id is required.");
    } else {
      if (trackIds.has(track.id)) errors.push(`Duplicate track id: ${track.id}.`);
      trackIds.add(track.id);
      tracksById.set(track.id, track);
    }
    if (!isOneOf(track.type, VALID_TRACK_TYPES)) {
      errors.push(`Track ${track.id || "(missing id)"} type is invalid or missing.`);
    }
    if (typeof track.name !== "string" || !track.name.trim()) {
      errors.push(`Track ${track.id || "(missing id)"} name is required.`);
    }
    if (!Number.isFinite(track.order)) errors.push(`Track ${track.id || "(missing id)"} order must be finite.`);
  });
  tracks.forEach((track) => {
    if (!isRecord(track) || !track.id || !track.parentId) return;
    const parentTrack = tracksById.get(track.parentId);
    if (track.parentId === track.id) {
      errors.push(`Track ${track.id} cannot use itself as parent.`);
    } else if (!parentTrack) {
      errors.push(`Track ${track.id} references missing parent track ${track.parentId}.`);
    } else if (parentTrack.type !== track.type) {
      errors.push(`Track ${track.id} type ${track.type} must match parent track ${parentTrack.id} type ${parentTrack.type}.`);
    }
  });

  const clipIds = new Set<string>();
  const clipsById = new Map<string, ProjectClip>();
  const clipsByTrackId = new Map<string, ProjectClip[]>();
  clips.forEach((clip: ProjectClip, index) => {
    if (!isRecord(clip)) {
      errors.push(`Clip at index ${index} must be an object.`);
      return;
    }
    if (typeof clip.id !== "string" || !clip.id.trim()) {
      errors.push("Clip id is required.");
    } else {
      if (clipIds.has(clip.id)) errors.push(`Duplicate clip id: ${clip.id}.`);
      clipIds.add(clip.id);
      clipsById.set(clip.id, clip);
    }
    if (!isOneOf(clip.type, VALID_CLIP_TYPES)) {
      errors.push(`Clip ${clip.id || "(missing id)"} type is invalid or missing.`);
    }

    const clipLabel = `Clip ${clip.id || "(missing id)"}`;
    if (clip.name !== undefined && typeof clip.name !== "string") {
      errors.push(`${clipLabel} name must be a string.`);
    }
    validateOptionalClipSourceRange(clip, clipLabel, errors);
    validateOptionalClipLegacy(clip, clipLabel, errors);

    let track: ProjectTrack | undefined;
    if (typeof clip.trackId !== "string" || !clip.trackId.trim()) {
      errors.push(`${clipLabel} trackId is required.`);
    } else {
      if (!trackIds.has(clip.trackId)) {
        errors.push(`${clipLabel} references missing track ${clip.trackId}.`);
      }
      track = tracksById.get(clip.trackId);
    }
    if (track && !isClipCompatibleWithTrack(clip.type, track.type)) {
      errors.push(`Clip ${clip.id || "(missing id)"} type ${clip.type} cannot be placed on track ${track.id} type ${track.type}.`);
    }
    let asset: ProjectAsset | undefined;
    if (clip.assetId !== undefined && typeof clip.assetId !== "string") {
      errors.push(`${clipLabel} assetId must be a string.`);
    } else if (clip.assetId) {
      if (!assetIds.has(clip.assetId)) {
        errors.push(`Clip ${clip.id || "(missing id)"} references missing asset ${clip.assetId}.`);
      }
      asset = assetsById.get(clip.assetId);
    }
    if (asset && !isClipCompatibleWithAsset(clip.type, asset.type)) {
      errors.push(`Clip ${clip.id || "(missing id)"} type ${clip.type} cannot reference asset ${asset.id} type ${asset.type}.`);
    }
    if (clip.type === "screen-recording") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      if (!props) {
        errors.push(`Screen recording clip ${clip.id || "(missing id)"} props are required.`);
      } else {
        if (!isOneOf(props.fitMode, ["contain", "cover", "fill"])) {
          errors.push(`Screen recording clip ${clip.id || "(missing id)"} fitMode is invalid or missing.`);
        }
        if (props.freezeAfterEnd !== undefined && typeof props.freezeAfterEnd !== "boolean") {
          errors.push(`Screen recording clip ${clip.id || "(missing id)"} freezeAfterEnd must be boolean.`);
        }
        if (props.showBlackAfterEnd !== undefined && typeof props.showBlackAfterEnd !== "boolean") {
          errors.push(`Screen recording clip ${clip.id || "(missing id)"} showBlackAfterEnd must be boolean.`);
        }
        validateOptionalCropRegion(props.crop, `Screen recording clip ${clip.id || "(missing id)"} crop`, errors);
        validateOptionalTrimRegions(props.trimRegions, `Screen recording clip ${clip.id || "(missing id)"} trimRegions`, errors);
        const companionAudioAssetId = typeof props.companionAudioAssetId === "string" ? props.companionAudioAssetId : "";
        if (companionAudioAssetId) {
          const companionAudioAsset = assetsById.get(companionAudioAssetId);
          if (!companionAudioAsset) {
            errors.push(`Screen recording clip ${clip.id || "(missing id)"} companionAudioAssetId references missing asset ${companionAudioAssetId}.`);
          } else if (companionAudioAsset.type !== "audio") {
            errors.push(`Screen recording clip ${clip.id || "(missing id)"} companionAudioAssetId must reference an audio asset.`);
          }
        }
      }
    }
    if (clip.type === "audio") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      const sourceRegion = isRecord(props?.sourceRegion) ? props.sourceRegion : undefined;
      if (!props) {
        errors.push(`Audio clip ${clip.id || "(missing id)"} props are required.`);
      }
      if (!sourceRegion) {
        errors.push(`Audio clip ${clip.id || "(missing id)"} sourceRegion is required.`);
      } else {
        validateAudioSourceRegion(sourceRegion, `Audio clip ${clip.id || "(missing id)"} sourceRegion`, errors);
      }
    }
    if (clip.type === "cursor") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      if (!props) {
        errors.push(`Cursor clip ${clip.id || "(missing id)"} props are required.`);
      } else {
        validateCursorClipProps(props, `Cursor clip ${clip.id || "(missing id)"}`, errors);
      }
    }
    if (clip.type === "annotation") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      const sourceRegion = isRecord(props?.sourceRegion) ? props.sourceRegion : undefined;
      if (!props) {
        errors.push(`Annotation clip ${clip.id || "(missing id)"} props are required.`);
      }
      if (!sourceRegion) {
        errors.push(`Annotation clip ${clip.id || "(missing id)"} sourceRegion is required.`);
      } else {
        validateAnnotationSourceRegion(sourceRegion, `Annotation clip ${clip.id || "(missing id)"} sourceRegion`, errors);
      }
    }
    if (clip.type === "camera") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      const mode = props?.mode;
      if (!isOneOf(mode, ["zoom", "pan", "focus", "three-d"])) {
        errors.push(`Camera clip ${clip.id || "(missing id)"} mode is invalid or missing.`);
      }
      if (props?.easing !== undefined && !isOneOf(props.easing, ["linear", "smooth", "spring", "catmull-rom"])) {
        errors.push(`Camera clip ${clip.id || "(missing id)"} easing is invalid.`);
      }
      if (mode === "zoom") {
        if (!isZoomDepth(props?.depth)) {
          errors.push(`Camera clip ${clip.id || "(missing id)"} zoom depth is invalid or missing.`);
        }
        validateFocus(props?.focus, `Camera clip ${clip.id || "(missing id)"} zoom focus`, errors);
      }
      if (mode === "pan" || mode === "focus") {
        validateFocus(props?.focus, `Camera clip ${clip.id || "(missing id)"} ${mode} focus`, errors);
      }
      if (mode === "three-d") {
        const threeD = isRecord(props?.threeD) ? props.threeD : undefined;
        if (!threeD) {
          errors.push(`Camera clip ${clip.id || "(missing id)"} threeD settings are required.`);
        } else {
          const threeDKeys = ["rotateX", "rotateY", "rotateZ", "translateZ", "perspective"] as const;
          threeDKeys.forEach((key) => {
            if (!isFiniteNumber(threeD[key])) {
              errors.push(`Camera clip ${clip.id || "(missing id)"} threeD.${key} must be finite.`);
            }
          });
          if (isFiniteNumber(threeD.perspective) && threeD.perspective <= 0) {
            errors.push(`Camera clip ${clip.id || "(missing id)"} threeD.perspective must be positive.`);
          }
          if (threeD.depthOfField !== undefined && !isFiniteNumber(threeD.depthOfField)) {
            errors.push(`Camera clip ${clip.id || "(missing id)"} threeD.depthOfField must be finite.`);
          }
        }
      }
    }
    if (clip.type === "presenter") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      const sourceKind = props?.sourceKind;
      const layout = props?.layout;
      const transform = isRecord(props?.transform) ? props.transform : undefined;
      if (!isOneOf(sourceKind, ["camera", "digital-human", "video-file", "generated-avatar"])) {
        errors.push(`Presenter clip ${clip.id || "(missing id)"} sourceKind is invalid or missing.`);
      }
      if (!isOneOf(layout, ["picture-in-picture", "corner", "split-screen", "full-frame", "cutaway"])) {
        errors.push(`Presenter clip ${clip.id || "(missing id)"} layout is invalid or missing.`);
      }
      if (!transform) {
        errors.push(`Presenter clip ${clip.id || "(missing id)"} transform is required.`);
      } else {
        const transformKeys = ["x", "y", "width", "height", "opacity"] as const;
        transformKeys.forEach((key) => {
          if (!isFiniteNumber(transform[key])) {
            errors.push(`Presenter clip ${clip.id || "(missing id)"} transform.${key} must be finite.`);
          }
        });
        if (isFiniteNumber(transform.width) && transform.width <= 0) {
          errors.push(`Presenter clip ${clip.id || "(missing id)"} transform.width must be positive.`);
        }
        if (isFiniteNumber(transform.height) && transform.height <= 0) {
          errors.push(`Presenter clip ${clip.id || "(missing id)"} transform.height must be positive.`);
        }
      }
      if (sourceKind === "digital-human" && asset && asset.type !== "digital-human") {
        errors.push(`Presenter clip ${clip.id || "(missing id)"} sourceKind digital-human must reference a digital-human asset.`);
      }
      const voiceSync = isRecord(props?.voiceSync) ? props.voiceSync : undefined;
      const audioAssetId = typeof voiceSync?.audioAssetId === "string" ? voiceSync.audioAssetId : "";
      if (audioAssetId) {
        const audioAsset = assetsById.get(audioAssetId);
        if (!audioAsset) {
          errors.push(`Presenter clip ${clip.id || "(missing id)"} voiceSync references missing audio asset ${audioAssetId}.`);
        } else if (audioAsset.type !== "audio") {
          errors.push(`Presenter clip ${clip.id || "(missing id)"} voiceSync must reference an audio asset.`);
        }
      }
    }
    if (clip.type === "ui-element-motion") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      const uiSourceId = typeof props?.uiSourceId === "string" ? props.uiSourceId : "";
      const elementId = typeof props?.elementId === "string" ? props.elementId : "";
      if (!props) {
        errors.push(`Clip ${clip.id || "(missing id)"} props are required.`);
      }
      if (!uiSourceId) {
        errors.push(`Clip ${clip.id || "(missing id)"} uiSourceId is required.`);
      } else if (!uiSourceIds.has(uiSourceId)) {
        errors.push(`Clip ${clip.id || "(missing id)"} references missing UI source ${uiSourceId}.`);
      }
      if (!elementId) {
        errors.push(`Clip ${clip.id || "(missing id)"} elementId is required.`);
      } else if (uiSourceId && uiElementIdsBySource.has(uiSourceId) && !uiElementIdsBySource.get(uiSourceId)?.has(elementId)) {
        errors.push(`Clip ${clip.id || "(missing id)"} references missing UI element ${elementId}.`);
      }
      if (props) {
        if (!isOneOf(props.action, ["highlight", "move", "scale", "fade", "morph", "click", "scroll", "custom"])) {
          errors.push(`Clip ${clip.id || "(missing id)"} UI motion action is invalid or missing.`);
        }
        if (props.easing !== undefined && !isOneOf(props.easing, ["linear", "smooth", "spring", "catmull-rom"])) {
          errors.push(`Clip ${clip.id || "(missing id)"} UI motion easing is invalid.`);
        }
        validateOptionalMotionBounds(props.from, `Clip ${clip.id || "(missing id)"} UI motion from`, errors);
        validateOptionalMotionBounds(props.to, `Clip ${clip.id || "(missing id)"} UI motion to`, errors);
        const generatedFrom = isRecord(props.generatedFrom) ? props.generatedFrom : undefined;
        if (generatedFrom) {
          if (generatedFrom.recordingEventId !== undefined && typeof generatedFrom.recordingEventId !== "string") {
            errors.push(`Clip ${clip.id || "(missing id)"} generatedFrom.recordingEventId must be a string.`);
          }
          if (generatedFrom.aiPlanStepId !== undefined && typeof generatedFrom.aiPlanStepId !== "string") {
            errors.push(`Clip ${clip.id || "(missing id)"} generatedFrom.aiPlanStepId must be a string.`);
          }
        }
      }
    }
    if (clip.type === "lottie") {
      const props = isRecord(clip.props) ? clip.props : undefined;
      if (!props) {
        errors.push(`Lottie clip ${clip.id || "(missing id)"} props are required.`);
      } else {
        const playback = isRecord(props.playback) ? props.playback : undefined;
        if (!playback) {
          errors.push(`Lottie clip ${clip.id || "(missing id)"} playback is required.`);
        } else {
          if (typeof playback.loop !== "boolean") {
            errors.push(`Lottie clip ${clip.id || "(missing id)"} playback.loop must be boolean.`);
          }
          if (!isFiniteNumber(playback.speed) || playback.speed <= 0) {
            errors.push(`Lottie clip ${clip.id || "(missing id)"} playback.speed must be positive.`);
          }
          if (playback.direction !== 1 && playback.direction !== -1) {
            errors.push(`Lottie clip ${clip.id || "(missing id)"} playback.direction must be 1 or -1.`);
          }
        }

        const transform = isRecord(props.transform) ? props.transform : undefined;
        if (!transform) {
          errors.push(`Lottie clip ${clip.id || "(missing id)"} transform is required.`);
        } else {
          validateRequiredTransform(transform, `Lottie clip ${clip.id || "(missing id)"} transform`, errors);
        }

        const colorOverrides = isRecord(props.colorOverrides) ? props.colorOverrides : undefined;
        if (colorOverrides) {
          Object.entries(colorOverrides).forEach(([key, value]) => {
            if (typeof value !== "string") {
              errors.push(`Lottie clip ${clip.id || "(missing id)"} colorOverrides.${key} must be a string.`);
            }
          });
        }
      }
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
    if (trackIds.has(clip.trackId)) {
      const clipsOnTrack = clipsByTrackId.get(clip.trackId) ?? [];
      clipsOnTrack.push(clip);
      clipsByTrackId.set(clip.trackId, clipsOnTrack);
    }
  });

  clipsByTrackId.forEach((clipsOnTrack, trackId) => {
    const sortedClips = clipsOnTrack
      .filter((clip) => Number.isFinite(clip.startMs) && Number.isFinite(clip.endMs))
      .sort((first, second) => first.startMs - second.startMs || first.endMs - second.endMs);
    for (let index = 1; index < sortedClips.length; index += 1) {
      const previousClip = sortedClips[index - 1];
      const currentClip = sortedClips[index];
      if (currentClip.startMs < previousClip.endMs) {
        errors.push(`Track ${trackId} has overlapping clips ${previousClip.id} and ${currentClip.id}.`);
      }
    }
  });

  const sceneIds = new Set<string>();
  const sceneRanges: Array<{ id: string; startMs: number; endMs: number }> = [];
  scenes.forEach((scene: ProjectScene, index) => {
    if (!isRecord(scene)) {
      errors.push(`Scene at index ${index} must be an object.`);
      return;
    }
    if (!scene.id) errors.push("Scene id is required.");
    if (scene.id) {
      if (sceneIds.has(scene.id)) errors.push(`Duplicate scene id: ${scene.id}.`);
      sceneIds.add(scene.id);
    }
    if (typeof scene.name !== "string" || !scene.name.trim()) {
      errors.push(`Scene ${scene.id || "(missing id)"} name is required.`);
    }
    if (!isOneOf(scene.purpose, ["hook", "problem", "demo", "feature", "result", "cta", "custom"])) {
      errors.push(`Scene ${scene.id || "(missing id)"} purpose is invalid or missing.`);
    }
    if (!Number.isFinite(scene.startMs) || !Number.isFinite(scene.endMs)) {
      errors.push(`Scene ${scene.id || "(missing id)"} startMs/endMs must be finite.`);
    } else if (scene.startMs < 0 || scene.endMs < 0) {
      errors.push(`Scene ${scene.id || "(missing id)"} startMs/endMs must be non-negative.`);
    } else if (scene.endMs < scene.startMs) {
      errors.push(`Scene ${scene.id || "(missing id)"} endMs is before startMs.`);
    } else {
      if (scene.endMs === scene.startMs) {
        warnings.push(`Scene ${scene.id || "(missing id)"} has zero duration.`);
      }
      if (typeof project.durationMs === "number" && scene.endMs > project.durationMs) {
        warnings.push(`Scene ${scene.id || "(missing id)"} extends beyond project duration.`);
      }
      sceneRanges.push({ id: scene.id || `(missing id ${index})`, startMs: scene.startMs, endMs: scene.endMs });
    }
    if (!Array.isArray(scene.clipIds)) {
      errors.push(`Scene ${scene.id || "(missing id)"} clipIds must be an array.`);
    } else {
      const sceneClipIds = new Set<string>();
      scene.clipIds.forEach((clipId) => {
        if (sceneClipIds.has(clipId)) {
          errors.push(`Scene ${scene.id || "(missing id)"} has duplicate clip id ${clipId}.`);
        }
        sceneClipIds.add(clipId);
        if (!clipIds.has(clipId)) {
          errors.push(`Scene ${scene.id || "(missing id)"} references missing clip ${clipId}.`);
          return;
        }
        const clip = clipsById.get(clipId);
        if (
          clip &&
          Number.isFinite(scene.startMs) &&
          Number.isFinite(scene.endMs) &&
          Number.isFinite(clip.startMs) &&
          Number.isFinite(clip.endMs) &&
          !rangesOverlap(scene.startMs, scene.endMs, clip.startMs, clip.endMs)
        ) {
          errors.push(`Scene ${scene.id || "(missing id)"} references clip ${clipId} outside its time range.`);
        }
      });
    }
    if (scene.aiSummary !== undefined && typeof scene.aiSummary !== "string") {
      errors.push(`Scene ${scene.id || "(missing id)"} aiSummary must be a string.`);
    }
  });
  const sortedSceneRanges = sceneRanges.sort((first, second) => first.startMs - second.startMs || first.endMs - second.endMs);
  for (let index = 1; index < sortedSceneRanges.length; index += 1) {
    const previousScene = sortedSceneRanges[index - 1];
    const currentScene = sortedSceneRanges[index];
    if (currentScene.startMs < previousScene.endMs) {
      errors.push(`Scenes ${previousScene.id} and ${currentScene.id} overlap.`);
    }
  }

  const aiEditPlanIds = new Set<string>();
  aiEditPlans.forEach((plan: AIEditPlan, index) => {
    if (!isRecord(plan)) {
      errors.push(`AI edit plan at index ${index} must be an object.`);
      return;
    }
    if (!plan.id) errors.push("AI edit plan id is required.");
    if (aiEditPlanIds.has(plan.id)) errors.push(`Duplicate AI edit plan id: ${plan.id}.`);
    aiEditPlanIds.add(plan.id);
    if (typeof plan.createdAt !== "string" || !plan.createdAt) {
      errors.push(`AI edit plan ${plan.id || "(missing id)"} createdAt is required.`);
    }
    if (typeof plan.goal !== "string" || !plan.goal.trim()) {
      errors.push(`AI edit plan ${plan.id || "(missing id)"} goal is required.`);
    }
    if (!isOneOf(plan.status, ["draft", "reviewed", "applied", "rejected"])) {
      errors.push(`AI edit plan ${plan.id || "(missing id)"} status is invalid or missing.`);
    }
    if (!Array.isArray(plan.steps)) {
      errors.push(`AI edit plan ${plan.id || "(missing id)"} steps must be an array.`);
      return;
    }
    const stepIds = new Set<string>();
    const stepStatuses: string[] = [];
    plan.steps.forEach((step, stepIndex) => {
      if (!isRecord(step)) {
        errors.push(`AI edit plan ${plan.id || "(missing id)"} step at index ${stepIndex} must be an object.`);
        return;
      }
      if (!step.id) errors.push(`AI edit plan ${plan.id || "(missing id)"} step id is required.`);
      if (stepIds.has(step.id)) errors.push(`AI edit plan ${plan.id || "(missing id)"} has duplicate step id: ${step.id}.`);
      stepIds.add(step.id);
      if (!isOneOf(step.type, ["cut", "trim", "camera", "caption", "annotation", "lottie", "ui-motion", "audio", "layout", "custom"])) {
        errors.push(`AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} type is invalid or missing.`);
      }
      if (!isOneOf(step.status, ["draft", "accepted", "rejected", "applied"])) {
        errors.push(`AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} status is invalid or missing.`);
      } else {
        stepStatuses.push(step.status);
      }

      const target = isRecord(step.target) ? step.target : undefined;
      const timeRangeMs = isRecord(target?.timeRangeMs) ? target.timeRangeMs : undefined;
      if (timeRangeMs) {
        validateTimeRange(
          timeRangeMs.startMs,
          timeRangeMs.endMs,
          `AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} target timeRangeMs`,
          errors,
        );
      }
      const clipIdsTarget = Array.isArray(target?.clipIds) ? target.clipIds : [];
      clipIdsTarget.forEach((clipId) => {
        if (typeof clipId === "string" && !clipIds.has(clipId)) {
          errors.push(`AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} references missing clip ${clipId}.`);
        }
      });
      const trackIdsTarget = Array.isArray(target?.trackIds) ? target.trackIds : [];
      trackIdsTarget.forEach((trackId) => {
        if (typeof trackId === "string" && !trackIds.has(trackId)) {
          errors.push(`AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} references missing track ${trackId}.`);
        }
      });
      const sceneIdsTarget = Array.isArray(target?.sceneIds) ? target.sceneIds : [];
      sceneIdsTarget.forEach((sceneId) => {
        if (typeof sceneId === "string" && !scenes.some((scene) => scene.id === sceneId)) {
          errors.push(`AI edit plan ${plan.id || "(missing id)"} step ${step.id || "(missing id)"} references missing scene ${sceneId}.`);
        }
      });
    });
    validateAIEditPlanLifecycle(plan.id || "(missing id)", plan.status, stepStatuses, errors);
  });
  if (project.activeAIEditPlanId !== undefined && typeof project.activeAIEditPlanId !== "string") {
    errors.push("Project activeAIEditPlanId must be a string.");
  } else if (project.activeAIEditPlanId && !aiEditPlanIds.has(project.activeAIEditPlanId)) {
    errors.push(`Active AI edit plan ${project.activeAIEditPlanId} does not exist.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateEditingDocument(value: unknown, errors: string[]) {
  if (value === undefined) return;
  if (!isRecord(value) || !Array.isArray(value.clips) || !Array.isArray(value.speedSections)) {
    errors.push('Project editingDocument must contain clips and speedSections arrays.');
    return;
  }
  const ids = new Set<string>();
  value.clips.forEach((clip, index) => {
    if (!isRecord(clip) || typeof clip.id !== 'string' || !isFiniteNumber(clip.sourceStartMs) || !isFiniteNumber(clip.sourceEndMs) || clip.sourceEndMs <= clip.sourceStartMs) {
      errors.push(`Editing clip at index ${index} is invalid.`);
    } else if (ids.has(clip.id)) errors.push(`Duplicate editing clip id: ${clip.id}.`);
    else ids.add(clip.id);
  });
  value.speedSections.forEach((section, index) => {
    if (!isRecord(section) || typeof section.id !== 'string' || !isFiniteNumber(section.projectStartMs) || !isFiniteNumber(section.projectEndMs) || section.projectEndMs <= section.projectStartMs || !isFiniteNumber(section.rate) || section.rate <= 0 || !isOneOf(section.origin, ['manual', 'typing'])) {
      errors.push(`Editing speed section at index ${index} is invalid.`);
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function isZoomDepth(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 6;
}

function validateProjectCanvasSettings(value: unknown, errors: string[]) {
  const canvas = isRecord(value) ? value : undefined;
  if (!canvas) {
    errors.push("Project canvas settings must be an object.");
    return;
  }

  if (!isOneOf(canvas.aspectRatio, ["16:9", "9:16", "1:1", "4:3", "4:5"])) {
    errors.push("Project canvas aspectRatio is invalid or missing.");
  }

  const background = isRecord(canvas.background) ? canvas.background : undefined;
  if (!background) {
    errors.push("Project canvas background is required.");
  } else {
    if (typeof background.wallpaper !== "string" || !background.wallpaper.trim()) {
      errors.push("Project canvas background.wallpaper is required.");
    }
    if (typeof background.showBlur !== "boolean") {
      errors.push("Project canvas background.showBlur must be boolean.");
    }
  }

  if (!isFiniteNumber(canvas.padding) || canvas.padding < 0) {
    errors.push("Project canvas padding must be a finite non-negative number.");
  }
  if (!isFiniteNumber(canvas.borderRadius) || canvas.borderRadius < 0) {
    errors.push("Project canvas borderRadius must be a finite non-negative number.");
  }

  const shadow = isRecord(canvas.shadow) ? canvas.shadow : undefined;
  if (!shadow) {
    errors.push("Project canvas shadow settings are required.");
  } else if (!isFiniteNumber(shadow.intensity) || shadow.intensity < 0) {
    errors.push("Project canvas shadow.intensity must be a finite non-negative number.");
  }

  if (canvas.cropRegion === undefined) {
    errors.push("Project canvas cropRegion is required.");
  } else {
    validateOptionalCropRegion(canvas.cropRegion, "Project canvas cropRegion", errors);
  }
}

function validateProjectExportSettings(value: unknown, errors: string[]) {
  const exportSettings = isRecord(value) ? value : undefined;
  if (!exportSettings) {
    errors.push("Project exportSettings are required.");
    return;
  }
  if (!isOneOf(exportSettings.quality, ["medium", "good", "source"])) {
    errors.push("Project exportSettings.quality is invalid or missing.");
  }
}

function validateLegacyRuntimeSettings(value: unknown, errors: string[]) {
  if (value === undefined) return;
  const legacyState = isRecord(value) ? value : undefined;
  if (!legacyState) {
    errors.push("Project legacyState must be an object.");
    return;
  }
  if (legacyState.motionBlurEnabled !== undefined && typeof legacyState.motionBlurEnabled !== "boolean") {
    errors.push("Project legacyState.motionBlurEnabled must be boolean.");
  }
}

function validateOptionalString(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push(`${label} must be a string.`);
  }
}

function validateOptionalUIElementBounds(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  const bounds = isRecord(value) ? value : undefined;
  if (!bounds) {
    errors.push(`${label} must be an object.`);
    return;
  }
  ["x", "y", "width", "height"].forEach((key) => {
    if (!isFiniteNumber(bounds[key])) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
  if (isFiniteNumber(bounds.width) && bounds.width <= 0) {
    errors.push(`${label}.width must be positive.`);
  }
  if (isFiniteNumber(bounds.height) && bounds.height <= 0) {
    errors.push(`${label}.height must be positive.`);
  }
}

function validateFocus(value: unknown, label: string, errors: string[]) {
  const focus = isRecord(value) ? value : undefined;
  if (!focus) {
    errors.push(`${label} is required.`);
    return;
  }
  ["cx", "cy"].forEach((key) => {
    const coordinate = focus[key];
    if (!isFiniteNumber(coordinate) || coordinate < 0 || coordinate > 1) {
      errors.push(`${label}.${key} must be a finite normalized value between 0 and 1.`);
    }
  });
}

function validateTimeRange(startMs: unknown, endMs: unknown, label: string, errors: string[]) {
  if (!isFiniteNumber(startMs) || !isFiniteNumber(endMs)) {
    errors.push(`${label} startMs/endMs must be finite.`);
    return;
  }
  if (startMs < 0 || endMs < 0) {
    errors.push(`${label} startMs/endMs must be non-negative.`);
  } else if (endMs < startMs) {
    errors.push(`${label} endMs is before startMs.`);
  }
}

function validateOptionalClipSourceRange(clip: ProjectClip, label: string, errors: string[]) {
  const hasSourceStart = clip.sourceStartMs !== undefined;
  const hasSourceEnd = clip.sourceEndMs !== undefined;
  if (!hasSourceStart && !hasSourceEnd) return;

  if (hasSourceStart !== hasSourceEnd) {
    errors.push(`${label} sourceStartMs/sourceEndMs must be provided together.`);
    return;
  }

  validateTimeRange(clip.sourceStartMs, clip.sourceEndMs, `${label} source range`, errors);
}

function validateOptionalClipLegacy(clip: ProjectClip, label: string, errors: string[]) {
  if (clip.legacy === undefined) return;

  const legacy = isRecord(clip.legacy) ? clip.legacy : undefined;
  if (!legacy) {
    errors.push(`${label} legacy must be an object.`);
    return;
  }

  if (legacy.source !== "VideoEditor") {
    errors.push(`${label} legacy.source is invalid or missing.`);
  }
  if (legacy.regionId !== undefined && typeof legacy.regionId !== "string") {
    errors.push(`${label} legacy.regionId must be a string.`);
  }
  if (legacy.regionType !== undefined && !isOneOf(legacy.regionType, VALID_LEGACY_REGION_TYPES)) {
    errors.push(`${label} legacy.regionType is invalid.`);
  }
}

function validateOptionalCropRegion(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  const crop = isRecord(value) ? value : undefined;
  if (!crop) {
    errors.push(`${label} must be an object.`);
    return;
  }

  ["x", "y", "width", "height"].forEach((key) => {
    const coordinate = crop[key];
    if (!isFiniteNumber(coordinate)) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
  if (isFiniteNumber(crop.x) && (crop.x < 0 || crop.x > 1)) {
    errors.push(`${label}.x must be a normalized value between 0 and 1.`);
  }
  if (isFiniteNumber(crop.y) && (crop.y < 0 || crop.y > 1)) {
    errors.push(`${label}.y must be a normalized value between 0 and 1.`);
  }
  if (isFiniteNumber(crop.width) && (crop.width <= 0 || crop.width > 1)) {
    errors.push(`${label}.width must be positive and no larger than 1.`);
  }
  if (isFiniteNumber(crop.height) && (crop.height <= 0 || crop.height > 1)) {
    errors.push(`${label}.height must be positive and no larger than 1.`);
  }
  if (isFiniteNumber(crop.x) && isFiniteNumber(crop.width) && crop.x + crop.width > 1) {
    errors.push(`${label}.x + width must be no larger than 1.`);
  }
  if (isFiniteNumber(crop.y) && isFiniteNumber(crop.height) && crop.y + crop.height > 1) {
    errors.push(`${label}.y + height must be no larger than 1.`);
  }
}

function validateOptionalTrimRegions(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  value.forEach((trimRegion, index) => {
    const region = isRecord(trimRegion) ? trimRegion : undefined;
    if (!region) {
      errors.push(`${label}[${index}] must be an object.`);
      return;
    }
    if (typeof region.id !== "string" || !region.id.trim()) {
      errors.push(`${label}[${index}].id is required.`);
    }
    validateTimeRange(region.startMs, region.endMs, `${label}[${index}]`, errors);
  });
}

function validateAudioSourceRegion(region: Record<string, unknown>, label: string, errors: string[]) {
  if (typeof region.id !== "string" || !region.id.trim()) {
    errors.push(`${label}.id is required.`);
  }
  validateTimeRange(region.startMs, region.endMs, label, errors);

  const sourceUrl = typeof region.sourceUrl === "string" ? region.sourceUrl.trim() : "";
  const path = typeof region.path === "string" ? region.path.trim() : "";
  if (!sourceUrl && !path) {
    errors.push(`${label} must include sourceUrl or path.`);
  }

  if (region.sourceStartMs !== undefined || region.sourceEndMs !== undefined) {
    validateTimeRange(region.sourceStartMs, region.sourceEndMs, `${label} source range`, errors);
  }
  if (region.totalDurationMs !== undefined && (!isFiniteNumber(region.totalDurationMs) || region.totalDurationMs < 0)) {
    errors.push(`${label}.totalDurationMs must be a finite non-negative number.`);
  }
  if (!isFiniteNumber(region.volume) || region.volume < 0) {
    errors.push(`${label}.volume must be a finite non-negative number.`);
  }
  if (region.isMuted !== undefined && typeof region.isMuted !== "boolean") {
    errors.push(`${label}.isMuted must be boolean.`);
  }
  if (region.isOriginal !== undefined && typeof region.isOriginal !== "boolean") {
    errors.push(`${label}.isOriginal must be boolean.`);
  }
  if (region.isDetached !== undefined && typeof region.isDetached !== "boolean") {
    errors.push(`${label}.isDetached must be boolean.`);
  }
  if (region.trackIndex !== undefined && (!isFiniteNumber(region.trackIndex) || region.trackIndex < 0)) {
    errors.push(`${label}.trackIndex must be a finite non-negative number.`);
  }
  if (region.audioPeaks !== undefined) {
    if (!Array.isArray(region.audioPeaks)) {
      errors.push(`${label}.audioPeaks must be an array.`);
    } else if (region.audioPeaks.some((peak) => !isFiniteNumber(peak))) {
      errors.push(`${label}.audioPeaks must contain only finite numbers.`);
    }
  }
  if (region.audioPeaksDurationMs !== undefined && (!isFiniteNumber(region.audioPeaksDurationMs) || region.audioPeaksDurationMs < 0)) {
    errors.push(`${label}.audioPeaksDurationMs must be a finite non-negative number.`);
  }
  if (region.volumeKeyframes !== undefined) {
    if (!Array.isArray(region.volumeKeyframes)) {
      errors.push(`${label}.volumeKeyframes must be an array.`);
    } else {
      region.volumeKeyframes.forEach((keyframe, index) => {
        const volumeKeyframe = isRecord(keyframe) ? keyframe : undefined;
        if (!volumeKeyframe) {
          errors.push(`${label}.volumeKeyframes[${index}] must be an object.`);
          return;
        }
        if (typeof volumeKeyframe.id !== "string" || !volumeKeyframe.id.trim()) {
          errors.push(`${label}.volumeKeyframes[${index}].id is required.`);
        }
        if (!isFiniteNumber(volumeKeyframe.timeRatio) || volumeKeyframe.timeRatio < 0 || volumeKeyframe.timeRatio > 1) {
          errors.push(`${label}.volumeKeyframes[${index}].timeRatio must be between 0 and 1.`);
        }
        if (!isFiniteNumber(volumeKeyframe.volume) || volumeKeyframe.volume < 0) {
          errors.push(`${label}.volumeKeyframes[${index}].volume must be a finite non-negative number.`);
        }
      });
    }
  }
}

function validateCursorClipProps(props: Record<string, unknown>, label: string, errors: string[]) {
  if (!Array.isArray(props.points)) {
    errors.push(`${label} points must be an array.`);
  } else {
    props.points.forEach((point, index) => {
      validateCursorPoint(point, `${label} points[${index}]`, errors);
    });
  }
  if (!isFiniteNumber(props.size) || props.size <= 0) {
    errors.push(`${label} size must be positive.`);
  }
  if (typeof props.smoothing !== "boolean") {
    errors.push(`${label} smoothing must be boolean.`);
  }
  if (typeof props.vectorCursor !== "boolean") {
    errors.push(`${label} vectorCursor must be boolean.`);
  }
  if (props.style !== undefined && typeof props.style !== "string") {
    errors.push(`${label} style must be a string when provided.`);
  }
  if (props.customImage !== undefined && typeof props.customImage !== "string") {
    errors.push(`${label} customImage must be a string when provided.`);
  }
  if (props.customImages !== undefined) {
    if (!isRecord(props.customImages)) {
      errors.push(`${label} customImages must be an object when provided.`);
    } else {
      Object.entries(props.customImages).forEach(([state, image]) => {
        if (typeof image !== "string") {
          errors.push(`${label} customImages.${state} must be a string.`);
        }
      });
    }
  }
  if (!isFiniteNumber(props.offsetMs)) {
    errors.push(`${label} offsetMs must be finite.`);
  }
}

function validateCursorPoint(value: unknown, label: string, errors: string[]) {
  const point = isRecord(value) ? value : undefined;
  if (!point) {
    errors.push(`${label} must be an object.`);
    return;
  }
  ["timestamp", "x", "y", "cx", "cy"].forEach((key) => {
    if (!isFiniteNumber(point[key])) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
  if (point.absoluteTime !== undefined && !isFiniteNumber(point.absoluteTime)) {
    errors.push(`${label}.absoluteTime must be finite.`);
  }
  if (point.isClick !== undefined && typeof point.isClick !== "boolean") {
    errors.push(`${label}.isClick must be boolean.`);
  }
  if (point.isPointerDown !== undefined && typeof point.isPointerDown !== "boolean") {
    errors.push(`${label}.isPointerDown must be boolean.`);
  }
  if (
    point.type !== undefined
    && !isOneOf(point.type, ["click", "mousedown", "mouseup", "drag", "move", "keydown", "wheel"])
  ) {
    errors.push(`${label}.type is invalid.`);
  }
  if (point.cursorType !== undefined && typeof point.cursorType !== "string") {
    errors.push(`${label}.cursorType must be a string.`);
  }
}

function validateAnnotationSourceRegion(region: Record<string, unknown>, label: string, errors: string[]) {
  if (typeof region.id !== "string" || !region.id.trim()) {
    errors.push(`${label}.id is required.`);
  }
  validateTimeRange(region.startMs, region.endMs, label, errors);
  if (!isOneOf(region.type, ["text", "image", "figure"])) {
    errors.push(`${label}.type is invalid or missing.`);
  }
  if (region.content !== undefined && typeof region.content !== "string") {
    errors.push(`${label}.content must be a string.`);
  }
  if (region.textContent !== undefined && typeof region.textContent !== "string") {
    errors.push(`${label}.textContent must be a string.`);
  }
  if (region.imageContent !== undefined && typeof region.imageContent !== "string") {
    errors.push(`${label}.imageContent must be a string.`);
  }
  validateFinitePoint(region.position, `${label}.position`, ["x", "y"], errors);
  validatePositiveDimensions(region.size, `${label}.size`, errors);
  validateAnnotationTextStyle(region.style, `${label}.style`, errors);
  if (!isFiniteNumber(region.zIndex)) {
    errors.push(`${label}.zIndex must be finite.`);
  }
  if (region.figureData !== undefined) {
    validateFigureData(region.figureData, `${label}.figureData`, errors);
  }
}

function validateFinitePoint(
  value: unknown,
  label: string,
  keys: readonly string[],
  errors: string[],
) {
  const point = isRecord(value) ? value : undefined;
  if (!point) {
    errors.push(`${label} must be an object.`);
    return;
  }
  keys.forEach((key) => {
    if (!isFiniteNumber(point[key])) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
}

function validatePositiveDimensions(value: unknown, label: string, errors: string[]) {
  const size = isRecord(value) ? value : undefined;
  if (!size) {
    errors.push(`${label} must be an object.`);
    return;
  }
  ["width", "height"].forEach((key) => {
    if (!isFiniteNumber(size[key])) {
      errors.push(`${label}.${key} must be finite.`);
    } else if (size[key] <= 0) {
      errors.push(`${label}.${key} must be positive.`);
    }
  });
}

function validateAnnotationTextStyle(value: unknown, label: string, errors: string[]) {
  const style = isRecord(value) ? value : undefined;
  if (!style) {
    errors.push(`${label} must be an object.`);
    return;
  }
  ["color", "backgroundColor", "fontFamily"].forEach((key) => {
    if (typeof style[key] !== "string") {
      errors.push(`${label}.${key} must be a string.`);
    }
  });
  if (!isFiniteNumber(style.fontSize) || style.fontSize <= 0) {
    errors.push(`${label}.fontSize must be positive.`);
  }
  if (!isValidFontWeight(style.fontWeight)) {
    errors.push(`${label}.fontWeight is invalid or missing.`);
  }
  if (!isOneOf(style.fontStyle, ["normal", "italic"])) {
    errors.push(`${label}.fontStyle is invalid or missing.`);
  }
  if (!isOneOf(style.textDecoration, ["none", "underline"])) {
    errors.push(`${label}.textDecoration is invalid or missing.`);
  }
  if (!isOneOf(style.textAlign, ["left", "center", "right"])) {
    errors.push(`${label}.textAlign is invalid or missing.`);
  }
}

function isValidFontWeight(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value !== "string") return false;
  return /^(normal|bold|lighter|bolder|[1-9]00)$/.test(value);
}

function validateFigureData(value: unknown, label: string, errors: string[]) {
  const figureData = isRecord(value) ? value : undefined;
  if (!figureData) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!isOneOf(figureData.arrowDirection, ["up", "down", "left", "right", "up-right", "up-left", "down-right", "down-left"])) {
    errors.push(`${label}.arrowDirection is invalid or missing.`);
  }
  if (typeof figureData.color !== "string") {
    errors.push(`${label}.color must be a string.`);
  }
  if (!isFiniteNumber(figureData.strokeWidth) || figureData.strokeWidth <= 0) {
    errors.push(`${label}.strokeWidth must be positive.`);
  }
}

function validateRequiredTransform(value: Record<string, unknown>, label: string, errors: string[]) {
  const transformKeys = ["x", "y", "width", "height", "rotation", "opacity"] as const;
  transformKeys.forEach((key) => {
    if (!isFiniteNumber(value[key])) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
  validatePositiveSize(value.width, `${label}.width`, errors);
  validatePositiveSize(value.height, `${label}.height`, errors);
  validateOpacity(value.opacity, `${label}.opacity`, errors);
}

function validateOptionalMotionBounds(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  const bounds = isRecord(value) ? value : undefined;
  if (!bounds) {
    errors.push(`${label} must be an object.`);
    return;
  }

  ["x", "y", "width", "height", "opacity", "rotation"].forEach((key) => {
    if (bounds[key] !== undefined && !isFiniteNumber(bounds[key])) {
      errors.push(`${label}.${key} must be finite.`);
    }
  });
  if (bounds.width !== undefined) validatePositiveSize(bounds.width, `${label}.width`, errors);
  if (bounds.height !== undefined) validatePositiveSize(bounds.height, `${label}.height`, errors);
  if (bounds.opacity !== undefined) validateOpacity(bounds.opacity, `${label}.opacity`, errors);
}

function validatePositiveSize(value: unknown, label: string, errors: string[]) {
  if (isFiniteNumber(value) && value <= 0) {
    errors.push(`${label} must be positive.`);
  }
}

function validateOpacity(value: unknown, label: string, errors: string[]) {
  if (isFiniteNumber(value) && (value < 0 || value > 1)) {
    errors.push(`${label} must be between 0 and 1.`);
  }
}

function rangesOverlap(firstStartMs: number, firstEndMs: number, secondStartMs: number, secondEndMs: number) {
  return firstStartMs < secondEndMs && secondStartMs < firstEndMs;
}

function validateAIEditPlanLifecycle(
  planId: string,
  planStatus: AIEditPlan["status"] | undefined,
  stepStatuses: string[],
  errors: string[],
) {
  if (!isOneOf(planStatus, ["draft", "reviewed", "applied", "rejected"])) return;
  if (stepStatuses.length === 0) return;

  const invalidForPlan = (allowed: string[]) => (
    stepStatuses.filter((status) => !allowed.includes(status))
  );

  if (planStatus === "draft") {
    const invalidStatuses = invalidForPlan(["draft"]);
    if (invalidStatuses.length > 0) {
      errors.push(`AI edit plan ${planId} draft plan can only contain draft steps.`);
    }
  }

  if (planStatus === "reviewed") {
    const invalidStatuses = invalidForPlan(["accepted", "rejected"]);
    if (invalidStatuses.length > 0) {
      errors.push(`AI edit plan ${planId} reviewed plan can only contain accepted or rejected steps.`);
    }
  }

  if (planStatus === "applied") {
    const invalidStatuses = invalidForPlan(["applied", "rejected"]);
    if (invalidStatuses.length > 0) {
      errors.push(`AI edit plan ${planId} applied plan can only contain applied or rejected steps.`);
    }
    if (!stepStatuses.includes("applied")) {
      errors.push(`AI edit plan ${planId} applied plan must contain at least one applied step.`);
    }
  }

  if (planStatus === "rejected") {
    const invalidStatuses = invalidForPlan(["rejected"]);
    if (invalidStatuses.length > 0) {
      errors.push(`AI edit plan ${planId} rejected plan can only contain rejected steps.`);
    }
  }
}

function isClipCompatibleWithTrack(
  clipType: ProjectClip["type"],
  trackType: ProjectTrack["type"],
) {
  const allowedTrackTypesByClipType: Record<ProjectClip["type"], ProjectTrack["type"][]> = {
    "screen-recording": ["video"],
    video: ["video"],
    audio: ["audio", "voice", "music"],
    camera: ["camera"],
    presenter: ["presenter"],
    text: ["text"],
    annotation: ["annotation"],
    lottie: ["lottie"],
    image: ["image", "video"],
    "ui-element-motion": ["ui-motion"],
    cursor: ["cursor"],
  };

  return allowedTrackTypesByClipType[clipType]?.includes(trackType) ?? false;
}

function isClipCompatibleWithAsset(
  clipType: ProjectClip["type"],
  assetType: ProjectAsset["type"],
) {
  const allowedAssetTypesByClipType: Partial<Record<ProjectClip["type"], ProjectAsset["type"][]>> = {
    "screen-recording": ["screen-recording"],
    video: ["screen-recording", "video"],
    audio: ["audio"],
    presenter: ["digital-human", "video"],
    lottie: ["lottie"],
    image: ["image"],
    "ui-element-motion": ["ui-source"],
    cursor: ["cursor-data"],
  };

  const allowedAssetTypes = allowedAssetTypesByClipType[clipType];
  return allowedAssetTypes ? allowedAssetTypes.includes(assetType) : true;
}
