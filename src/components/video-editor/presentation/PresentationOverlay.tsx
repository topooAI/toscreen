import type { CSSProperties } from 'react';
import type { CursorDataPoint } from '../types';
import type { PresentationEffectRegion } from './types';
import { clickProgress, isRegionActive } from './presentationEffects';

interface Props {
  effects: PresentationEffectRegion[];
  cursorData: CursorDataPoint[];
  timeMs: number;
}

const box = (region: Extract<PresentationEffectRegion, { bounds: unknown }>): CSSProperties => ({
  left: `${region.bounds.x}%`, top: `${region.bounds.y}%`,
  width: `${region.bounds.width}%`, height: `${region.bounds.height}%`,
});

export function PresentationOverlay({ effects, cursorData, timeMs }: Props) {
  const active = effects.filter(region => isRegionActive(region, timeMs));
  const click = clickProgress(cursorData, timeMs);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 900 }}>
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'mask' }> => a.kind === 'mask').map(region => (
      <div key={region.id} className="absolute overflow-hidden" style={{ ...box(region), borderRadius: region.radius, background: region.mode === 'cover' ? region.color : 'rgba(255,255,255,.01)', backdropFilter: region.mode === 'blur' ? `blur(${region.blurPx}px)` : undefined }} />
    ))}
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'highlight' }> => a.kind === 'highlight').map(region => (
      <div key={region.id} className="absolute" style={{ ...box(region), borderRadius: region.radius, background: `${region.color}47`, boxShadow: `0 0 0 9999px rgba(0,0,0,${region.dimOpacity}), 0 0 0 2px ${region.color}` }} />
    ))}
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'keystroke' }> => a.kind === 'keystroke').map(region => (
      <div key={region.id} className="absolute left-1/2 flex -translate-x-1/2 gap-1.5" style={{ bottom: region.placement === 'center' ? '45%' : '7%' }}>
        {region.keys.map((key, index) => <kbd key={`${key}-${index}`} className="min-w-10 rounded-lg border border-white/20 bg-neutral-950/88 px-3 py-2 text-center text-lg font-semibold text-white shadow-xl">{key.trim()}</kbd>)}
      </div>
    ))}
    {click && <div className="absolute rounded-full border-2 border-white/90 bg-[#0D99FF]/20" style={{ left: `${click.point.cx * 100}%`, top: `${click.point.cy * 100}%`, width: `${22 + click.progress * 72}px`, height: `${22 + click.progress * 72}px`, transform: 'translate(-50%, -50%)', opacity: 1 - click.progress, boxShadow: '0 0 0 5px rgba(13,153,255,.12)' }} />}
  </div>;
}
