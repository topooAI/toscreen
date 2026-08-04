export interface MainTrackClip {
  id: string;
  sourceStartMs: number;
  sourceEndMs: number;
}

export interface SpeedSection {
  id: string;
  projectStartMs: number;
  projectEndMs: number;
  rate: number;
  origin: 'manual' | 'typing';
}

export interface EditingDocument {
  /** Version 1 marks the document authoritative, including an intentionally empty Main Track. */
  schemaVersion?: 1;
  clips: MainTrackClip[];
  speedSections: SpeedSection[];
}

export interface TypingEvent {
  timestamp: number;
  type?: string;
}

export type EditingCommand =
  | { type: 'split'; clipId: string; sourceTimeMs: number }
  | { type: 'delete'; clipId: string }
  | { type: 'reorder'; clipId: string; toIndex: number }
  | { type: 'set-speed'; projectStartMs: number; projectEndMs: number; rate: number; origin?: SpeedSection['origin'] }
  | { type: 'update-speed'; id: string; projectStartMs?: number; projectEndMs?: number; rate?: number }
  | { type: 'delete-speed'; id: string }
  | { type: 'replace-typing-speed'; events: TypingEvent[]; activeRate?: number; idleRate?: number };
