import type { CursorDataPoint } from '../types';
import type { PresentationEffectRegion } from './types';

export function isRegionActive(region: Pick<PresentationEffectRegion, 'startMs' | 'endMs'>, timeMs: number): boolean {
  return timeMs >= region.startMs && timeMs <= region.endMs;
}

export function isCursorHiddenAt(effects: PresentationEffectRegion[], timeMs: number): boolean {
  return effects.some(region => region.kind === 'cursor-hide' && isRegionActive(region, timeMs));
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
    return { id: `recorded-key-${startMs}-${index}`, kind: 'keystroke', startMs, endMs: startMs + 900, keys: [label], placement: 'bottom' };
  });
}
