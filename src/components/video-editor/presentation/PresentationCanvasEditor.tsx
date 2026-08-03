import { Rnd } from 'react-rnd';
import type { PresentationEffectRegion, PresentationBounds } from './types';
import { isRegionActive, sampleEffectBounds } from './presentationEffects';

interface Props { effects: PresentationEffectRegion[]; selectedId: string | null; timeMs: number; width: number; height: number; onSelect: (id: string) => void; onBoundsChange: (id: string, bounds: PresentationBounds) => void }

export function PresentationCanvasEditor({ effects, selectedId, timeMs, width, height, onSelect, onBoundsChange }: Props) {
  return <div className="absolute inset-0 z-[1100] pointer-events-none">
    {effects.filter((effect): effect is Extract<PresentationEffectRegion, { bounds: PresentationBounds }> => 'bounds' in effect && (effect.id === selectedId || isRegionActive(effect, timeMs))).map(effect => {
      const selected = effect.id === selectedId; const sampledBounds = sampleEffectBounds(effect, timeMs);
      return <Rnd key={effect.id} bounds="parent" position={{ x: sampledBounds.x / 100 * width, y: sampledBounds.y / 100 * height }} size={{ width: sampledBounds.width / 100 * width, height: sampledBounds.height / 100 * height }}
        disableDragging={!selected} enableResizing={selected} className={selected ? 'pointer-events-auto ring-2 ring-[#0D99FF] ring-offset-1 ring-offset-transparent' : 'pointer-events-auto'}
        onClick={(event: MouseEvent) => { event.stopPropagation(); onSelect(effect.id); }}
        onDragStop={(_event, data) => onBoundsChange(effect.id, { ...effect.bounds, x: data.x / width * 100, y: data.y / height * 100 })}
        onResizeStop={(_event, _direction, ref, _delta, position) => onBoundsChange(effect.id, { x: position.x / width * 100, y: position.y / height * 100, width: ref.offsetWidth / width * 100, height: ref.offsetHeight / height * 100 })}>
        <div className="h-full w-full" />
      </Rnd>;
    })}
  </div>;
}
