import { EyeOff, Highlighter, Keyboard, ScanLine, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PresentationEffectRegion } from './types';
import { DEFAULT_PRESENTATION_BOUNDS } from './types';

interface Props { timeMs: number; durationMs: number; effects: PresentationEffectRegion[]; onAdd: (effect: PresentationEffectRegion) => void; onRemove: (id: string) => void }

export function PresentationToolbar({ timeMs, durationMs, effects, onAdd, onRemove }: Props) {
  const span = () => ({ id: `presentation-${Date.now()}`, startMs: timeMs, endMs: Math.min(durationMs, timeMs + 1600) });
  const buttons = [
    { title: 'Blur Mask', icon: ScanLine, add: () => onAdd({ ...span(), kind: 'mask', bounds: DEFAULT_PRESENTATION_BOUNDS, mode: 'blur', blurPx: 18, color: '#111827', radius: 10 }) },
    { title: 'Highlight', icon: Highlighter, add: () => onAdd({ ...span(), kind: 'highlight', bounds: DEFAULT_PRESENTATION_BOUNDS, color: '#FFD748', dimOpacity: .48, radius: 10 }) },
    { title: 'Hide Cursor', icon: EyeOff, add: () => onAdd({ ...span(), kind: 'cursor-hide' }) },
    { title: 'Show Shortcut', icon: Keyboard, add: () => onAdd({ ...span(), kind: 'keystroke', keys: ['⌘', 'K'], placement: 'bottom' }) },
  ];
  return <div className="absolute right-2 top-2 z-[1000] flex gap-1 rounded-lg border border-white/10 bg-black/55 p-1 backdrop-blur-md">
    {buttons.map(({ title, icon: Icon, add }) => <Button key={title} type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/80 hover:bg-white/15 hover:text-white" title={title} aria-label={title} onClick={add}><Icon className="h-3.5 w-3.5" /></Button>)}
    {effects.length > 0 && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/80 hover:bg-white/15 hover:text-white" title="Remove last presentation effect" aria-label="Remove last presentation effect" onClick={() => onRemove(effects[effects.length - 1].id)}><Undo2 className="h-3.5 w-3.5" /></Button>}
  </div>;
}
