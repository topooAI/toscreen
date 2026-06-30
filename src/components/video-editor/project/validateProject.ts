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
    if (!asset.id) errors.push("Asset id is required.");
    if (assetIds.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}.`);
    assetIds.add(asset.id);
    assetsById.set(asset.id, asset);
    if (!asset.type) errors.push(`Asset ${asset.id || "(missing id)"} type is required.`);
    if (!asset.sourceUrl) warnings.push(`Asset ${asset.id || "(missing id)"} has no sourceUrl.`);
  });

  const uiSourceIds = new Set<string>();
  const uiElementIdsBySource = new Map<string, Set<string>>();
  uiSources.forEach((uiSource: ProjectUISource, index) => {
    if (!isRecord(uiSource)) {
      errors.push(`UI source at index ${index} must be an object.`);
      return;
    }
    if (!uiSource.id) errors.push("UI source id is required.");
    if (uiSourceIds.has(uiSource.id)) errors.push(`Duplicate UI source id: ${uiSource.id}.`);
    uiSourceIds.add(uiSource.id);
    if (!uiSource.provider) errors.push(`UI source ${uiSource.id || "(missing id)"} provider is required.`);
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
      if (!element.id) errors.push(`UI source ${uiSource.id || "(missing id)"} element id is required.`);
      if (elementIds.has(element.id)) {
        errors.push(`UI source ${uiSource.id || "(missing id)"} has duplicate element id: ${element.id}.`);
      }
      elementIds.add(element.id);
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
    if (!track.id) errors.push("Track id is required.");
    if (trackIds.has(track.id)) errors.push(`Duplicate track id: ${track.id}.`);
    trackIds.add(track.id);
    tracksById.set(track.id, track);
    if (!track.type) errors.push(`Track ${track.id || "(missing id)"} type is required.`);
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
  const clipsByTrackId = new Map<string, ProjectClip[]>();
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
    const track = tracksById.get(clip.trackId);
    if (track && !isClipCompatibleWithTrack(clip.type, track.type)) {
      errors.push(`Clip ${clip.id || "(missing id)"} type ${clip.type} cannot be placed on track ${track.id} type ${track.type}.`);
    }
    if (clip.assetId && !assetIds.has(clip.assetId)) {
      errors.push(`Clip ${clip.id || "(missing id)"} references missing asset ${clip.assetId}.`);
    }
    const asset = clip.assetId ? assetsById.get(clip.assetId) : undefined;
    if (asset && !isClipCompatibleWithAsset(clip.type, asset.type)) {
      errors.push(`Clip ${clip.id || "(missing id)"} type ${clip.type} cannot reference asset ${asset.id} type ${asset.type}.`);
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
  });
  if (project.activeAIEditPlanId && !aiEditPlanIds.has(project.activeAIEditPlanId)) {
    errors.push(`Active AI edit plan ${project.activeAIEditPlanId} does not exist.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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
