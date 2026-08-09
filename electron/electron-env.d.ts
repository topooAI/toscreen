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
    discoverIOSScreenDevices: () => Promise<{ success: boolean; devices: IOSScreenDevice[]; error?: string }>
    startIOSDevicePreview: (deviceId: string) => Promise<{ success: boolean; error?: string }>
    stopIOSDevicePreview: () => Promise<{ success: boolean }>
    startIOSDeviceRecording: (deviceId: string) => Promise<{ success: boolean; outputPath?: string; audioSupport?: string; error?: string }>
    stopIOSDeviceRecording: () => Promise<{ success: boolean; outputPath?: string; error?: string }>
    cancelIOSDeviceRecording: () => Promise<{ success: boolean }>
    onIOSDeviceState: (callback: (event: unknown) => void) => () => void
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    showRecorder: () => Promise<void>
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
    exportGif: (id: string, videoData: ArrayBuffer, options: { startMs: number; endMs: number; width: number; fps: number; loop: number }) => Promise<{ success?: boolean; cancelled?: boolean; path?: string; size?: number }>
    cancelGif: (id: string) => Promise<{ success: boolean }>
    listSavedProjects:()=>Promise<Array<{path:string;id:string;name:string;updatedAt?:string}>>
    loadSavedProject:(path:string)=>Promise<any>
    chooseBatchOutputDirectory:()=>Promise<string|null>
    saveBatchOutput:(data:ArrayBuffer,outputPath:string)=>Promise<{success:boolean;path:string}>
    encodeGifToPath:(id:string,data:ArrayBuffer,options:unknown,outputPath:string)=>Promise<any>
    onGifProgress: (callback: (value: { id: string; percentage: number }) => void) => () => void
    extractOriginals: (sources: Array<{ kind: string; path?: string | null; required?: boolean; classification?: 'original'|'sidecar'|'proxy' }>, manifest: unknown,originalPath?:string|null) => Promise<any>
    openLocalPath: (target: string) => Promise<string>
    topooSession: () => Promise<any>
    topooSignIn: () => Promise<any>
    topooSignOut: () => Promise<any>
    onTopooSessionChanged: (callback: () => void) => () => void
    quickShare: (id:string,filePath: string, input: unknown) => Promise<any>
    cancelQuickShare:(id:string)=>Promise<{success:boolean}>
    onQuickShareProgress:(callback:(value:{id:string;percentage:number})=>void)=>()=>void
    shareApi:(serviceUrl:string,method:string,path:string,body?:unknown)=>Promise<any>
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
    saveProject: (videoPath: string, projectData: any) => Promise<{ success: boolean; projectPath?: string; error?: string; message?: string }>;
    loadProject: (videoPath: string) => Promise<{ success: boolean; project?: any; projectPath?: string; message?: string }>;
    transcribeAudio: (input: { paths: string[]; language: string }) => Promise<{ success: boolean; segments?: Array<{ startMs: number; endMs: number; text: string }>; error?: string; cancelled?: boolean }>
    cancelTranscription: () => Promise<boolean>
    openDictationSettings: () => Promise<boolean>
    onTranscriptionProgress: (callback: (event: unknown) => void) => () => void
    saveProjectAs: (projectData: unknown) => Promise<any>;
    getCurrentProject: () => Promise<{ projectPath: string | null }>;
    newProject: () => Promise<{ success: boolean }>;
    listRecentProjects: () => Promise<any>;
    getProjectCoverEditor: (projectPath: string) => Promise<any>;
    setProjectCover: (projectPath: string, input: { timeMs: number; focus: { x: number; y: number } }) => Promise<any>;
    resetProjectCover: (projectPath: string) => Promise<any>;
    onProjectCoversUpdated: (callback: () => void) => () => void;
    openProject: (projectPath: string) => Promise<any>;
    removeRecentProject: (projectPath: string) => Promise<any>;
    deleteProject: (projectPath: string, deleteAssets?: boolean) => Promise<any>;
    relinkProjectAsset: (projectPath: string, missingPath: string) => Promise<any>;
    exportProjectPackage: (projectPath?: string) => Promise<any>;
    importProjectPackage: () => Promise<any>;
    listPresets: () => Promise<any>;
    savePreset: (name: string, project: unknown, presetId?: string) => Promise<any>;
    deletePreset: (presetId: string) => Promise<any>;
    setDefaultPreset: (presetId?: string) => Promise<any>;
    applyPreset: (project: unknown, presetId: string) => Promise<any>;
    exportPreset: (presetId: string) => Promise<any>;
    importPreset: () => Promise<any>;
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
interface IOSScreenDevice { id: string; name: string; connected: boolean; suspended: boolean; inUse: boolean; transportType: number; audioSupport: string }

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
