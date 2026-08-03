import {
  DEFAULT_EDITOR_PREFERENCES,
  sanitizeEditorPreferences,
  type EditorPreferences,
} from '../../shared/editorPreferences'

export type { AppTheme, EditorPreferences, SettingsPane } from '../../shared/editorPreferences'
export type { CursorStylePreset } from '../../shared/cursorStyles'
export { DEFAULT_EDITOR_PREFERENCES } from '../../shared/editorPreferences'
export { sanitizeEditorPreferences } from '../../shared/editorPreferences'

export function loadEditorPreferences(): EditorPreferences {
  try {
    return sanitizeEditorPreferences(window.electronAPI?.getEditorPreferencesSync?.())
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES }
  }
}

export async function saveEditorPreferences(preferences: EditorPreferences): Promise<EditorPreferences> {
  const sanitized = sanitizeEditorPreferences(preferences)
  const result = await window.electronAPI.saveEditorPreferences(sanitized)
  if (!result.success || !result.preferences) {
    throw new Error(result.error || 'Unable to save settings')
  }
  return sanitizeEditorPreferences(result.preferences)
}

export async function resetEditorPreferences(): Promise<EditorPreferences> {
  const result = await window.electronAPI.resetEditorPreferences()
  if (!result.success || !result.preferences) {
    throw new Error(result.error || 'Unable to reset settings')
  }
  return sanitizeEditorPreferences(result.preferences)
}
