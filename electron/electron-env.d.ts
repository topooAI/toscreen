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
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
    getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; message?: string }>
    setRecordingState: (recording: boolean, videoStartTime?: number) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string; cancelled?: boolean }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; message?: string }>
    setCurrentVideoPath: (path: string, proxyPath?: string, audioPath?: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string; proxyPath?: string; audioPath?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    // Mouse Tracker APIs
    recordMouseClick: (x: number, y: number) => Promise<{ success: boolean }>
    getMouseTrackingStatus: () => Promise<{ isTracking: boolean; eventCount: number }>
    readClicksJson: (videoPath: string) => Promise<{ success: boolean; clicks?: any[] }>;
    isNativeRecordingAvailable: () => Promise<boolean>;
    startNativeRecording: () => Promise<{ success: boolean; outputPath?: string; error?: string }>;
    stopNativeRecording: () => Promise<{ success: boolean; outputPath?: string; audioOutputPath?: string; error?: string }>;
    hudOverlayHide: () => void;
    hudOverlayClose: () => void;
    generateProxyVideo: (inputPath: string) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
    onProxyGenerationProgress: (callback: (percent: number) => void) => () => void;
    saveProject: (videoPath: string, projectData: any) => Promise<{ success: boolean; error?: string; message?: string }>;
    loadProject: (videoPath: string) => Promise<{ success: boolean; project?: any; message?: string }>;
  }
}

interface ProcessedDesktopSource {
  id: string
  name: string
  display_id: string
  thumbnail: string | null
  appIcon: string | null
}
