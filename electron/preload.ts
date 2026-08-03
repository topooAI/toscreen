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
  getSources: async (opts: Electron.SourcesOptions) => {
    return await ipcRenderer.invoke('get-sources', opts)
  },
  switchToEditor: () => {
    return ipcRenderer.invoke('switch-to-editor')
  },
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
  onProxyGenerationProgress: (callback: (percent: number) => void) => {
    const listener = (_event: any, percent: number) => callback(percent)
    ipcRenderer.on('proxy-generation-progress', listener)
    return () => ipcRenderer.removeListener('proxy-generation-progress', listener)
  }
  ,transcribeAudio: (input: { paths: string[]; language: string }) => ipcRenderer.invoke('transcription-start', input),
  cancelTranscription: () => ipcRenderer.invoke('transcription-cancel'),
  onTranscriptionProgress: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value)
    ipcRenderer.on('transcription-progress', listener)
    return () => ipcRenderer.removeListener('transcription-progress', listener)
  }
})
