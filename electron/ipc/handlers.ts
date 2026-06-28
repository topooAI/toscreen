import { ipcMain, desktopCapturer, BrowserWindow, shell, app, dialog, screen } from 'electron'

import fs from 'node:fs/promises'
import path from 'node:path'
import { RECORDINGS_DIR } from '../main'
import { mouseTracker } from '../mouseTracker'

import {
  isNativeRecordingAvailable,
  startNativeRecording,
  stopNativeRecording
} from '../nativeRecorder'

import { generateProxyVideo } from './proxyGenerator'

let selectedSource: any = null

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



  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const files = await fs.readdir(RECORDINGS_DIR)
      const videoFiles = files.filter(file => file.endsWith('.webm') || file.endsWith('.mov'))

      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }

      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(RECORDINGS_DIR, latestVideo)
      const parsed = path.parse(videoPath)
      const proxyPath = path.join(parsed.dir, `${parsed.name}-proxy.mp4`)
      const hasProxy = await fs.access(proxyPath).then(() => true).catch(() => false)

      return { success: true, path: videoPath, proxyPath: hasProxy ? proxyPath : undefined }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('is-native-recording-available', () => {
    return isNativeRecordingAvailable()
  })

  ipcMain.handle('start-native-recording', async () => {
    const isAvailable = isNativeRecordingAvailable()
    if (!isAvailable) {
      return { success: false, error: 'Native recording is not available on this platform.' }
    }

    let recordingBounds = undefined
    let displayId = undefined
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

    const result = await startNativeRecording({ showCursor: false, displayId })
    if (result.success) {
      mouseTracker.start(recordingBounds)
      
      const mainWin = getMainWindow()
      if (mainWin) {
        mainWin.minimize()
      }

      if (onRecordingStateChange) {
        const sourceName = selectedSource?.name || 'Screen'
        onRecordingStateChange(true, sourceName)
      }
    }

    return result
  })

  ipcMain.handle('stop-native-recording', async () => {
    const result = await stopNativeRecording()
    
    // Stop mouse tracking and export clicks
    const { events, bounds } = mouseTracker.stop()
    if (result.success && result.outputPath) {
      if (events.length > 0) {
        try {
          const clicksPath = result.outputPath + '.clicks.json'
          await mouseTracker.exportToFile(clicksPath, events, bounds, undefined)
          console.log('[IPC] Exported clicks to native recording path:', clicksPath)
        } catch (error) {
          console.error('[IPC] Failed to export clicks for native recording:', error)
        }
      }

      currentVideoPath = result.outputPath
      currentAudioPath = (result as any).audioOutputPath || null
    }

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

  ipcMain.handle('set-current-video-path', (_, path: string, proxyPath?: string, audioPath?: string) => {
    currentVideoPath = path;
    currentProxyPath = proxyPath || null;
    currentAudioPath = audioPath || null;
    return { success: true };
  });

  ipcMain.handle('get-current-video-path', () => {
    return currentVideoPath 
      ? { success: true, path: currentVideoPath, proxyPath: currentProxyPath, audioPath: currentAudioPath } 
      : { success: false };
  });

  ipcMain.handle('clear-current-video-path', () => {
    currentVideoPath = null;
    currentProxyPath = null;
    currentAudioPath = null;
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
    try {
      // Robust path decoding for both encoded file:// URLs and raw paths
      let normalizedPath = videoPath.replace(/^file:\/\/\//, '/').replace(/^file:\/\//, '');
      
      // Decode segments individually to be safe
      normalizedPath = normalizedPath.split('/').map(part => {
        try {
          return decodeURIComponent(part);
        } catch (e) {
          return part;
        }
      }).join('/');
      
      // If it's a Windows absolute path that lost its slash, add it back if needed
      // (though usually normalize handles this)
      
      const clicksPath = normalizedPath + '.clicks.json';

      const content = await fs.readFile(clicksPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Handle both old array-only format and new wrapped format
      const clicks = Array.isArray(data) ? data : (data.events || []);
      
      return { success: true, clicks };
    } catch (error) {
      // It's normal for some videos to not have clicks
      return { success: false, message: 'No clicks file found' };
    }
  });

  // Project Auto-Save API
  ipcMain.handle('save-project', async (_, videoPath: string, projectData: any) => {
    try {
      if (!videoPath) return { success: false, message: 'No video path provided' };
      const normalizedPath = videoPath.replace(/^file:\/\/\//, '/').replace(/^file:\/\//, '');
      const parsed = path.parse(decodeURIComponent(normalizedPath));
      const projectPath = path.join(parsed.dir, `${parsed.name}.project.json`);
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
      const normalizedPath = videoPath.replace(/^file:\/\/\//, '/').replace(/^file:\/\//, '');
      const parsed = path.parse(decodeURIComponent(normalizedPath));
      const projectPath = path.join(parsed.dir, `${parsed.name}.project.json`);
      const rawData = await fs.readFile(projectPath, 'utf8');
      return { success: true, project: JSON.parse(rawData) };
    } catch (error) {
      // Normal if project doesn't exist yet
      return { success: false, message: 'No project file found' };
    }
  });

  // Proxy Generation API
  ipcMain.handle('generate-proxy-video', async (event, inputPath: string) => {
    try {
      // Decode the URL if it comes from the frontend (file://)
      let normalizedPath = inputPath.replace(/^file:\/\/\//, '/').replace(/^file:\/\//, '');
      normalizedPath = decodeURIComponent(normalizedPath);

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
