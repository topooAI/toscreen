import { ChevronDown } from "lucide-react";

import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

interface PresetControlsProps {
  presets: Array<{ id: string; name: string }>;
  selectedPresetId: string;
  defaultPresetId: string;
  onSelectedPresetChange: (id: string) => void;
  onCreate: () => void;
  onApply: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onImport: () => void;
  onExport: () => void;
}

export function PresetControls({
  presets,
  selectedPresetId,
  defaultPresetId,
  onSelectedPresetChange,
  onCreate,
  onApply,
  onUpdate,
  onDelete,
  onSetDefault,
  onImport,
  onExport,
}: PresetControlsProps) {
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  const isDefault = Boolean(selectedPresetId && selectedPresetId === defaultPresetId);

  return (
    <section className="border-t border-[var(--ui-border)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-[var(--ui-text-primary)]">Presets</h3>
        <Button
          type="button"
          variant="ghost"
          onClick={onCreate}
          className="h-7 rounded-[5px] px-2 text-[11px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] hover:text-[var(--ui-text-primary)]"
        >
          New
        </Button>
      </div>

      <select
        aria-label="Style preset"
        value={selectedPresetId}
        onChange={(event) => onSelectedPresetChange(event.target.value)}
        className="h-8 w-full rounded-[5px] border border-transparent bg-[var(--ui-control)] px-2 text-[12px] text-[var(--ui-text-secondary)] outline-none hover:border-[var(--ui-border)] focus:border-[#0D99FF]"
      >
        <option value="">Choose preset</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}{preset.id === defaultPresetId ? " · Default" : ""}
          </option>
        ))}
      </select>

      <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-1.5">
        <Button
          type="button"
          disabled={!selectedPresetId}
          onClick={onApply}
          className="h-8 rounded-[5px] bg-[var(--ui-control)] px-3 text-[11px] font-medium text-[var(--ui-text-primary)] shadow-none hover:bg-[var(--ui-control-hover)] disabled:opacity-40"
        >
          Apply
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onImport}
          className="h-8 rounded-[5px] px-2 text-[11px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)]"
        >
          Import
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={!selectedPresetId}
              className="h-8 gap-1 rounded-[5px] px-2 text-[11px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] disabled:opacity-40"
            >
              Manage
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="toscreen-dropdown-menu z-[220] min-w-40 rounded-[8px] border-0 p-1.5">
            <DropdownMenuItem onSelect={onUpdate} className="h-8 rounded-[5px] text-[11px]">
              Update from current settings
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDefault} onSelect={onSetDefault} className="h-8 rounded-[5px] text-[11px]">
              {isDefault ? "Default preset" : "Set as default"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport} className="h-8 rounded-[5px] text-[11px]">
              Export preset…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="h-8 rounded-[5px] text-[11px] text-red-500 focus:text-red-500">
              Delete preset…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selected && (
        <p className="mt-2 truncate text-[10px] text-[var(--ui-text-tertiary)]">
          {isDefault ? "Default preset" : `Selected: ${selected.name}`}
        </p>
      )}
    </section>
  );
}
