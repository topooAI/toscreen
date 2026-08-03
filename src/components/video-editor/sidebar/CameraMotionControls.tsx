import { Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import type { CameraMotionPreset } from '../types';

interface CameraMotionControlsProps {
  value: CameraMotionPreset;
  onChange: (value: CameraMotionPreset) => void;
  onDelete: () => void;
}

function MotionSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-[11px] text-[var(--ui-text-secondary)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--ui-text-tertiary)]">{value.toFixed(step < 1 ? 2 : 1)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#0D99FF]"
      />
    </label>
  );
}

export function CameraMotionControls({ value, onChange, onDelete }: CameraMotionControlsProps) {
  const updateTo = (patch: Partial<CameraMotionPreset['to']>) => onChange({
    ...value,
    id: 'custom',
    name: 'Custom Camera Motion',
    to: { ...value.to, ...patch },
  });
  const updateFrom = (patch: Partial<CameraMotionPreset['from']>) => onChange({
    ...value,
    id: 'custom',
    name: 'Custom Camera Motion',
    from: { ...value.from, ...patch },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-[6px] border border-[var(--ui-border)] bg-[var(--ui-control)] px-3 py-2">
        <div className="text-[11px] font-semibold text-[var(--ui-text-primary)]">Product Oblique Push</div>
        <div className="mt-0.5 text-[10px] text-[var(--ui-text-tertiary)]">产品倾斜推进</div>
      </div>
      <MotionSlider label="Push" value={value.to.scale} min={0.9} max={1.4} step={0.01} onChange={(scale) => updateTo({ scale })} />
      <MotionSlider label="Rotation" value={value.to.rotateZ} min={-12} max={12} step={0.1} onChange={(rotateZ) => updateTo({ rotateZ })} />
      <MotionSlider label="Perspective" value={value.to.skewX} min={-8} max={8} step={0.1} onChange={(skewX) => updateTo({ skewX })} />
      <MotionSlider label="Horizontal Move" value={value.to.translateX} min={-0.2} max={0.2} step={0.005} onChange={(translateX) => updateTo({ translateX })} />
      <MotionSlider label="Entry Blur" value={value.from.blur} min={0} max={6} step={0.1} onChange={(blur) => updateFrom({ blur })} />
      <Button
        onClick={onDelete}
        variant="destructive"
        className="h-8 w-full justify-start gap-2 rounded-[5px] bg-red-500/8 text-red-500 border border-red-500/15 hover:bg-red-500/12"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete Camera Motion
      </Button>
    </div>
  );
}
