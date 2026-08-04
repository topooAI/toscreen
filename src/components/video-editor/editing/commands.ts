import type { EditingCommand, EditingDocument, SpeedSection, TypingEvent } from './types';
import { createMainTrackTimeMap, normalizeSpeedSections } from './timeMap';

let commandSequence = 0;
const nextId = (prefix: string) => `${prefix}-${++commandSequence}`;

export function applyEditingCommand(document: EditingDocument, command: EditingCommand, sourceDurationMs: number): EditingDocument {
  const snapshot = cloneDocument(document);
  switch (command.type) {
    case 'split': {
      const index = snapshot.clips.findIndex((clip) => clip.id === command.clipId);
      if (index < 0) return snapshot;
      const clip = snapshot.clips[index];
      if (command.sourceTimeMs <= clip.sourceStartMs || command.sourceTimeMs >= clip.sourceEndMs) return snapshot;
      snapshot.clips.splice(index, 1,
        { ...clip, sourceEndMs: command.sourceTimeMs },
        { ...clip, id: nextId('main-clip-edit'), sourceStartMs: command.sourceTimeMs },
      );
      return snapshot;
    }
    case 'delete':
      snapshot.clips = snapshot.clips.filter((clip) => clip.id !== command.clipId);
      return snapshot;
    case 'reorder': {
      const index = snapshot.clips.findIndex((clip) => clip.id === command.clipId);
      if (index < 0) return snapshot;
      const [clip] = snapshot.clips.splice(index, 1);
      snapshot.clips.splice(Math.max(0, Math.min(command.toIndex, snapshot.clips.length)), 0, clip);
      return snapshot;
    }
    case 'set-speed': {
      const section: SpeedSection = {
        id: command.id ?? nextId('speed'),
        projectStartMs: command.projectStartMs,
        projectEndMs: command.projectEndMs,
        rate: command.rate,
        origin: command.origin ?? 'manual',
      };
      snapshot.speedSections = replaceSpeedRange(snapshot.speedSections, section);
      const duration = createMainTrackTimeMap(snapshot, sourceDurationMs).projectDurationMs;
      snapshot.speedSections = normalizeSpeedSections(snapshot.speedSections, duration);
      return snapshot;
    }
    case 'update-speed': {
      snapshot.speedSections = snapshot.speedSections.map((section) => section.id === command.id ? {
        ...section,
        projectStartMs: command.projectStartMs ?? section.projectStartMs,
        projectEndMs: command.projectEndMs ?? section.projectEndMs,
        rate: command.rate ?? section.rate,
      } : section);
      snapshot.speedSections = normalizeSpeedSections(snapshot.speedSections, createMainTrackTimeMap(snapshot, sourceDurationMs).projectDurationMs);
      return snapshot;
    }
    case 'delete-speed':
      snapshot.speedSections = snapshot.speedSections.filter((section) => section.id !== command.id);
      return snapshot;
    case 'replace-typing-speed':
      snapshot.speedSections = [
        ...snapshot.speedSections.filter((section) => section.origin !== 'typing'),
        ...generateTypingSpeedSections(command.events, command.activeRate, command.idleRate),
      ];
      return snapshot;
  }
}

export function generateTypingSpeedSections(events: TypingEvent[], activeRate = 1, idleRate = 4): SpeedSection[] {
  const timestamps = events
    .filter((event) => event.type === 'keydown' && Number.isFinite(event.timestamp))
    .map((event) => Math.max(0, event.timestamp))
    .sort((a, b) => a - b);
  if (timestamps.length === 0) return [];
  const activePaddingMs = 180;
  const idleThresholdMs = 650;
  const sections: SpeedSection[] = [];
  let activeStart = Math.max(0, timestamps[0] - activePaddingMs);
  let activeEnd = timestamps[0] + activePaddingMs;
  for (const timestamp of timestamps.slice(1)) {
    if (timestamp - activeEnd <= idleThresholdMs) {
      activeEnd = timestamp + activePaddingMs;
      continue;
    }
    sections.push(speed(activeStart, activeEnd, activeRate));
    sections.push(speed(activeEnd, Math.max(activeEnd, timestamp - activePaddingMs), idleRate));
    activeStart = Math.max(0, timestamp - activePaddingMs);
    activeEnd = timestamp + activePaddingMs;
  }
  sections.push(speed(activeStart, activeEnd, activeRate));
  return sections.filter((section) => section.projectEndMs > section.projectStartMs);
}

function speed(projectStartMs: number, projectEndMs: number, rate: number): SpeedSection {
  return { id: nextId('typing-speed'), projectStartMs, projectEndMs, rate, origin: 'typing' };
}

function replaceSpeedRange(sections: SpeedSection[], replacement: SpeedSection): SpeedSection[] {
  return sections.flatMap((section) => {
    if (section.projectEndMs <= replacement.projectStartMs || section.projectStartMs >= replacement.projectEndMs) return [section];
    const residual: SpeedSection[] = [];
    if (section.projectStartMs < replacement.projectStartMs) residual.push({ ...section, projectEndMs: replacement.projectStartMs });
    if (section.projectEndMs > replacement.projectEndMs) residual.push({ ...section, id: nextId('speed'), projectStartMs: replacement.projectEndMs });
    return residual;
  }).concat(replacement);
}

export function cloneDocument(document: EditingDocument): EditingDocument {
  return {
    schemaVersion: 1,
    clips: document.clips.map((clip) => ({ ...clip })),
    speedSections: document.speedSections.map((section) => ({ ...section })),
  };
}
