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

const KEY_LABELS: Record<number, string> = { 8: '⌫', 9: '⇥', 13: '↵', 16: '⇧', 17: '⌃', 18: '⌥', 27: 'Esc', 32: 'Space', 91: '⌘', 93: '⌘' };
export function recordedShortcutEffects(points: Array<CursorDataPoint & { timestampMs?: number; data?: { keycode?: number } }>): PresentationEffectRegion[] {
  return points.filter(point => point.type === 'keydown' && Number.isFinite(point.data?.keycode)).map((point, index) => {
    const code = Number(point.data?.keycode); const label = KEY_LABELS[code] ?? (code >= 65 && code <= 90 ? String.fromCharCode(code) : `Key ${code}`);
    const startMs = Number(point.timestamp ?? point.timestampMs ?? 0);
    const modifiers = (point as typeof point & { modifiers?: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } }).modifiers;
    const keys = [...(modifiers?.meta ? ['⌘'] : []), ...(modifiers?.ctrl ? ['⌃'] : []), ...(modifiers?.alt ? ['⌥'] : []), ...(modifiers?.shift ? ['⇧'] : []), label];
    return { id: `recorded-key-${startMs}-${index}`, kind: 'keystroke', startMs, endMs: startMs + 900, keys: Array.from(new Set(keys)), placement: 'bottom', style: 'dark', durationMs: 900 };
  });
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
