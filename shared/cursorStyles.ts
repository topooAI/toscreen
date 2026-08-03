export const CURSOR_STYLE_PRESETS = [
  'toscreen',
  'system',
  'light',
  'blue',
  'yellow',
  'pink',
  'custom',
] as const;

export type CursorStylePreset = typeof CURSOR_STYLE_PRESETS[number];

export const CURSOR_CUSTOMIZABLE_STATES = [
  'default',
  'pointer',
  'text',
  'vertical-text',
  'grab',
  'grabbing',
  'copy',
  'alias',
  'context-menu',
  'not-allowed',
  'help',
  'progress',
  'crosshair',
  'all-scroll',
  'zoom-in',
  'zoom-out',
  'row-resize',
  'col-resize',
  'ns-resize',
  'nwse-resize',
  'nesw-resize',
] as const;

export type CursorCustomState = typeof CURSOR_CUSTOMIZABLE_STATES[number];
export type CursorCustomImageMap = Partial<Record<CursorCustomState, string>>;

export const DEFAULT_CURSOR_STYLE: CursorStylePreset = 'toscreen';

export function isCursorStylePreset(value: unknown): value is CursorStylePreset {
  return typeof value === 'string'
    && CURSOR_STYLE_PRESETS.includes(value as CursorStylePreset);
}

export function resolveCursorStyle(
  value: unknown,
  legacyVectorCursor = true,
): CursorStylePreset {
  if (isCursorStylePreset(value)) return value;
  return legacyVectorCursor ? DEFAULT_CURSOR_STYLE : 'system';
}
