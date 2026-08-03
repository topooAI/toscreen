import type { EditingDocument, MainTrackClip, SpeedSection } from './types';

const EPSILON = 0.0001;

export interface MainTrackTimeMap {
  sourceDurationMs: number;
  projectDurationMs: number;
  effectiveDurationMs: number;
  clips: readonly MainTrackClip[];
  speedSections: readonly SpeedSection[];
  clipProjectSpans: ReadonlyArray<{ clipId: string; projectStartMs: number; projectEndMs: number }>;
  mapSourceToProject(sourceTimeMs: number): number | null;
  mapProjectToSource(projectTimeMs: number): number;
  mapProjectToEffective(projectTimeMs: number): number;
  mapEffectiveToProject(effectiveTimeMs: number): number;
  mapSourceToEffective(sourceTimeMs: number): number | null;
  mapEffectiveToSource(effectiveTimeMs: number): number;
  rateAtProjectTime(projectTimeMs: number): number;
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function createInitialEditingDocument(sourceDurationMs: number): EditingDocument {
  const end = Math.max(0, finite(sourceDurationMs));
  return {
    clips: end > 0 ? [{ id: 'main-clip-1', sourceStartMs: 0, sourceEndMs: end }] : [],
    speedSections: [],
  };
}

export function createMainTrackTimeMap(document: EditingDocument, sourceDurationMs: number): MainTrackTimeMap {
  const sourceEnd = Math.max(0, finite(sourceDurationMs));
  const clips = document.clips
    .map((clip) => ({
      ...clip,
      sourceStartMs: Math.max(0, Math.min(sourceEnd, finite(clip.sourceStartMs))),
      sourceEndMs: Math.max(0, Math.min(sourceEnd, finite(clip.sourceEndMs))),
    }))
    .filter((clip) => clip.sourceEndMs - clip.sourceStartMs > EPSILON);
  const projectDurationMs = clips.reduce((sum, clip) => sum + clip.sourceEndMs - clip.sourceStartMs, 0);
  let clipCursorMs = 0;
  const clipProjectSpans = clips.map((clip) => {
    const span = { clipId: clip.id, projectStartMs: clipCursorMs, projectEndMs: clipCursorMs + clip.sourceEndMs - clip.sourceStartMs };
    clipCursorMs = span.projectEndMs;
    return span;
  });
  const speedSections = normalizeSpeedSections(document.speedSections, projectDurationMs);

  const rateAtProjectTime = (projectTimeMs: number) => {
    const time = clamp(projectTimeMs, 0, projectDurationMs);
    return speedSections.find((section) => time >= section.projectStartMs && time < section.projectEndMs)?.rate ?? 1;
  };

  const mapSourceToProject = (sourceTimeMs: number): number | null => {
    const source = clamp(sourceTimeMs, 0, sourceEnd);
    let projectCursor = 0;
    for (const clip of clips) {
      if (source >= clip.sourceStartMs && source <= clip.sourceEndMs) {
        return projectCursor + Math.min(source - clip.sourceStartMs, clip.sourceEndMs - clip.sourceStartMs);
      }
      projectCursor += clip.sourceEndMs - clip.sourceStartMs;
    }
    return null;
  };

  const mapProjectToSource = (projectTimeMs: number): number => {
    const project = clamp(projectTimeMs, 0, projectDurationMs);
    let cursor = 0;
    for (const clip of clips) {
      const duration = clip.sourceEndMs - clip.sourceStartMs;
      if (project <= cursor + duration + EPSILON) {
        return clip.sourceStartMs + clamp(project - cursor, 0, duration);
      }
      cursor += duration;
    }
    return clips.at(-1)?.sourceEndMs ?? 0;
  };

  const boundaries = Array.from(new Set([
    0,
    projectDurationMs,
    ...speedSections.flatMap((section) => [section.projectStartMs, section.projectEndMs]),
  ])).sort((a, b) => a - b);

  const mapProjectToEffective = (projectTimeMs: number): number => {
    const project = clamp(projectTimeMs, 0, projectDurationMs);
    let effective = 0;
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (project <= start) break;
      effective += Math.max(0, Math.min(project, end) - start) / rateAtProjectTime(start + EPSILON);
      if (project <= end) break;
    }
    return effective;
  };

  const effectiveDurationMs = mapProjectToEffective(projectDurationMs);
  const mapEffectiveToProject = (effectiveTimeMs: number): number => {
    const effective = clamp(effectiveTimeMs, 0, effectiveDurationMs);
    let effectiveCursor = 0;
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      const rate = rateAtProjectTime(start + EPSILON);
      const effectiveSpan = (end - start) / rate;
      if (effective <= effectiveCursor + effectiveSpan + EPSILON) {
        return start + clamp((effective - effectiveCursor) * rate, 0, end - start);
      }
      effectiveCursor += effectiveSpan;
    }
    return projectDurationMs;
  };

  return {
    sourceDurationMs: sourceEnd,
    projectDurationMs,
    effectiveDurationMs,
    clips,
    speedSections,
    clipProjectSpans,
    mapSourceToProject,
    mapProjectToSource,
    mapProjectToEffective,
    mapEffectiveToProject,
    mapSourceToEffective: (source) => {
      const project = mapSourceToProject(source);
      return project === null ? null : mapProjectToEffective(project);
    },
    mapEffectiveToSource: (effective) => mapProjectToSource(mapEffectiveToProject(effective)),
    rateAtProjectTime,
  };
}

export function normalizeSpeedSections(sections: SpeedSection[], projectDurationMs: number): SpeedSection[] {
  return sections
    .map((section) => ({
      ...section,
      projectStartMs: clamp(finite(section.projectStartMs), 0, projectDurationMs),
      projectEndMs: clamp(finite(section.projectEndMs), 0, projectDurationMs),
      rate: clamp(finite(section.rate, 1), 0.1, 16),
    }))
    .filter((section) => section.projectEndMs - section.projectStartMs > EPSILON)
    .sort((a, b) => a.projectStartMs - b.projectStartMs || a.projectEndMs - b.projectEndMs)
    .reduce<SpeedSection[]>((result, section) => {
      const previous = result.at(-1);
      if (previous && section.projectStartMs < previous.projectEndMs) {
        previous.projectEndMs = section.projectStartMs;
        if (previous.projectEndMs - previous.projectStartMs <= EPSILON) result.pop();
      }
      result.push(section);
      return result;
    }, []);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
