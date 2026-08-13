import { ipcMain, desktopCapturer, BrowserWindow, shell, app, dialog, screen, systemPreferences } from 'electron'

import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'
import { mouseTracker } from '../mouseTracker'
import { mergeSegmentEvents } from '../recordingTimeline'
import { beginTopooSignIn, chooseGifPath, clearTopooToken, completeTopooSignIn, encodeGif, extractOriginals, fetchTopooSession, openLocalPath, quickShare,shareApi } from '../exportShareServices'

import {
  isNativeRecordingAvailable,
  startNativeRecording,
  stopNativeRecording,
  pauseNativeRecording,
  resumeNativeRecording,
} from '../nativeRecorder'

import { generateProxyVideo } from './proxyGenerator'
import {
  generateProjectCover,
  generateProjectCoverAtTime,
  projectCoverExists,
  resolveProjectCoverCandidate,
} from '../projectCover'
import {
  mergeCursorShapeTelemetry,
  normalizeNativeCursorEvents,
  rebaseCursorEventsToTimeline,
  resolveCursorTimelineStart,
  selectNativeCursorSidecar,
} from '../cursorTelemetry'
import {
  companionAudioPathCandidatesForMediaPath,
  normalizeMediaPath,
  projectPathCandidatesForMediaPath,
  projectPathForMediaPath,
} from './projectFiles'
import {
  PACKAGE_EXTENSION,
  PRESET_EXTENSION,
  PROJECT_EXTENSION,
  applyPreset,
  atomicWriteJson,
  createPortablePackage,
  createPreset,
  importPortablePackage,
  inspectProjectAssets,
  readRecentIndex,
  readJsonWithBackup,
  resolveProjectCoverInteractionFocus,
  validatePreset,
  writeRecentIndex,
  type RecentProjectEntry,
  type ToScreenPreset,
  transitionProjectDocument,
  hydrateCurrentProjectMedia,
} from '../projectLibrary'
import { getProjectCoverMaxFrameScale } from '../../src/components/projects/projectCoverScale'

let selectedSource: any = null
let activeRecordingBounds: { x: number; y: number; width: number; height: number } | undefined
let cursorSegments: Array<{ events: any[]; videoStartTime: number; durationMs: number }> = []

async function nativeCursorPathForMediaPath(mediaPath: string): Promise<string | null> {
  const parsed = path.parse(mediaPath)
  const timestamp = parsed.name.match(/(?:^|[-_])(\d{13})$/)?.[1]
  if (!timestamp) return null

  try {
    const fileNames = await fs.readdir(parsed.dir)
    const selected = selectNativeCursorSidecar(Number(timestamp), fileNames)
    return selected ? path.join(parsed.dir, selected) : null
  } catch {
    return null
  }
}

function hasPreciseEventClock(events: any[]): boolean {
  return events.some(event => Number.isFinite(Number(event?.nativeTimeMs)))
}

export async function getSelectedSourceForMediaRequest() {
  if (!selectedSource) return null;
  const types = selectedSource.id.startsWith('screen') ? ['screen'] : ['window'];
  try {
    const sources = await desktopCapturer.getSources({ types: types as any });
    const matched = sources.find(s => s.id === selectedSource.id);
    if (matched) return matched;
    return sources[0] || null;
  } catch (err) {
    console.error('[IPC] Failed to query raw media source:', err);
    return null;
  }
}

export function registerIpcHandlers(
  createEditorWindow: () => void,
  createSourceSelectorWindow: () => BrowserWindow,
  getMainWindow: () => BrowserWindow | null,
  getSourceSelectorWindow: () => BrowserWindow | null,
  onRecordingStateChange?: (recording: boolean, sourceName: string) => void
) {
  const libraryDir = path.join(app.getPath('userData'), 'project-library')
  const recentIndexPath = path.join(libraryDir, 'recent-projects.json')
  const projectCoverDirectory = path.join(libraryDir, 'covers')
  const presetIndexPath = path.join(libraryDir, 'presets.json')
  let currentProjectPath: string | null = null
  let currentVideoPath: string | null = null
  let currentProxyPath: string | null = null
  let currentAudioPath: string | null = null
  let currentCameraPath: string | null = null
  let currentMicrophonePath: string | null = null

  const clearCurrentProjectMedia = () => {
    currentVideoPath = null
    currentProxyPath = null
    currentAudioPath = null
    currentCameraPath = null
    currentMicrophonePath = null
  }
  const hydrateMedia = (project: unknown) => {
    const media = hydrateCurrentProjectMedia(project)
    currentVideoPath = media.videoPath
    currentProxyPath = media.proxyPath
    currentAudioPath = media.audioPath
    currentCameraPath = media.cameraPath
    currentMicrophonePath = media.microphonePath
    return media
  }

  const rememberProject = async (projectPath: string, project: any): Promise<RecentProjectEntry> => {
    const assets = await inspectProjectAssets(project)
    const recent = await readRecentIndex(recentIndexPath)
    const existing = recent.find(item => item.projectPath === projectPath)
    const entry: RecentProjectEntry = {
      id: String(project?.projectModel?.id || project?.id || projectPath),
      name: String(project?.projectModel?.name || project?.name || path.basename(projectPath, path.extname(projectPath))),
      projectPath,
      thumbnailPath: project?.thumbnailPath || existing?.thumbnailPath,
      thumbnailSourceSignature: existing?.thumbnailSourceSignature,
      thumbnailSourceWidth: existing?.thumbnailSourceWidth,
      thumbnailSourceHeight: existing?.thumbnailSourceHeight,
      thumbnailMode: existing?.thumbnailMode,
      thumbnailTimeMs: existing?.thumbnailTimeMs,
      thumbnailFrameScale: existing?.thumbnailMode === 'custom' ? existing.thumbnailFrameScale : undefined,
      thumbnailFocus: existing?.thumbnailMode === 'custom' ? existing.thumbnailFocus : undefined,
      updatedAt: String(project?.projectModel?.updatedAt || project?.updatedAt || new Date().toISOString()),
      durationMs: Number(project?.projectModel?.durationMs || project?.durationMs || 0),
      assetStatus: assets.missing.length ? 'missing' : 'ready',
      missingAssets: assets.missing,
    }
    await writeRecentIndex(recentIndexPath, [entry, ...recent.filter(item => item.projectPath !== projectPath)].slice(0, 100))
    return entry
  }
  const pendingProjectCovers = new Set<string>()
  const scheduleProjectCover = (entry: RecentProjectEntry, project: unknown) => {
    if (pendingProjectCovers.has(entry.projectPath)) return
    pendingProjectCovers.add(entry.projectPath)
    void (async () => {
      try {
        const candidate = await resolveProjectCoverCandidate(project, projectCoverDirectory)
        if (!candidate) return
        const isCustom = entry.thumbnailMode === 'custom'
        const framing = {
          frameScale: isCustom ? entry.thumbnailFrameScale : 1,
          focus: entry.thumbnailFocus || resolveProjectCoverInteractionFocus(project) || { x: 50, y: 46 },
        }
        const coverPath = isCustom
          ? await generateProjectCoverAtTime(candidate, Number(entry.thumbnailTimeMs || 0), framing)
          : await generateProjectCover(candidate, framing)
        if (!coverPath) return
        const recent = await readRecentIndex(recentIndexPath)
        const next = recent.map(item => item.projectPath === entry.projectPath
          ? {
              ...item,
              thumbnailPath: coverPath,
              thumbnailSourceSignature: candidate.sourceSignature,
              thumbnailSourceWidth: candidate.sourceWidth,
              thumbnailSourceHeight: candidate.sourceHeight,
              thumbnailMode: isCustom ? 'custom' as const : 'auto' as const,
              thumbnailTimeMs: isCustom ? entry.thumbnailTimeMs : undefined,
              thumbnailFrameScale: isCustom ? entry.thumbnailFrameScale : undefined,
              thumbnailFocus: isCustom ? entry.thumbnailFocus : undefined,
            }
          : item)
        await writeRecentIndex(recentIndexPath, next)
        BrowserWindow.getAllWindows().forEach(window => window.webContents.send('project-covers-updated'))
      } finally {
        pendingProjectCovers.delete(entry.projectPath)
      }
    })()
  }
  const gifControllers = new Map<string, AbortController>();
  const shareControllers = new Map<string, AbortController>();
  // Try to auto-select the primary screen
  (async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      if (sources.length > 0) {
        selectedSource = {
          id: sources[0].id,
          name: sources[0].name,
          display_id: sources[0].display_id,
          thumbnail: sources[0].thumbnail.toDataURL(),
          appIcon: sources[0].appIcon ? sources[0].appIcon.toDataURL() : null
        }
        console.log('[IPC] Auto-selected source:', selectedSource.name)
      }
    } catch (err) {
      console.error('[IPC] Failed to auto-select source:', err)
    }
  })()

  ipcMain.handle('get-sources', async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts)
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }))
  })

  ipcMain.handle('export-gif', async (event, id: string, videoData: ArrayBuffer, options) => {
    const outputPath = await chooseGifPath(`toscreen-${Date.now()}.gif`); if (!outputPath) return { cancelled: true };
    const controller = new AbortController(); gifControllers.set(id, controller);
    try { return await encodeGif(videoData, options, outputPath, percentage => event.sender.send('export-gif-progress', { id, percentage }), controller.signal); }
    finally { gifControllers.delete(id); }
  });
  ipcMain.handle('cancel-gif', (_, id: string) => { gifControllers.get(id)?.abort(); return { success: true }; });
  ipcMain.handle('list-saved-projects',async()=>{const names=(await fs.readdir(RECORDINGS_DIR)).filter(name=>name.endsWith('.project.json'));return Promise.all(names.map(async name=>{const filePath=path.join(RECORDINGS_DIR,name);try{const raw=JSON.parse(await fs.readFile(filePath,'utf8'));return{path:filePath,id:raw.projectModel?.id??filePath,name:raw.projectModel?.name??name,updatedAt:raw.projectModel?.updatedAt};}catch{return null;}})).then(items=>items.filter(Boolean));});
  ipcMain.handle('load-saved-project',async(_,filePath:string)=>JSON.parse(await fs.readFile(filePath,'utf8')));
  ipcMain.handle('choose-batch-output-directory',async()=>{const result=await dialog.showOpenDialog({properties:['openDirectory','createDirectory']});return result.canceled?null:result.filePaths[0];});
  ipcMain.handle('save-batch-output',async(_,data:ArrayBuffer,outputPath:string)=>{await fs.mkdir(path.dirname(outputPath),{recursive:true});await fs.writeFile(outputPath,Buffer.from(data));return{success:true,path:outputPath};});
  ipcMain.handle('encode-gif-to-path',async(event,id:string,data:ArrayBuffer,options,outputPath:string)=>{const controller=new AbortController();gifControllers.set(id,controller);try{return await encodeGif(data,options,outputPath,percentage=>event.sender.send('export-gif-progress',{id,percentage}),controller.signal);}finally{gifControllers.delete(id);}});
  ipcMain.handle('extract-originals', async (_, sources, manifest, originalPath?:string) => {const controlled=[...sources];if(originalPath){controlled.push({kind:'raw-cursor-sidecar',path:await nativeCursorPathForMediaPath(originalPath),classification:'sidecar'});controlled.push({kind:'raw-click-sidecar',path:`${originalPath}.clicks.json`,classification:'sidecar'});controlled.push({kind:'project-sidecar',path:projectPathForMediaPath(originalPath),required:true,classification:'sidecar'});}return extractOriginals(controlled, manifest);});
  ipcMain.handle('open-local-path', (_, target: string) => openLocalPath(target));
  ipcMain.handle('topoo-session', () => fetchTopooSession());
  ipcMain.handle('topoo-sign-in', async (event) => { const started=await beginTopooSignIn();await shell.openExternal(started.authorizeUrl);const session=await completeTopooSignIn(started);if(!event.sender.isDestroyed())event.sender.send('topoo-session-changed');return session; });
  ipcMain.handle('topoo-sign-out', async () => { await clearTopooToken(); return { state: 'signed-out' }; });
  ipcMain.handle('quick-share', async (event, id:string,filePath:string,input) => {const controller=new AbortController();shareControllers.set(id,controller);try{return await quickShare(filePath,{...input,onProgress:(percentage:number)=>event.sender.send('quick-share-progress',{id,percentage})},controller.signal);}finally{shareControllers.delete(id);}});
  ipcMain.handle('cancel-quick-share',(_,id:string)=>{shareControllers.get(id)?.abort();return{success:true};});
  ipcMain.handle('share-api',(_,serviceUrl:string,method:string,apiPath:string,body?:unknown)=>shareApi(serviceUrl,method,apiPath,body));

  ipcMain.handle('select-source', (_, source) => {
    selectedSource = source
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.close()
    }
    return selectedSource
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('get-display-bounds', (_, displayId: string) => {
    const display = screen.getAllDisplays().find(item => String(item.id) === String(displayId)) || screen.getPrimaryDisplay()
    return display.bounds
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })

  ipcMain.handle('switch-to-editor', () => {
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.close()
    }
    createEditorWindow()
  })



  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      currentVideoPath = videoPath;

      // Also try to rename/move the temp-clicks.json to match this video
      // stored as: [filename].clicks.json
      const tempClicksPath = path.join(RECORDINGS_DIR, 'temp-clicks.json');
      const clicksPath = videoPath + '.clicks.json'; // e.g. recording-123.webm.clicks.json

      try {
        await fs.access(tempClicksPath);
        await fs.rename(tempClicksPath, clicksPath);
        console.log(`[IPC] Associated clicks data with video: ${clicksPath}`);
      } catch (e) {
        // No clicks file found, or error moving it - maybe recording didn't have clicks or tracking disabled
        console.log('[IPC] No temp clicks file to associate or failed to move');
      }

      return {
        success: true,
        path: videoPath,
        message: 'Video stored successfully'
      }
    } catch (error) {
      console.error('Failed to store video:', error)
      return {
        success: false,
        message: 'Failed to store video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('store-recorded-audio', async (_, audioData: ArrayBuffer, fileName: string) => {
    const audioPath = path.join(RECORDINGS_DIR, path.basename(fileName))
    await fs.writeFile(audioPath, Buffer.from(audioData))
    return { success: true, path: audioPath }
  })



  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const videoFiles = files.filter(file => (
        file.startsWith('recording-') &&
        (file.endsWith('.webm') || file.endsWith('.mov'))
      ))

      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }

      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(RECORDINGS_DIR, latestVideo)
      const proxyResult = await generateProxyVideo(videoPath)
      const audioPath = await findFirstExistingPath(companionAudioPathCandidatesForMediaPath(videoPath))
      const parsed = path.parse(videoPath)
      const microphonePath = await findFirstExistingPath([path.join(parsed.dir, `${parsed.name}-microphone.webm`)])
      const cameraPath = await findFirstExistingPath([path.join(parsed.dir, `${parsed.name}-camera.mov`), path.join(parsed.dir, `${parsed.name}-camera.webm`)])

      return {
        success: true,
        path: videoPath,
        proxyPath: proxyResult.success ? proxyResult.proxyPath : undefined,
        audioPath,
        microphonePath,
        cameraPath,
      }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('is-native-recording-available', () => {
    return isNativeRecordingAvailable()
  })

  ipcMain.handle('get-recording-permissions', async () => {
    const mediaStatus = (kind: 'microphone' | 'camera') => process.platform === 'darwin'
      ? systemPreferences.getMediaAccessStatus(kind)
      : 'granted'
    let screenStatus = 'granted'
    if (process.platform === 'darwin') {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
        if (sources.length === 0) screenStatus = 'denied'
      } catch {
        screenStatus = 'denied'
      }
    }
    return { screen: screenStatus, microphone: mediaStatus('microphone'), camera: mediaStatus('camera') }
  })

  ipcMain.handle('request-recording-permission', async (_, kind: 'microphone' | 'camera') => {
    if (process.platform !== 'darwin') return true
    return systemPreferences.askForMediaAccess(kind)
  })

  ipcMain.handle('open-recording-permission-settings', async (_, kind: 'screen' | 'microphone' | 'camera') => {
    const pane = kind === 'screen' ? 'Privacy_ScreenCapture' : kind === 'microphone' ? 'Privacy_Microphone' : 'Privacy_Camera'
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
    return { success: true }
  })

  ipcMain.handle('start-native-recording', async (_, options?: {
    includeMicrophone?: boolean
    includeSystemAudio?: boolean
    audioDeviceId?: string
    captureCamera?: boolean
    cameraDeviceId?: string
    captureArea?: { x: number; y: number; width: number; height: number }
  }) => {
    currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'new' })
    clearCurrentProjectMedia()
    const isAvailable = isNativeRecordingAvailable()
    if (!isAvailable) {
      return { success: false, error: 'Native recording is not available on this platform.' }
    }

    let recordingBounds = undefined
    let displayId = undefined
    let windowId = undefined
    if (selectedSource && selectedSource.id.startsWith('screen')) {
      try {
        const displays = screen.getAllDisplays()
        const matchedDisplay = displays.find(d => d.id.toString() === selectedSource.display_id?.toString())
        if (matchedDisplay) {
          recordingBounds = {
            x: matchedDisplay.bounds.x,
            y: matchedDisplay.bounds.y,
            width: matchedDisplay.bounds.width,
            height: matchedDisplay.bounds.height
          }
          displayId = Number(matchedDisplay.id)
        }
      } catch (err) {
        console.error('[IPC] Failed to resolve recording bounds:', err)
      }
    }

    if (selectedSource?.id?.startsWith('window:')) {
      const parsedWindowId = Number(selectedSource.id.split(':')[1])
      if (Number.isFinite(parsedWindowId)) windowId = parsedWindowId
    }

    if (options?.captureArea) recordingBounds = options.captureArea

    // Start input monitoring first. MouseTracker stores absolute event times;
    // export rebases them to ScreenCaptureKit's actual first encoded frame.
    mouseTracker.start(recordingBounds)
    activeRecordingBounds = recordingBounds
    cursorSegments = []
    const result = await startNativeRecording({
      showCursor: false,
      displayId,
      windowId,
      captureArea: options?.captureArea,
      includeMicrophone: options?.includeMicrophone,
      includeSystemAudio: options?.includeSystemAudio,
      audioDeviceId: options?.audioDeviceId,
      captureCamera: options?.captureCamera,
      cameraDeviceId: options?.cameraDeviceId,
    })
    if (result.success) {
      const mainWin = getMainWindow()
      if (mainWin) {
        mainWin.minimize()
      }

      if (onRecordingStateChange) {
        const sourceName = selectedSource?.name || 'Screen'
        onRecordingStateChange(true, sourceName)
      }
    } else {
      mouseTracker.stop()
    }

    return result
  })

  ipcMain.handle('pause-native-recording', async () => {
    const captured = mouseTracker.stop()
    const result = await pauseNativeRecording()
    if (result.success && result.segment) cursorSegments.push({ events: captured.events, videoStartTime: result.segment.videoStartTime, durationMs: result.segment.durationMs })
    else mouseTracker.start(activeRecordingBounds)
    return result
  })
  ipcMain.handle('resume-native-recording', async () => {
    const result = await resumeNativeRecording()
    if (result.success) mouseTracker.start(activeRecordingBounds)
    return result
  })

  ipcMain.handle('discard-recording-artifacts', async (_, paths: Array<string | undefined>) => {
    const safePaths = paths.filter((candidate): candidate is string => Boolean(candidate))
      .flatMap(candidate => [candidate, `${candidate}.clicks.json`])
      .filter(candidate => path.dirname(candidate) === RECORDINGS_DIR)
    await Promise.all(safePaths.map(candidate => fs.unlink(candidate).catch(() => undefined)))
    currentVideoPath = null
    currentAudioPath = null
    currentCameraPath = null
    currentMicrophonePath = null
    return { success: true }
  })

  ipcMain.handle('stop-native-recording', async () => {
    // Stop input capture at the same user action that stops the video stream.
    // Native finalization can take close to a second and must not extend the
    // cursor timeline beyond the last encoded frame.
    const { events, bounds } = mouseTracker.stop()
    const result = await stopNativeRecording()
    if (result.success && events.length) {
      const lastDuration = result.segmentDurationsMs?.[cursorSegments.length] || 0
      cursorSegments.push({ events, videoStartTime: result.segmentStartTimes?.[cursorSegments.length] || Date.now() - lastDuration, durationMs: lastDuration })
    }

    // Export clicks after the recorder returns its final output path.
    if (result.success && result.outputPath) {
      const mergedEvents = mergeSegmentEvents(cursorSegments, result.videoStartTime || cursorSegments[0]?.videoStartTime || Date.now())
      if (mergedEvents.length > 0) {
        try {
          const clicksPath = result.outputPath + '.clicks.json'
          await mouseTracker.exportToFile(clicksPath, mergedEvents, bounds || activeRecordingBounds || null, result.videoStartTime)
          console.log('[IPC] Exported clicks to native recording path:', clicksPath)
        } catch (error) {
          console.error('[IPC] Failed to export clicks for native recording:', error)
        }
      }

      currentVideoPath = result.outputPath
      currentAudioPath = result.audioOutputPath || null
      currentCameraPath = result.cameraOutputPath || null
    }
    cursorSegments = []
    activeRecordingBounds = undefined

    // Restore the HUD after recording ends
    const mainWin = getMainWindow()
    if (mainWin) {
      mainWin.restore()
      mainWin.focus()
    }

    if (onRecordingStateChange) {
      onRecordingStateChange(false, selectedSource?.name || 'Screen')
    }

    return result
  })

  ipcMain.handle('set-recording-state', async (_, recording: boolean, videoStartTime?: number) => {
    const source = selectedSource || { name: 'Screen' }

    if (recording) {
      // Start mouse tracking when recording begins
      // Detect bounds from the selected screen display
      let recordingBounds = undefined;
      if (selectedSource && selectedSource.id.startsWith('screen')) {
        try {
          const displays = screen.getAllDisplays();
          const matchedDisplay = displays.find(d => d.id.toString() === selectedSource.display_id?.toString());
          if (matchedDisplay) {
            recordingBounds = {
              x: matchedDisplay.bounds.x,
              y: matchedDisplay.bounds.y,
              width: matchedDisplay.bounds.width,
              height: matchedDisplay.bounds.height
            };
            console.log('[IPC] Matched recording display bounds:', recordingBounds);
          }
        } catch (err) {
          console.error('[IPC] Failed to resolve recording bounds:', err);
        }
      }
      mouseTracker.start(recordingBounds);
      console.log('[IPC] Mouse tracking started for recording');

      // Minimize the HUD to avoid capturing it in the recording
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.minimize();
      }
    } else {
      // Stop tracking and export clicks when recording ends
      const { events, bounds } = mouseTracker.stop();
      console.log(`[IPC] Mouse tracking stopped, captured ${events.length} clicks`);

      // Export clicks.json alongside the video
      if (events.length > 0) {
        try {
          // Save to a temporary file first, will be renamed when video is stored
          const clicksFilePath = path.join(RECORDINGS_DIR, 'temp-clicks.json');
          await mouseTracker.exportToFile(clicksFilePath, events, bounds, videoStartTime);
          console.log('[IPC] Clicks exported to temp file', clicksFilePath);
        } catch (error) {
          console.error('[IPC] Failed to export clicks:', error);
        }
      } else {
        console.log('[IPC] No clicks recorded, skipping export');
      }

      // Restore the HUD after recording ends
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.restore();
        mainWin.focus();
      }
    }

    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name)
    }
  })


  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return { success: false, error: String(error) }
    }
  })

  // Return base path for assets so renderer can resolve file:// paths in production
  ipcMain.handle('get-asset-base-path', () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, 'assets')
      }
      return path.join(app.getAppPath(), 'public', 'assets')
    } catch (err) {
      console.error('Failed to resolve asset base path:', err)
      return null
    }
  })

  ipcMain.handle('resolve-bundled-music', async (_, fileName: string) => {
    const safeName = path.basename(fileName)
    if (safeName !== fileName || !safeName.endsWith('.wav')) return { success: false, error: 'Invalid bundled music file' }
    const root = app.isPackaged ? path.join(process.resourcesPath, 'music') : path.join(app.getAppPath(), 'public', 'music')
    const filePath = path.join(root, safeName)
    try { await fs.access(filePath); return { success: true, url: `toscreen://${filePath}` } }
    catch { return { success: false, error: 'Bundled music asset is missing' } }
  })
  ipcMain.handle('list-bundled-music', async () => {
    const root = app.isPackaged ? path.join(process.resourcesPath, 'music') : path.join(app.getAppPath(), 'public', 'music')
    try { return { success: true, manifest: JSON.parse(await fs.readFile(path.join(root, 'LICENSES.json'), 'utf8')) } }
    catch { return { success: false, error: 'Bundled music manifest is missing' } }
  })

  ipcMain.handle('save-exported-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Save Exported Video',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: 'Export cancelled'
        };
      }
      await fs.writeFile(result.filePath, Buffer.from(videoData));

      return {
        success: true,
        path: result.filePath,
        message: 'Video exported successfully'
      };
    } catch (error) {
      console.error('Failed to save exported video:', error)
      return {
        success: false,
        message: 'Failed to save exported video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('open-video-file-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Video File',
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: 'Video Files', extensions: ['webm', 'mp4', 'mov', 'avi', 'mkv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error('Failed to open file picker:', error);
      return {
        success: false,
        message: 'Failed to open file picker',
        error: String(error)
      };
    }
  });

  ipcMain.handle('set-current-video-path', (_, path: string, proxyPath?: string, audioPath?: string, cameraPath?: string, microphonePath?: string) => {
    currentVideoPath = path;
    currentProxyPath = proxyPath || null;
    currentAudioPath = audioPath || null;
    currentCameraPath = cameraPath || null;
    currentMicrophonePath = microphonePath || null;
    return { success: true };
  });

  ipcMain.handle('get-current-video-path', () => {
    return currentVideoPath 
      ? { success: true, path: currentVideoPath, proxyPath: currentProxyPath, audioPath: currentAudioPath, cameraPath: currentCameraPath, microphonePath: currentMicrophonePath }
      : { success: false };
  });

  ipcMain.handle('clear-current-video-path', () => {
    clearCurrentProjectMedia()
    currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'new' });
    return { success: true };
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  // Mouse tracker: manually record a click (for testing/fallback)
  ipcMain.handle('record-mouse-click', (_, x: number, y: number) => {
    mouseTracker.addEvent(x, y, 'click');
    return { success: true };
  });

  // Mouse tracker: get current tracking status
  ipcMain.handle('get-mouse-tracking-status', () => {
    return mouseTracker.getStatus();
  });

  // Read clicks.json for a given video path
  ipcMain.handle('read-clicks-json', async (_, videoPath: string) => {
    const normalizedPath = normalizeMediaPath(videoPath);
    let eventDrivenClicks: any[] = []
    let eventTimelineStartTime: number | undefined

    try {
      const clicksPath = normalizedPath + '.clicks.json';
      const content = await fs.readFile(clicksPath, 'utf-8');
      const data = JSON.parse(content);
      eventDrivenClicks = Array.isArray(data) ? data : (data.events || []);
      const parsedTimelineStart = Number(Array.isArray(data) ? undefined : data.videoStartTime)
      eventTimelineStartTime = Number.isFinite(parsedTimelineStart) ? parsedTimelineStart : undefined
    } catch {
      // Native cursor polling remains available for old recordings below.
    }

    const nativeCursorPath = await nativeCursorPathForMediaPath(normalizedPath)
    let nativeEvents: any[] = []
    if (nativeCursorPath) {
      try {
        const nativeContent = await fs.readFile(nativeCursorPath, 'utf-8')
        const rawNativeEvents = JSON.parse(nativeContent)
        const resolvedTimelineStart = resolveCursorTimelineStart(rawNativeEvents, eventTimelineStartTime)
        nativeEvents = normalizeNativeCursorEvents(rawNativeEvents, resolvedTimelineStart)
        eventDrivenClicks = rebaseCursorEventsToTimeline(eventDrivenClicks, resolvedTimelineStart)
      } catch {
        // Older and WebRTC recordings only have the clicks sidecar below.
      }
    }

    // The event sidecar owns the media clock and precise position. The AppKit
    // sidecar only contributes cursor shape transitions. Both streams are
    // normalized to the event sidecar's first-video-frame timestamp above.
    if (eventDrivenClicks.length > 0 && hasPreciseEventClock(eventDrivenClicks)) {
      const mergedEvents = mergeCursorShapeTelemetry(eventDrivenClicks, nativeEvents)
      return {
        success: true,
        clicks: mergedEvents,
        source: nativeEvents.length > 0 ? 'event-cursor-with-native-shapes' : 'event-cursor',
      };
    }

    if (nativeEvents.length > 0) {
      return { success: true, clicks: nativeEvents, source: 'native-cursor' }
    }

    if (eventDrivenClicks.length > 0) {
      return { success: true, clicks: eventDrivenClicks, source: 'legacy-clicks' };
    }

    // It's normal for some videos to not have cursor telemetry.
    return { success: false, message: 'No clicks file found' };
  });

  // Project Auto-Save API
  ipcMain.handle('save-project', async (_, videoPath: string, projectData: any) => {
    try {
      if (!videoPath) return { success: false, message: 'No video path provided' };
      const projectPath = currentProjectPath || projectPathForMediaPath(videoPath);
      await atomicWriteJson(projectPath, projectData);
      currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'save-as', projectPath })
      await rememberProject(projectPath, projectData)
      return { success: true, projectPath };
    } catch (error) {
      console.error('[IPC] Failed to save project:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-project', async (_, videoPath: string) => {
    try {
      if (!videoPath) return { success: false, message: 'No video path provided' };
      const candidates = Array.from(new Set([
        ...(currentProjectPath ? [currentProjectPath] : []),
        ...projectPathCandidatesForMediaPath(videoPath),
      ]));

      for (const projectPath of candidates) {
        try {
          const loaded = await readJsonWithBackup(projectPath)
          const project = loaded.value
          currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'open', projectPath })
          await rememberProject(projectPath, project)
          return { success: true, project, projectPath, recovered: loaded.recovered };
        } catch (error) {
          const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
          if (code && code !== 'ENOENT') throw error;
        }
      }

      return { success: false, message: 'No project file found' };
    } catch (error) {
      console.error('[IPC] Failed to load project:', error);
      return { success: false, message: 'Failed to load project', error: String(error) };
    }
  });

  ipcMain.handle('project-save-as', async (_, projectData: any) => {
    const owner = getMainWindow() || undefined
    const result = await dialog.showSaveDialog(owner!, {
      title: 'Save ToScreen Project As',
      defaultPath: `${projectData?.projectModel?.name || projectData?.name || 'Untitled'}${PROJECT_EXTENSION}`,
      filters: [{ name: 'ToScreen Project', extensions: [PROJECT_EXTENSION.slice(1)] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })
    if (result.canceled || !result.filePath) return { success: false, cancelled: true }
    const projectPath = result.filePath.endsWith(PROJECT_EXTENSION) ? result.filePath : `${result.filePath}${PROJECT_EXTENSION}`
    const name = path.basename(projectPath, PROJECT_EXTENSION)
    const next = projectData?.projectModel
      ? { ...projectData, projectModel: { ...projectData.projectModel, name, updatedAt: new Date().toISOString() } }
      : { ...projectData, name, updatedAt: new Date().toISOString() }
    await atomicWriteJson(projectPath, next)
    currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'save-as', projectPath })
    await rememberProject(projectPath, next)
    return { success: true, projectPath, project: next, name }
  })

  ipcMain.handle('project-get-current', () => ({ projectPath: currentProjectPath }))
  ipcMain.handle('project-new', () => { currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'new' }); clearCurrentProjectMedia(); return { success: true } })
  ipcMain.handle('project-list-recent', async () => {
    const recent = await readRecentIndex(recentIndexPath)
    const coverRequests: Array<{ entry: RecentProjectEntry; project: unknown }> = []
    const refreshed = await Promise.all(recent.map(async entry => {
      try {
        const loaded = await readJsonWithBackup(entry.projectPath)
        const project = loaded.value
        const assets = await inspectProjectAssets(project)
        const candidate = await resolveProjectCoverCandidate(project, projectCoverDirectory)
        const customCoverIsCurrent = Boolean(
          candidate
          && entry.thumbnailMode === 'custom'
          && entry.thumbnailSourceSignature === candidate.sourceSignature
          && entry.thumbnailPath
          && await fs.access(entry.thumbnailPath).then(() => true).catch(() => false),
        )
        const autoCoverIsCurrent = Boolean(
          candidate
          && entry.thumbnailMode !== 'custom'
          && entry.thumbnailSourceSignature === candidate.sourceSignature
          && entry.thumbnailPath === candidate.outputPath
          && await projectCoverExists(candidate),
        )
        const coverIsCurrent = customCoverIsCurrent || autoCoverIsCurrent
        const nextEntry = {
          ...entry,
          thumbnailFocus: customCoverIsCurrent ? entry.thumbnailFocus : resolveProjectCoverInteractionFocus(project),
          thumbnailPath: coverIsCurrent ? entry.thumbnailPath : undefined,
          thumbnailSourceSignature: coverIsCurrent ? entry.thumbnailSourceSignature : undefined,
          thumbnailSourceWidth: candidate?.sourceWidth ?? entry.thumbnailSourceWidth,
          thumbnailSourceHeight: candidate?.sourceHeight ?? entry.thumbnailSourceHeight,
          assetStatus: loaded.recovered ? 'recovered' as const : assets.missing.length ? 'missing' as const : 'ready' as const,
          missingAssets: assets.missing,
        }
        if (candidate && !coverIsCurrent) coverRequests.push({ entry: nextEntry, project })
        return nextEntry
      } catch (error) { return { ...entry, assetStatus: (typeof error === 'object' && error && 'code' in error && (error as any).code === 'ENOENT') ? 'missing-project' as const : 'corrupt' as const } }
    }))
    await writeRecentIndex(recentIndexPath, refreshed.map(entry => {
      if (entry.thumbnailMode === 'custom') return entry
      const { thumbnailFocus: _thumbnailFocus, ...persisted } = entry
      return persisted
    }))
    coverRequests.forEach(({ entry, project }) => scheduleProjectCover(entry, project))
    return { success: true, projects: refreshed }
  })
  ipcMain.handle('project-get-cover-editor', async (_, projectPath: string) => {
    const project = (await readJsonWithBackup(projectPath)).value
    const candidate = await resolveProjectCoverCandidate(project, projectCoverDirectory)
    if (!candidate) return { success: false, error: 'The project has no available screen recording.' }
    const entry = (await readRecentIndex(recentIndexPath)).find(item => item.projectPath === projectPath)
    return {
      success: true,
      sourcePath: candidate.sourcePath,
      sourceWidth: candidate.sourceWidth,
      sourceHeight: candidate.sourceHeight,
      durationMs: Number(entry?.durationMs || project?.projectModel?.durationMs || project?.durationMs || 0),
      timeMs: entry?.thumbnailMode === 'custom' ? Number(entry.thumbnailTimeMs || 0) : 0,
      frameScale: entry?.thumbnailMode === 'custom' ? Number(entry.thumbnailFrameScale || 1) : 1,
      focus: entry?.thumbnailMode === 'custom'
        ? entry.thumbnailFocus || { x: 50, y: 46 }
        : resolveProjectCoverInteractionFocus(project) || { x: 50, y: 46 },
      mode: entry?.thumbnailMode || 'auto',
    }
  })
  ipcMain.handle('project-set-cover', async (_, projectPath: string, input: { timeMs?: number; frameScale?: number; focus?: { x?: number; y?: number } }) => {
    const project = (await readJsonWithBackup(projectPath)).value
    const candidate = await resolveProjectCoverCandidate(project, projectCoverDirectory)
    if (!candidate) return { success: false, error: 'The project has no available screen recording.' }
    const recent = await readRecentIndex(recentIndexPath)
    const existing = recent.find(item => item.projectPath === projectPath) || await rememberProject(projectPath, project)
    const durationMs = Math.max(0, Number(existing.durationMs || project?.projectModel?.durationMs || project?.durationMs || 0))
    const timeMs = Math.min(durationMs || Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(Number(input?.timeMs || 0))))
    const maxFrameScale = getProjectCoverMaxFrameScale(candidate.sourceWidth, candidate.sourceHeight)
    const frameScale = Number(Math.min(maxFrameScale, Math.max(.65, Number(input?.frameScale || 1))).toFixed(2))
    const focus = {
      x: Number(Math.min(95, Math.max(5, Number(input?.focus?.x || 50))).toFixed(2)),
      y: Number(Math.min(95, Math.max(5, Number(input?.focus?.y || 46))).toFixed(2)),
    }
    const coverPath = await generateProjectCoverAtTime(candidate, timeMs, { frameScale, focus })
    if (!coverPath) return { success: false, error: 'The selected video frame could not be captured.' }
    const current = await readRecentIndex(recentIndexPath)
    const nextEntry: RecentProjectEntry = {
      ...existing,
      thumbnailPath: coverPath,
      thumbnailSourceSignature: candidate.sourceSignature,
      thumbnailSourceWidth: candidate.sourceWidth,
      thumbnailSourceHeight: candidate.sourceHeight,
      thumbnailMode: 'custom',
      thumbnailTimeMs: timeMs,
      thumbnailFrameScale: frameScale,
      thumbnailFocus: focus,
    }
    await writeRecentIndex(recentIndexPath, [nextEntry, ...current.filter(item => item.projectPath !== projectPath)].slice(0, 100))
    BrowserWindow.getAllWindows().forEach(window => window.webContents.send('project-covers-updated'))
    return { success: true, thumbnailPath: coverPath, timeMs, frameScale, focus }
  })
  ipcMain.handle('project-reset-cover', async (_, projectPath: string) => {
    const project = (await readJsonWithBackup(projectPath)).value
    const recent = await readRecentIndex(recentIndexPath)
    const existing = recent.find(item => item.projectPath === projectPath) || await rememberProject(projectPath, project)
    const nextEntry: RecentProjectEntry = {
      ...existing,
      thumbnailPath: undefined,
      thumbnailSourceSignature: undefined,
      thumbnailMode: 'auto',
      thumbnailTimeMs: undefined,
      thumbnailFrameScale: undefined,
      thumbnailFocus: undefined,
    }
    const current = await readRecentIndex(recentIndexPath)
    await writeRecentIndex(recentIndexPath, [nextEntry, ...current.filter(item => item.projectPath !== projectPath)].slice(0, 100))
    scheduleProjectCover(nextEntry, project)
    return { success: true }
  })
  ipcMain.handle('project-open', async (_, projectPath: string) => {
    const loaded = await readJsonWithBackup(projectPath)
    const project = loaded.value
    const media = hydrateMedia(project)
    currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'open', projectPath })
    await rememberProject(projectPath, project)
    return { success: true, project, projectPath, recovered: loaded.recovered, media }
  })
  ipcMain.handle('project-remove-recent', async (_, projectPath: string) => {
    await writeRecentIndex(recentIndexPath, (await readRecentIndex(recentIndexPath)).filter(entry => entry.projectPath !== projectPath))
    return { success: true }
  })
  ipcMain.handle('project-delete', async (_, projectPath: string, deleteAssets = false) => {
    const answer = await dialog.showMessageBox(getMainWindow()!, {
      type: 'warning', buttons: ['Cancel', 'Delete Project'], defaultId: 0, cancelId: 0,
      title: 'Delete project?', message: 'Delete this project file?',
      detail: deleteAssets ? 'Project and referenced source media will be deleted.' : 'Source recordings and imported media will be kept.',
    })
    if (answer.response !== 1) return { success: false, cancelled: true }
    if (deleteAssets) {
      const project = JSON.parse(await fs.readFile(projectPath, 'utf8'))
      const assets = await inspectProjectAssets(project)
      const ownedRoot = path.dirname(projectPath)
      await Promise.all(assets.ready.filter(asset => path.dirname(asset) === ownedRoot || asset.startsWith(`${ownedRoot}${path.sep}assets${path.sep}`)).map(asset => fs.unlink(asset).catch(() => undefined)))
    }
    await fs.unlink(projectPath)
    await writeRecentIndex(recentIndexPath, (await readRecentIndex(recentIndexPath)).filter(entry => entry.projectPath !== projectPath))
    return { success: true }
  })
  ipcMain.handle('project-relink', async (_, projectPath: string, missingPath: string) => {
    const result = await dialog.showOpenDialog(getMainWindow()!, { title: `Relink ${path.basename(missingPath)}`, properties: ['openFile'] })
    if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true }
    const projectText = await fs.readFile(projectPath, 'utf8')
    const project = JSON.parse(projectText.split(missingPath).join(result.filePaths[0]))
    await atomicWriteJson(projectPath, project)
    await rememberProject(projectPath, project)
    return { success: true, project }
  })
  ipcMain.handle('project-export-package', async (_, projectPath?: string) => {
    const source = projectPath || currentProjectPath
    if (!source) return { success: false, error: 'Save the project before exporting a package.' }
    const result = await dialog.showSaveDialog(getMainWindow()!, { defaultPath: `${path.basename(source, path.extname(source))}${PACKAGE_EXTENSION}`, filters: [{ name: 'ToScreen Project Package', extensions: [PACKAGE_EXTENSION.slice(1)] }] })
    if (result.canceled || !result.filePath) return { success: false, cancelled: true }
    const outputPath = result.filePath.endsWith(PACKAGE_EXTENSION) ? result.filePath : `${result.filePath}${PACKAGE_EXTENSION}`
    const pkg = await createPortablePackage(source, outputPath)
    return { success: true, outputPath, assetCount: pkg.assets.length }
  })
  ipcMain.handle('project-import-package', async () => {
    const open = await dialog.showOpenDialog(getMainWindow()!, { properties: ['openFile'], filters: [{ name: 'ToScreen Project Package', extensions: [PACKAGE_EXTENSION.slice(1)] }] })
    if (open.canceled || !open.filePaths[0]) return { success: false, cancelled: true }
    const destination = await dialog.showOpenDialog(getMainWindow()!, { title: 'Choose project destination', properties: ['openDirectory', 'createDirectory'] })
    if (destination.canceled || !destination.filePaths[0]) return { success: false, cancelled: true }
    const imported = await importPortablePackage(open.filePaths[0], destination.filePaths[0])
    currentProjectPath = transitionProjectDocument(currentProjectPath, { type: 'open', projectPath: imported.projectPath })
    const media = hydrateMedia(imported.project)
    await rememberProject(imported.projectPath, imported.project)
    return { success: true, ...imported, media }
  })

  const readPresets = async (): Promise<{ presets: ToScreenPreset[]; defaultPresetId?: string }> => {
    try { const value = JSON.parse(await fs.readFile(presetIndexPath, 'utf8')); return { presets: Array.isArray(value.presets) ? value.presets : [], defaultPresetId: value.defaultPresetId } }
    catch { return { presets: [] } }
  }
  ipcMain.handle('preset-list', async () => ({ success: true, ...(await readPresets()) }))
  ipcMain.handle('preset-save', async (_, name: string, project: Record<string, unknown>, presetId?: string) => {
    const index = await readPresets(); const existing = index.presets.find(item => item.id === presetId)
    const preset = createPreset(name, project, existing)
    const presets = [preset, ...index.presets.filter(item => item.id !== preset.id)]
    await atomicWriteJson(presetIndexPath, { version: 1, presets, defaultPresetId: index.defaultPresetId })
    return { success: true, preset }
  })
  ipcMain.handle('preset-delete', async (_, presetId: string) => { const index = await readPresets(); await atomicWriteJson(presetIndexPath, { version: 1, presets: index.presets.filter(item => item.id !== presetId), defaultPresetId: index.defaultPresetId === presetId ? undefined : index.defaultPresetId }); return { success: true } })
  ipcMain.handle('preset-set-default', async (_, presetId?: string) => { const index = await readPresets(); await atomicWriteJson(presetIndexPath, { version: 1, presets: index.presets, defaultPresetId: presetId }); return { success: true } })
  ipcMain.handle('preset-apply', async (_, project: Record<string, unknown>, presetId: string) => { const preset = (await readPresets()).presets.find(item => item.id === presetId); if (!preset) throw new Error('Preset not found.'); return { success: true, project: applyPreset(project, preset) } })
  ipcMain.handle('preset-export', async (_, presetId: string) => { const preset = (await readPresets()).presets.find(item => item.id === presetId); if (!preset) throw new Error('Preset not found.'); const result = await dialog.showSaveDialog(getMainWindow()!, { defaultPath: `${preset.name}${PRESET_EXTENSION}`, filters: [{ name: 'ToScreen Preset', extensions: [PRESET_EXTENSION.slice(1)] }] }); if (result.canceled || !result.filePath) return { success: false, cancelled: true }; const outputPath = result.filePath.endsWith(PRESET_EXTENSION) ? result.filePath : `${result.filePath}${PRESET_EXTENSION}`; await atomicWriteJson(outputPath, preset); return { success: true, outputPath } })
  ipcMain.handle('preset-import', async () => { const result = await dialog.showOpenDialog(getMainWindow()!, { properties: ['openFile'], filters: [{ name: 'ToScreen Preset', extensions: [PRESET_EXTENSION.slice(1)] }] }); if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true }; const preset = JSON.parse(await fs.readFile(result.filePaths[0], 'utf8')); validatePreset(preset); const index = await readPresets(); await atomicWriteJson(presetIndexPath, { version: 1, presets: [preset, ...index.presets.filter(item => item.id !== preset.id)], defaultPresetId: index.defaultPresetId }); return { success: true, preset } })

  // Proxy Generation API
  ipcMain.handle('generate-proxy-video', async (event, inputPath: string) => {
    try {
      const normalizedPath = normalizeMediaPath(inputPath);

      // We'll send progress back through a specific IPC event
      const result = await generateProxyVideo(normalizedPath, (progressPercent) => {
        event.sender.send('proxy-generation-progress', progressPercent);
      });
      return result;
    } catch (error) {
      console.error('[IPC] Failed to generate proxy:', error);
      return { success: false, error: String(error) };
    }
  });
}

async function findFirstExistingPath(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    const exists = await fs.access(candidate).then(() => true).catch(() => false);
    if (exists) return candidate;
  }
  return undefined;
}
