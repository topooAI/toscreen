/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    resolveBundledMusic: (fileName: string) => Promise<{ success: boolean; url?: string; error?: string }>
    listBundledMusic: () => Promise<{ success: boolean; manifest?: { tracks: Array<any> }; error?: string }>
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    getDisplayBounds: (displayId: string) => Promise<{ x: number; y: number; width: number; height: number }>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
    storeRecordedAudio: (audioData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string }>
    getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; proxyPath?: string; audioPath?: string; microphonePath?: string; cameraPath?: string; message?: string }>
    setRecordingState: (recording: boolean, videoStartTime?: number) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string; cancelled?: boolean }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; message?: string }>
    setCurrentVideoPath: (path: string, proxyPath?: string, audioPath?: string, cameraPath?: string, microphonePath?: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string; proxyPath?: string; audioPath?: string; cameraPath?: string; microphonePath?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    getEditorPreferencesSync: () => unknown
    saveEditorPreferences: (preferences: unknown) => Promise<{ success: boolean; preferences?: unknown; error?: string }>
    resetEditorPreferences: () => Promise<{ success: boolean; preferences?: unknown; error?: string }>
    onEditorPreferencesUpdated: (callback: (preferences: unknown) => void) => () => void
    // Mouse Tracker APIs
    recordMouseClick: (x: number, y: number) => Promise<{ success: boolean }>
    getMouseTrackingStatus: () => Promise<{ isTracking: boolean; eventCount: number }>
    readClicksJson: (videoPath: string) => Promise<{ success: boolean; clicks?: any[] }>;
    isNativeRecordingAvailable: () => Promise<boolean>;
    startNativeRecording: (options?: RecordingOptions) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
    stopNativeRecording: () => Promise<{ success: boolean; outputPath?: string; audioOutputPath?: string; cameraOutputPath?: string; error?: string }>;
    pauseNativeRecording: () => Promise<{ success: boolean; error?: string }>;
    resumeNativeRecording: () => Promise<{ success: boolean; error?: string }>;
    discardRecordingArtifacts: (paths: Array<string | undefined>) => Promise<{ success: boolean }>;
    getRecordingPermissions: () => Promise<RecordingPermissions>;
    requestRecordingPermission: (kind: 'microphone' | 'camera') => Promise<boolean>;
    openRecordingPermissionSettings: (kind: 'screen' | 'microphone' | 'camera') => Promise<{ success: boolean }>;
    hudOverlayHide: () => void;
    hudOverlayClose: () => void;
    generateProxyVideo: (inputPath: string) => Promise<{ success: boolean; proxyPath?: string; error?: string }>;
    onProxyGenerationProgress: (callback: (percent: number) => void) => () => void;
    saveProject: (videoPath: string, projectData: any) => Promise<{ success: boolean; error?: string; message?: string }>;
    loadProject: (videoPath: string) => Promise<{ success: boolean; project?: any; projectPath?: string; message?: string }>;
    transcribeAudio: (input: { paths: string[]; language: string }) => Promise<{ success: boolean; segments?: Array<{ startMs: number; endMs: number; text: string }>; error?: string; cancelled?: boolean }>
    cancelTranscription: () => Promise<boolean>
    onTranscriptionProgress: (callback: (event: unknown) => void) => () => void
  }
}

interface RecordingOptions {
  includeMicrophone?: boolean
  includeSystemAudio?: boolean
  audioDeviceId?: string
  captureCamera?: boolean
  cameraDeviceId?: string
  captureArea?: { x: number; y: number; width: number; height: number }
}

interface RecordingPermissions {
  screen: string
  microphone: string
  camera: string
}

interface ProcessedDesktopSource {
  id: string
  name: string
  display_id: string
  thumbnail: string | null
  appIcon: string | null
}
