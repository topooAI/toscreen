import {
  DEFAULT_CURSOR_STYLE,
  resolveCursorStyle,
  type CursorStylePreset,
} from './cursorStyles';

export type SettingsPane = 'general' | 'editing' | 'export' | 'shortcuts';

export type EditorAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '4:5';
export type EditorExportQuality = 'medium' | 'good' | 'source';
export type AppTheme = 'light' | 'dark';

export interface EditorPreferences {
  theme: AppTheme;
  aspectRatio: EditorAspectRatio;
  exportQuality: EditorExportQuality;
  cursorSize: number;
  cursorSmoothing: boolean;
  showVectorCursor: boolean;
  cursorStyle: CursorStylePreset;
  motionBlurEnabled: boolean;
  padding: number;
  borderRadius: number;
  shadowIntensity: number;
  lastSettingsPane: SettingsPane;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  theme: 'light',
  aspectRatio: '16:9',
  exportQuality: 'good',
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorStyle: DEFAULT_CURSOR_STYLE,
  motionBlurEnabled: true,
  padding: 60,
  borderRadius: 20,
  shadowIntensity: 0.6,
  lastSettingsPane: 'general',
};

const ASPECT_RATIOS: EditorAspectRatio[] = ['16:9', '9:16', '1:1', '4:3', '4:5'];
const EXPORT_QUALITIES: EditorExportQuality[] = ['medium', 'good', 'source'];
const SETTINGS_PANES: SettingsPane[] = ['general', 'editing', 'export', 'shortcuts'];
const APP_THEMES: AppTheme[] = ['light', 'dark'];

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function sanitizeEditorPreferences(value: unknown): EditorPreferences {
  const input = value && typeof value === 'object'
    ? value as Partial<EditorPreferences>
    : {};
  const cursorStyle = resolveCursorStyle(
    input.cursorStyle,
    typeof input.showVectorCursor === 'boolean'
      ? input.showVectorCursor
      : DEFAULT_EDITOR_PREFERENCES.showVectorCursor,
  );

  return {
    theme: APP_THEMES.includes(input.theme as AppTheme)
      ? input.theme as AppTheme
      : DEFAULT_EDITOR_PREFERENCES.theme,
    aspectRatio: ASPECT_RATIOS.includes(input.aspectRatio as EditorAspectRatio)
      ? input.aspectRatio as EditorAspectRatio
      : DEFAULT_EDITOR_PREFERENCES.aspectRatio,
    exportQuality: EXPORT_QUALITIES.includes(input.exportQuality as EditorExportQuality)
      ? input.exportQuality as EditorExportQuality
      : DEFAULT_EDITOR_PREFERENCES.exportQuality,
    cursorSize: clampNumber(input.cursorSize, DEFAULT_EDITOR_PREFERENCES.cursorSize, 0.5, 3),
    cursorSmoothing: typeof input.cursorSmoothing === 'boolean'
      ? input.cursorSmoothing
      : DEFAULT_EDITOR_PREFERENCES.cursorSmoothing,
    showVectorCursor: cursorStyle !== 'system',
    cursorStyle,
    motionBlurEnabled: typeof input.motionBlurEnabled === 'boolean'
      ? input.motionBlurEnabled
      : DEFAULT_EDITOR_PREFERENCES.motionBlurEnabled,
    padding: clampNumber(input.padding, DEFAULT_EDITOR_PREFERENCES.padding, 0, 200),
    borderRadius: clampNumber(input.borderRadius, DEFAULT_EDITOR_PREFERENCES.borderRadius, 0, 50),
    shadowIntensity: clampNumber(input.shadowIntensity, DEFAULT_EDITOR_PREFERENCES.shadowIntensity, 0, 1),
    lastSettingsPane: SETTINGS_PANES.includes(input.lastSettingsPane as SettingsPane)
      ? input.lastSettingsPane as SettingsPane
      : DEFAULT_EDITOR_PREFERENCES.lastSettingsPane,
  };
}
