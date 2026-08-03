/// <reference types="vite/client" />
/// <reference types="../electron/electron-env" />

interface ProcessedDesktopSource {
  id: string;
  name: string;
  display_id: string;
  thumbnail: string | null;
  appIcon: string | null;
}

interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message: string
      error?: string
    }>
    getRecordedVideoPath: () => Promise<{
      success: boolean
      path?: string
      proxyPath?: string
      audioPath?: string
      message?: string
      error?: string
    }>
    getAssetBasePath: () => Promise<string | null>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{
      success: boolean
      path?: string
      message?: string
      cancelled?: boolean
    }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>
    setCurrentVideoPath: (path: string, proxyPath?: string, audioPath?: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string; proxyPath?: string; audioPath?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getEditorPreferencesSync: () => unknown
    saveEditorPreferences: (preferences: unknown) => Promise<{ success: boolean; preferences?: unknown; error?: string }>
    resetEditorPreferences: () => Promise<{ success: boolean; preferences?: unknown; error?: string }>
    onEditorPreferencesUpdated: (callback: (preferences: unknown) => void) => () => void
    generateProxyVideo: (inputPath: string) => Promise<{ success: boolean, proxyPath?: string, error?: string }>;
    onProxyGenerationProgress: (callback: (percent: number) => void) => () => void;
    saveProject: (videoPath: string, projectData: any) => Promise<{ success: boolean, error?: string, message?: string }>;
    loadProject: (videoPath: string) => Promise<{ success: boolean, project?: any, projectPath?: string, message?: string }>;
  }
}
