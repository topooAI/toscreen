import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_EDITOR_PREFERENCES,
  sanitizeEditorPreferences,
  type EditorPreferences,
} from '../shared/editorPreferences'

const PREFERENCES_FILE_NAME = 'editor-preferences.json'
let writeQueue: Promise<void> = Promise.resolve()

function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), PREFERENCES_FILE_NAME)
}

function readEditorPreferences(): EditorPreferences {
  try {
    const raw = fs.readFileSync(getPreferencesPath(), 'utf8')
    return sanitizeEditorPreferences(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES }
  }
}

async function persistEditorPreferences(value: unknown): Promise<EditorPreferences> {
  const preferences = sanitizeEditorPreferences(value)
  const preferencesPath = getPreferencesPath()
  const temporaryPath = `${preferencesPath}.tmp`

  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await fs.promises.mkdir(path.dirname(preferencesPath), { recursive: true })
    await fs.promises.writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8')
    await fs.promises.rename(temporaryPath, preferencesPath)
  })

  await writeQueue
  return preferences
}

function notifyPreferencesChanged(preferences: EditorPreferences): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('editor-preferences-updated', preferences)
    }
  })
}

export function registerPreferenceIpcHandlers(): void {
  ipcMain.on('get-editor-preferences-sync', (event) => {
    event.returnValue = readEditorPreferences()
  })

  ipcMain.handle('save-editor-preferences', async (_event, value: unknown) => {
    try {
      const preferences = await persistEditorPreferences(value)
      notifyPreferencesChanged(preferences)
      return { success: true, preferences }
    } catch (error) {
      console.error('[Preferences] Failed to save editor preferences:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('reset-editor-preferences', async () => {
    try {
      const preferences = await persistEditorPreferences(DEFAULT_EDITOR_PREFERENCES)
      notifyPreferencesChanged(preferences)
      return { success: true, preferences }
    } catch (error) {
      console.error('[Preferences] Failed to reset editor preferences:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
