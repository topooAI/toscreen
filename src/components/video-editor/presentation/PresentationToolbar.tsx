import { EyeOff, Highlighter, Keyboard, ScanLine, Undo2, MousePointerClick, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PresentationEffectRegion } from './types';
import { DEFAULT_PRESENTATION_BOUNDS } from './types';

interface Props {
  timeMs: number;
  durationMs: number;
  effects: PresentationEffectRegion[];
  placement: 'right' | 'top';
  onAdd: (effect: PresentationEffectRegion) => void;
  onRemove: (id: string) => void;
}

export function PresentationToolbar({ timeMs, durationMs, effects, placement, onAdd, onRemove }: Props) {
  const span = () => ({ id: `presentation-${Date.now()}`, startMs: timeMs, endMs: Math.min(durationMs, timeMs + 1600) });
  const buttons = [
    { title: 'Blur Mask', icon: ScanLine, add: () => onAdd({ ...span(), kind: 'mask', bounds: DEFAULT_PRESENTATION_BOUNDS, mode: 'blur', blurPx: 18, color: '#111827', opacity: 1, radius: 10, follow: 'fixed', followKeyframes: [] }) },
    { title: 'Highlight', icon: Highlighter, add: () => onAdd({ ...span(), kind: 'highlight', bounds: DEFAULT_PRESENTATION_BOUNDS, color: '#FFD748', dimOpacity: .48, opacity: .28, radius: 10 }) },
    { title: 'Hide Cursor', icon: EyeOff, add: () => onAdd({ ...span(), kind: 'cursor-visibility', visible: false }) },
    { title: 'Show Shortcut', icon: Keyboard, add: () => onAdd({ ...span(), kind: 'keystroke', keys: ['⌘', 'K'], placement: 'bottom', style: 'dark', durationMs: 900 }) },
    { title: 'Click Effect', icon: MousePointerClick, add: () => onAdd({ ...span(), kind: 'click-effect', style: 'ripple', intensity: 1, size: 1, soundEnabled: true, soundVolume: .7 }) },
    { title: 'Presenter', icon: Video, add: () => onAdd({ ...span(), kind: 'presenter', bounds: { x: 76, y: 68, width: 18, height: 24 }, sourceStartMs: 0, shape: 'circle', visible: true, opacity: 1, fit: 'cover' }) },
  ];
  return <div
    aria-label="Canvas tools"
    className={cn(
      "absolute z-[1000] flex gap-1 rounded-[7px] border border-[var(--ui-border)] bg-[var(--ui-inspector-surface)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
      placement === 'right'
        ? "right-2 top-1/2 -translate-y-1/2 flex-col"
        : "left-1/2 top-2 -translate-x-1/2 flex-row",
    )}
  >
    {buttons.map(({ title, icon: Icon, add }) => <Button key={title} type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[#0D99FF]" title={title} aria-label={title} onClick={add}><Icon className="h-3.5 w-3.5" /></Button>)}
    {effects.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[#0D99FF]" title="Remove last presentation effect" aria-label="Remove last presentation effect" onClick={() => onRemove(effects[effects.length - 1].id)}><Undo2 className="h-3.5 w-3.5" /></Button>}
  </div>;
}
