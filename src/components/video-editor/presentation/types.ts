export interface PresentationBounds { x: number; y: number; width: number; height: number }
export interface PresentationFollowKeyframe { timeMs: number; x: number; y: number }
export type RippleStyle = 'ripple' | 'shockwave' | 'pulse';
interface TimedEffect { id: string; startMs: number; endMs: number }
export type PresentationEffectRegion =
  | (TimedEffect & { kind: 'mask'; bounds: PresentationBounds; mode: 'blur' | 'cover'; blurPx: number; color: string; opacity: number; radius: number; follow: 'fixed' | 'keyframes'; followKeyframes: PresentationFollowKeyframe[] })
  | (TimedEffect & { kind: 'highlight'; bounds: PresentationBounds; color: string; dimOpacity: number; opacity: number; radius: number })
  | (TimedEffect & { kind: 'cursor-visibility'; visible: boolean })
  | (TimedEffect & { kind: 'click-effect'; style: RippleStyle; intensity: number; size: number; soundEnabled: boolean; soundVolume: number })
  | (TimedEffect & { kind: 'keystroke'; keys: string[]; placement: 'bottom' | 'center' | 'top-left' | 'top-right'; style: 'dark' | 'light' | 'accent'; durationMs: number })
  | (TimedEffect & { kind: 'presenter'; sourceUrl?: string; posterDataUrl?: string; sourceStartMs: number; shape: 'circle' | 'rectangle'; bounds: PresentationBounds; visible: boolean; opacity: number; fit: 'cover' | 'contain' });

export const DEFAULT_PRESENTATION_BOUNDS: PresentationBounds = { x: 35, y: 35, width: 30, height: 20 };
