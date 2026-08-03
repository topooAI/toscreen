import type { CSSProperties } from 'react';
import type { CursorDataPoint } from '../types';
import type { PresentationEffectRegion } from './types';
import { PresenterPreview } from './PresenterPreview';
import { activeClickEffect, clickProgress, isRegionActive, sampleEffectBounds } from './presentationEffects';

interface Props {
  effects: PresentationEffectRegion[];
  cursorData: CursorDataPoint[];
  timeMs: number;
  playing: boolean;
}

const box = (region: Extract<PresentationEffectRegion, { bounds: unknown }>): CSSProperties => ({
  left: `${region.bounds.x}%`, top: `${region.bounds.y}%`,
  width: `${region.bounds.width}%`, height: `${region.bounds.height}%`,
});

export function PresentationOverlay({ effects, cursorData, timeMs, playing }: Props) {
  const active = effects.filter(region => isRegionActive(region, timeMs));
  const click = clickProgress(cursorData, timeMs);
  const clickEffect = activeClickEffect(effects, timeMs);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 900 }}>
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'mask' }> => a.kind === 'mask').map(region => (
      <div key={region.id} className="absolute overflow-hidden" style={{ ...box({ ...region, bounds: sampleEffectBounds(region, timeMs) }), opacity: region.opacity, borderRadius: region.radius, background: region.mode === 'cover' ? region.color : 'rgba(255,255,255,.01)', backdropFilter: region.mode === 'blur' ? `blur(${region.blurPx}px)` : undefined }} />
    ))}
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'highlight' }> => a.kind === 'highlight').map(region => (
      <div key={region.id} className="absolute" style={{ ...box(region), opacity: region.opacity, borderRadius: region.radius, background: region.color, boxShadow: `0 0 0 9999px rgba(0,0,0,${region.dimOpacity}), 0 0 0 2px ${region.color}` }} />
    ))}
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'keystroke' }> => a.kind === 'keystroke').map(region => (
      <div key={region.id} className={`absolute flex gap-1.5 ${region.placement === 'top-left' ? 'left-[5%] top-[7%]' : region.placement === 'top-right' ? 'right-[5%] top-[7%]' : 'left-1/2 -translate-x-1/2'}`} style={{ bottom: region.placement === 'center' ? '45%' : region.placement === 'bottom' ? '7%' : undefined }}>
        {region.keys.map((key, index) => <kbd key={`${key}-${index}`} className={`min-w-10 rounded-lg border px-3 py-2 text-center text-lg font-semibold shadow-xl ${region.style === 'light' ? 'border-black/20 bg-white/90 text-black' : region.style === 'accent' ? 'border-white/20 bg-[#0D99FF]/90 text-white' : 'border-white/20 bg-neutral-950/88 text-white'}`}>{key.trim()}</kbd>)}
      </div>
    ))}
    {active.filter((a): a is Extract<PresentationEffectRegion, { kind: 'presenter' }> => a.kind === 'presenter' && a.visible).map(region => <PresenterPreview key={region.id} effect={region} timeMs={timeMs} playing={playing} />)}
    {click && clickEffect && <div className={`absolute rounded-full border-2 ${clickEffect.style === 'shockwave' ? 'border-[#FFD748]' : 'border-white/90'} bg-[#0D99FF]/20`} style={{ left: `${click.point.cx * 100}%`, top: `${click.point.cy * 100}%`, width: `${(22 + click.progress * 72) * clickEffect.size}px`, height: `${(22 + click.progress * 72) * clickEffect.size}px`, transform: 'translate(-50%, -50%)', opacity: (1 - click.progress) * clickEffect.intensity, boxShadow: clickEffect.style === 'pulse' ? '0 0 25px 12px rgba(13,153,255,.35)' : '0 0 0 5px rgba(13,153,255,.12)' }} />}
  </div>;
}
