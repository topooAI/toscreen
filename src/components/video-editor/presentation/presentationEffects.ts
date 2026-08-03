import type { CursorDataPoint } from '../types';
import type { PresentationEffectRegion } from './types';

export function isRegionActive(region: Pick<PresentationEffectRegion, 'startMs' | 'endMs'>, timeMs: number): boolean {
  return timeMs >= region.startMs && timeMs <= region.endMs;
}

export function isCursorHiddenAt(effects: PresentationEffectRegion[], timeMs: number): boolean {
  const regions = effects.filter(region => region.kind === 'cursor-visibility' && isRegionActive(region, timeMs));
  return regions.length > 0 ? !(regions[regions.length - 1] as Extract<PresentationEffectRegion, { kind: 'cursor-visibility' }>).visible : false;
}

export function clickEvents(points: CursorDataPoint[]): CursorDataPoint[] {
  return points.filter(point => point.isClick || point.type === 'click' || point.type === 'mousedown');
}

export function clickProgress(points: CursorDataPoint[], timeMs: number, durationMs = 520) {
  let best: { point: CursorDataPoint; progress: number } | null = null;
  for (const point of clickEvents(points)) {
    const elapsed = timeMs - point.timestamp;
    if (elapsed < 0 || elapsed > durationMs) continue;
    const candidate = { point, progress: elapsed / durationMs };
    if (!best || candidate.progress < best.progress) best = candidate;
  }
  return best;
}

const KEY_LABELS: Record<number, string> = { 1: 'Esc', 14: '⌫', 15: '⇥', 28: '↵', 57: 'Space', 8: '⌫', 9: '⇥', 13: '↵', 16: '⇧', 17: '⌃', 18: '⌥', 27: 'Esc', 32: 'Space', 91: '⌘', 93: '⌘' };
const UIOHOOK_LETTERS: Record<number, string> = { 30: 'A', 48: 'B', 46: 'C', 32: 'D', 18: 'E', 33: 'F', 34: 'G', 35: 'H', 23: 'I', 36: 'J', 37: 'K', 38: 'L', 50: 'M', 49: 'N', 24: 'O', 25: 'P', 16: 'Q', 19: 'R', 31: 'S', 20: 'T', 22: 'U', 47: 'V', 17: 'W', 45: 'X', 21: 'Y', 44: 'Z' };
const MODIFIER_ONLY_CODES = new Set([42, 54, 29, 3613, 56, 3640, 3675, 3676, 91, 92, 93]);
export const keyLabelForCode = (code: number) => UIOHOOK_LETTERS[code] ?? KEY_LABELS[code] ?? (code >= 65 && code <= 90 ? String.fromCharCode(code) : `Key ${code}`);
export function recordedShortcutEffects(points: Array<CursorDataPoint & { timestampMs?: number; data?: { keycode?: number } }>): PresentationEffectRegion[] {
  const output: PresentationEffectRegion[] = [];
  const heldMainKeys = new Map<number, number>();
  let lastChordSignature = ''; let lastChordTimeMs = Number.NEGATIVE_INFINITY;
  const ordered = [...points].sort((a, b) => Number(a.timestamp ?? a.timestampMs ?? 0) - Number(b.timestamp ?? b.timestampMs ?? 0));
  for (const point of ordered) {
    if (!Number.isFinite(point.data?.keycode)) continue;
    const code = Number(point.data?.keycode);
    const startMs = Number(point.timestamp ?? point.timestampMs ?? 0);
    if (point.type === 'keyup') { heldMainKeys.delete(code); continue; }
    if (point.type !== 'keydown' || MODIFIER_ONLY_CODES.has(code)) continue;
    const previousDownMs = heldMainKeys.get(code);
    heldMainKeys.set(code, startMs);
    if (previousDownMs !== undefined && startMs - previousDownMs <= 500) continue;
    const label = keyLabelForCode(code);
    const modifiers = (point as typeof point & { modifiers?: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } }).modifiers;
    const keys = [...(modifiers?.meta ? ['⌘'] : []), ...(modifiers?.ctrl ? ['⌃'] : []), ...(modifiers?.alt ? ['⌥'] : []), ...(modifiers?.shift ? ['⇧'] : []), label];
    const uniqueKeys = Array.from(new Set(keys)); const signature = uniqueKeys.join('+');
    if (lastChordSignature === signature && startMs - lastChordTimeMs <= 500) continue;
    lastChordSignature = signature; lastChordTimeMs = startMs;
    output.push({ id: `recorded-key-${startMs}-${output.length}`, kind: 'keystroke', startMs, endMs: startMs + 900, keys: uniqueKeys, placement: 'bottom', style: 'dark', durationMs: 900 });
  }
  return output;
}

export function activeClickEffect(effects: PresentationEffectRegion[], timeMs: number) {
  return [...effects].reverse().find((effect): effect is Extract<PresentationEffectRegion, { kind: 'click-effect' }> => effect.kind === 'click-effect' && isRegionActive(effect, timeMs));
}

export function sampleEffectBounds(effect: Extract<PresentationEffectRegion, { bounds: unknown }>, timeMs: number) {
  if (effect.kind !== 'mask' || effect.follow !== 'keyframes' || effect.followKeyframes.length === 0) return effect.bounds;
  const ordered = [...effect.followKeyframes].sort((a, b) => a.timeMs - b.timeMs);
  const rightIndex = ordered.findIndex(point => point.timeMs >= timeMs);
  if (rightIndex <= 0) return { ...effect.bounds, x: ordered[0].x, y: ordered[0].y };
  if (rightIndex < 0) { const last = ordered[ordered.length - 1]; return { ...effect.bounds, x: last.x, y: last.y }; }
  const left = ordered[rightIndex - 1], right = ordered[rightIndex];
  const progress = (timeMs - left.timeMs) / Math.max(1, right.timeMs - left.timeMs);
  return { ...effect.bounds, x: left.x + (right.x - left.x) * progress, y: left.y + (right.y - left.y) * progress };
}
