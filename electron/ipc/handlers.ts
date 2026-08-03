import { ipcMain, desktopCapturer, BrowserWindow, shell, app, dialog, screen, systemPreferences } from 'electron'

import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'
import { mouseTracker } from '../mouseTracker'
import { mergeSegmentEvents } from '../recordingTimeline'

import {
  isNativeRecordingAvailable,
  startNativeRecording,
  stopNativeRecording,
  pauseNativeRecording,
  resumeNativeRecording,
} from '../nativeRecorder'

import { generateProxyVideo } from './proxyGenerator'
import {
  mergeCursorShapeTelemetry,
  normalizeNativeCursorEvents,
  rebaseCursorEventsToTimeline,
  resolveCursorTimelineStart,
} from '../cursorTelemetry'
import {
  companionAudioPathCandidatesForMediaPath,
  normalizeMediaPath,
  projectPathCandidatesForMediaPath,
  projectPathForMediaPath,
} from './projectFiles'

let selectedSource: any = null
let activeRecordingBounds: { x: number; y: number; width: number; height: number } | undefined
let cursorSegments: Array<{ events: any[]; videoStartTime: number; durationMs: number }> = []

function nativeCursorPathForMediaPath(mediaPath: string): string | null {
  const parsed = path.parse(mediaPath)
  const timestamp = parsed.name.match(/(?:^|[-_])(\d{13})$/)?.[1]
  return timestamp ? path.join(parsed.dir, `temp_cursor_${timestamp}.json`) : null
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

  let currentVideoPath: string | null = null;
  let currentProxyPath: string | null = null;
  let currentAudioPath: string | null = null;
  let currentCameraPath: string | null = null;
  let currentMicrophonePath: string | null = null;

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
    currentVideoPath = null;
    currentProxyPath = null;
    currentAudioPath = null;
    currentCameraPath = null;
    currentMicrophonePath = null;
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

    const nativeCursorPath = nativeCursorPathForMediaPath(normalizedPath)
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
      const projectPath = projectPathForMediaPath(videoPath);
      await fs.writeFile(projectPath, JSON.stringify(projectData, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to save project:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('load-project', async (_, videoPath: string) => {
    try {
      if (!videoPath) return { success: false, message: 'No video path provided' };
      const candidates = projectPathCandidatesForMediaPath(videoPath);

      for (const projectPath of candidates) {
        try {
          const rawData = await fs.readFile(projectPath, 'utf8');
          return { success: true, project: JSON.parse(rawData), projectPath };
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
