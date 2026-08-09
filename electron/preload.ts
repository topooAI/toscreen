import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  hudOverlayHide: () => {
    ipcRenderer.send('hud-overlay-hide');
  },
  hudOverlayClose: () => {
    ipcRenderer.send('hud-overlay-close');
  },
  getAssetBasePath: async () => {
    // ask main process for the correct base path (production vs dev)
    return await ipcRenderer.invoke('get-asset-base-path')
  },
  resolveBundledMusic: (fileName: string) => ipcRenderer.invoke('resolve-bundled-music', fileName),
  listBundledMusic: () => ipcRenderer.invoke('list-bundled-music'),
  discoverIOSScreenDevices: () => ipcRenderer.invoke('ios-device-discover'),
  startIOSDevicePreview: (deviceId: string) => ipcRenderer.invoke('ios-device-preview-start', deviceId),
  stopIOSDevicePreview: () => ipcRenderer.invoke('ios-device-preview-stop'),
  startIOSDeviceRecording: (deviceId: string) => ipcRenderer.invoke('ios-device-recording-start', deviceId),
  stopIOSDeviceRecording: () => ipcRenderer.invoke('ios-device-recording-stop'),
  cancelIOSDeviceRecording: () => ipcRenderer.invoke('ios-device-recording-cancel'),
  onIOSDeviceState: (callback: (event: unknown) => void) => { const listener=(_:Electron.IpcRendererEvent,event:unknown)=>callback(event); ipcRenderer.on('ios-device-state',listener); return ()=>ipcRenderer.removeListener('ios-device-state',listener) },
  getSources: async (opts: Electron.SourcesOptions) => {
    return await ipcRenderer.invoke('get-sources', opts)
  },
  switchToEditor: () => {
    return ipcRenderer.invoke('switch-to-editor')
  },
  showRecorder: () => ipcRenderer.invoke('show-recorder'),
  openSourceSelector: () => {
    return ipcRenderer.invoke('open-source-selector')
  },
  selectSource: (source: any) => {
    return ipcRenderer.invoke('select-source', source)
  },
  getSelectedSource: () => {
    return ipcRenderer.invoke('get-selected-source')
  },
  getDisplayBounds: (displayId: string) => ipcRenderer.invoke('get-display-bounds', displayId),

  storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
    return ipcRenderer.invoke('store-recorded-video', videoData, fileName)
  },
  storeRecordedAudio: (audioData: ArrayBuffer, fileName: string) => ipcRenderer.invoke('store-recorded-audio', audioData, fileName),

  getRecordedVideoPath: () => {
    return ipcRenderer.invoke('get-recorded-video-path')
  },
  setRecordingState: (recording: boolean, videoStartTime?: number) => {
    return ipcRenderer.invoke('set-recording-state', recording, videoStartTime)
  },
  onStopRecordingFromTray: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('stop-recording-from-tray', listener)
    return () => ipcRenderer.removeListener('stop-recording-from-tray', listener)
  },
  openExternalUrl: (url: string) => {
    return ipcRenderer.invoke('open-external-url', url)
  },
  saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
    return ipcRenderer.invoke('save-exported-video', videoData, fileName)
  },
  openVideoFilePicker: () => {
    return ipcRenderer.invoke('open-video-file-picker')
  },
  setCurrentVideoPath: (path: string, proxyPath?: string, audioPath?: string, cameraPath?: string, microphonePath?: string) => {
    return ipcRenderer.invoke('set-current-video-path', path, proxyPath, audioPath, cameraPath, microphonePath)
  },
  getCurrentVideoPath: () => {
    return ipcRenderer.invoke('get-current-video-path')
  },
  clearCurrentVideoPath: () => {
    return ipcRenderer.invoke('clear-current-video-path')
  },
  getPlatform: () => {
    return ipcRenderer.invoke('get-platform')
  },
  exportGif: (id: string, videoData: ArrayBuffer, options: unknown) => ipcRenderer.invoke('export-gif', id, videoData, options),
  cancelGif: (id: string) => ipcRenderer.invoke('cancel-gif', id),
  listSavedProjects:()=>ipcRenderer.invoke('list-saved-projects'),
  loadSavedProject:(path:string)=>ipcRenderer.invoke('load-saved-project',path),
  chooseBatchOutputDirectory:()=>ipcRenderer.invoke('choose-batch-output-directory'),
  saveBatchOutput:(data:ArrayBuffer,outputPath:string)=>ipcRenderer.invoke('save-batch-output',data,outputPath),
  encodeGifToPath:(id:string,data:ArrayBuffer,options:unknown,outputPath:string)=>ipcRenderer.invoke('encode-gif-to-path',id,data,options,outputPath),
  onGifProgress: (callback: (value: { id: string; percentage: number }) => void) => { const listener = (_: unknown, value: { id: string; percentage: number }) => callback(value); ipcRenderer.on('export-gif-progress', listener); return () => ipcRenderer.removeListener('export-gif-progress', listener); },
  extractOriginals: (sources: unknown[], manifest: unknown, originalPath?:string) => ipcRenderer.invoke('extract-originals', sources, manifest, originalPath),
  openLocalPath: (target: string) => ipcRenderer.invoke('open-local-path', target),
  topooSession: () => ipcRenderer.invoke('topoo-session'),
  topooSignIn: () => ipcRenderer.invoke('topoo-sign-in'),
  topooSignOut: () => ipcRenderer.invoke('topoo-sign-out'),
  onTopooSessionChanged: (callback: () => void) => { const listener = () => callback(); ipcRenderer.on('topoo-session-changed', listener); return () => ipcRenderer.removeListener('topoo-session-changed', listener); },
  quickShare: (id: string, filePath: string, input: unknown) => ipcRenderer.invoke('quick-share', id, filePath, input),
  cancelQuickShare: (id:string) => ipcRenderer.invoke('cancel-quick-share',id),
  onQuickShareProgress: (callback:(value:{id:string;percentage:number})=>void) => { const listener=(_:unknown,value:{id:string;percentage:number})=>callback(value); ipcRenderer.on('quick-share-progress',listener); return()=>ipcRenderer.removeListener('quick-share-progress',listener); },
  shareApi:(serviceUrl:string,method:string,path:string,body?:unknown)=>ipcRenderer.invoke('share-api',serviceUrl,method,path,body),
  getEditorPreferencesSync: () => {
    return ipcRenderer.sendSync('get-editor-preferences-sync')
  },
  saveEditorPreferences: (preferences: unknown) => {
    return ipcRenderer.invoke('save-editor-preferences', preferences)
  },
  resetEditorPreferences: () => {
    return ipcRenderer.invoke('reset-editor-preferences')
  },
  onEditorPreferencesUpdated: (callback: (preferences: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, preferences: unknown) => callback(preferences)
    ipcRenderer.on('editor-preferences-updated', listener)
    return () => ipcRenderer.removeListener('editor-preferences-updated', listener)
  },
  // Mouse Tracker APIs
  recordMouseClick: (x: number, y: number) => {
    return ipcRenderer.invoke('record-mouse-click', x, y)
  },
  getMouseTrackingStatus: () => {
    return ipcRenderer.invoke('get-mouse-tracking-status')
  },
  readClicksJson: (videoPath: string) => {
    return ipcRenderer.invoke('read-clicks-json', videoPath)
  },
  isNativeRecordingAvailable: () => {
    return ipcRenderer.invoke('is-native-recording-available')
  },
  startNativeRecording: (options?: unknown) => {
    return ipcRenderer.invoke('start-native-recording', options)
  },
  stopNativeRecording: () => {
    return ipcRenderer.invoke('stop-native-recording')
  },
  pauseNativeRecording: () => ipcRenderer.invoke('pause-native-recording'),
  resumeNativeRecording: () => ipcRenderer.invoke('resume-native-recording'),
  discardRecordingArtifacts: (paths: Array<string | undefined>) => ipcRenderer.invoke('discard-recording-artifacts', paths),
  getRecordingPermissions: () => ipcRenderer.invoke('get-recording-permissions'),
  requestRecordingPermission: (kind: 'microphone' | 'camera') => ipcRenderer.invoke('request-recording-permission', kind),
  openRecordingPermissionSettings: (kind: 'screen' | 'microphone' | 'camera') => ipcRenderer.invoke('open-recording-permission-settings', kind),
  generateProxyVideo: (inputPath: string) => {
    return ipcRenderer.invoke('generate-proxy-video', inputPath)
  },
  saveProject: (videoPath: string, projectData: any) => {
    return ipcRenderer.invoke('save-project', videoPath, projectData)
  },
  loadProject: (videoPath: string) => {
    return ipcRenderer.invoke('load-project', videoPath)
  },
  saveProjectAs: (projectData: unknown) => ipcRenderer.invoke('project-save-as', projectData),
  getCurrentProject: () => ipcRenderer.invoke('project-get-current'),
  newProject: () => ipcRenderer.invoke('project-new'),
  listRecentProjects: () => ipcRenderer.invoke('project-list-recent'),
  getProjectCoverEditor: (projectPath: string) => ipcRenderer.invoke('project-get-cover-editor', projectPath),
  setProjectCover: (projectPath: string, input: { timeMs: number; frameScale: number; focus: { x: number; y: number } }) => ipcRenderer.invoke('project-set-cover', projectPath, input),
  resetProjectCover: (projectPath: string) => ipcRenderer.invoke('project-reset-cover', projectPath),
  onProjectCoversUpdated: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('project-covers-updated', listener)
    return () => ipcRenderer.removeListener('project-covers-updated', listener)
  },
  openProject: (projectPath: string) => ipcRenderer.invoke('project-open', projectPath),
  removeRecentProject: (projectPath: string) => ipcRenderer.invoke('project-remove-recent', projectPath),
  deleteProject: (projectPath: string, deleteAssets?: boolean) => ipcRenderer.invoke('project-delete', projectPath, deleteAssets),
  relinkProjectAsset: (projectPath: string, missingPath: string) => ipcRenderer.invoke('project-relink', projectPath, missingPath),
  exportProjectPackage: (projectPath?: string) => ipcRenderer.invoke('project-export-package', projectPath),
  importProjectPackage: () => ipcRenderer.invoke('project-import-package'),
  listPresets: () => ipcRenderer.invoke('preset-list'),
  savePreset: (name: string, project: unknown, presetId?: string) => ipcRenderer.invoke('preset-save', name, project, presetId),
  deletePreset: (presetId: string) => ipcRenderer.invoke('preset-delete', presetId),
  setDefaultPreset: (presetId?: string) => ipcRenderer.invoke('preset-set-default', presetId),
  applyPreset: (project: unknown, presetId: string) => ipcRenderer.invoke('preset-apply', project, presetId),
  exportPreset: (presetId: string) => ipcRenderer.invoke('preset-export', presetId),
  importPreset: () => ipcRenderer.invoke('preset-import'),
  onProxyGenerationProgress: (callback: (percent: number) => void) => {
    const listener = (_event: any, percent: number) => callback(percent)
    ipcRenderer.on('proxy-generation-progress', listener)
    return () => ipcRenderer.removeListener('proxy-generation-progress', listener)
  }
  ,transcribeAudio: (input: { paths: string[]; language: string }) => ipcRenderer.invoke('transcription-start', input),
  cancelTranscription: () => ipcRenderer.invoke('transcription-cancel'),
  openDictationSettings: () => ipcRenderer.invoke('transcription-open-dictation-settings'),
  onTranscriptionProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value)
    ipcRenderer.on('transcription-progress', listener)
    return () => ipcRenderer.removeListener('transcription-progress', listener)
  }
})
