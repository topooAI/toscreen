export interface PresentationBounds { x: number; y: number; width: number; height: number }
interface TimedEffect { id: string; startMs: number; endMs: number }
export type PresentationEffectRegion =
  | (TimedEffect & { kind: 'mask'; bounds: PresentationBounds; mode: 'blur' | 'cover'; blurPx: number; color: string; radius: number })
  | (TimedEffect & { kind: 'highlight'; bounds: PresentationBounds; color: string; dimOpacity: number; radius: number })
  | (TimedEffect & { kind: 'cursor-hide' })
  | (TimedEffect & { kind: 'keystroke'; keys: string[]; placement: 'bottom' | 'center' });

export const DEFAULT_PRESENTATION_BOUNDS: PresentationBounds = { x: 35, y: 35, width: 30, height: 20 };
