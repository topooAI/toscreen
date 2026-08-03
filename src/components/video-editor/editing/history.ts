import { applyEditingCommand, cloneDocument } from './commands';
import type { EditingCommand, EditingDocument } from './types';

export interface EditingHistory {
  past: EditingDocument[];
  present: EditingDocument;
  future: EditingDocument[];
}

export function createEditingHistory(document: EditingDocument): EditingHistory {
  return { past: [], present: cloneDocument(document), future: [] };
}

export function executeEditingCommand(history: EditingHistory, command: EditingCommand, sourceDurationMs: number): EditingHistory {
  const present = applyEditingCommand(history.present, command, sourceDurationMs);
  if (JSON.stringify(present) === JSON.stringify(history.present)) return history;
  return { past: [...history.past, cloneDocument(history.present)], present, future: [] };
}

export function undoEditingCommand(history: EditingHistory): EditingHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneDocument(previous),
    future: [cloneDocument(history.present), ...history.future],
  };
}

export function redoEditingCommand(history: EditingHistory): EditingHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, cloneDocument(history.present)],
    present: cloneDocument(next),
    future: history.future.slice(1),
  };
}
