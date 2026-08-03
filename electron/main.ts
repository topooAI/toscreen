import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  session,
  protocol,
  type MenuItemConstructorOptions,
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import {
  createHudOverlayWindow,
  createEditorWindow,
  createProjectHomeWindow,
  createSettingsWindow,
  createSourceSelectorWindow,
} from './windows'
import { registerIpcHandlers } from './ipc/handlers'
import { registerPreferenceIpcHandlers } from './preferences'
import { registerTranscriptionHandlers } from './transcription'
import { registerIOSDeviceCaptureHandlers } from './iosDeviceCapture'

// Electron 30 + macOS Metal/ANGLE can intermittently lose the GPU context after
// ScreenCaptureKit recording. Prefer the GL ANGLE backend in development so the
// Pixi preview does not disappear after an app restart or recording stop.
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'gl')
}

// Keep Electron's internal product label aligned with the packaged ToScreen
// name. Preserve the existing user-data location so the name change cannot move
// or orphan recordings, projects, or preferences.
const existingUserDataPath = path.join(app.getPath('appData'), 'toscreen')
fsSync.mkdirSync(existingUserDataPath, { recursive: true })
app.setName('ToScreen')
app.setPath('userData', existingUserDataPath)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Global safety net for EIO errors on stdout/stderr
const wrapConsole = (method: 'log' | 'error' | 'warn' | 'info') => {
  const original = console[method];
  console[method] = (...args: any[]) => {
    try {
      original.apply(console, args);
    } catch (e) {
      // Ignore EIO or other stream errors
    }
  };
};
['log', 'error', 'warn', 'info'].forEach((m: any) => wrapConsole(m));

export const RECORDINGS_DIR = path.join(app.getPath('userData'), 'recordings')


async function ensureRecordingsDir() {
  try {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true })
    console.log('RECORDINGS_DIR:', RECORDINGS_DIR)
    console.log('User Data Path:', app.getPath('userData'))
  } catch (error) {
    console.error('Failed to create recordings directory:', error)
  }
}

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Window references
let mainWindow: BrowserWindow | null = null
let sourceSelectorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let selectedSourceName = ''
let mainWindowMode: 'home' | 'hud' | 'editor' | null = null
let isQuitting = false

// Tray Icons
const defaultTrayIcon = getTrayIcon('openscreen.png');
const recordingTrayIcon = getTrayIcon('rec-button.png');

function registerMainWindow(win: BrowserWindow, mode: 'home' | 'hud' | 'editor') {
  mainWindow = win
  mainWindowMode = mode

  win.on('closed', () => {
    if (mainWindow !== win) return

    mainWindow = null
    mainWindowMode = null

    if (mode === 'editor' && !isQuitting) {
      setTimeout(() => {
        if (!mainWindow && !isQuitting) {
          registerMainWindow(createProjectHomeWindow(), 'home')
        }
      }, 0)
    }
  })
}

function createInitialWindow() {
  if (VITE_DEV_SERVER_URL && process.env.TOSCREEN_DEV_WINDOW_TYPE === 'editor') {
    registerMainWindow(createEditorWindow(), 'editor')
    return
  }
  registerMainWindow(createProjectHomeWindow(), 'home')
}

function showOrCreateMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  registerMainWindow(createProjectHomeWindow(), 'home')
}

function createTray() {
  tray = new Tray(defaultTrayIcon);
}

function getTrayIcon(filename: string) {
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
    width: 24,
    height: 24,
    quality: 'best'
  });
}


function updateTrayMenu(recording: boolean = false) {
  if (!tray) return;
  const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
  const trayToolTip = recording ? `Recording: ${selectedSourceName}` : "OpenScreen";
  const menuTemplate = recording
    ? [
      {
        label: "Stop Recording",
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("stop-recording-from-tray");
          }
        },
      },
    ]
    : [
      {
        label: "Open",
        click: () => {
          showOrCreateMainWindow()
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ];
  tray.setImage(trayIcon);
  tray.setToolTip(trayToolTip);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

function createEditorWindowWrapper() {
  if (mainWindowMode === 'editor' && mainWindow && !mainWindow.isDestroyed()) {
    showOrCreateMainWindow()
    return
  }

  const previousWindow = mainWindow
  registerMainWindow(createEditorWindow(), 'editor')
  if (previousWindow && !previousWindow.isDestroyed()) previousWindow.close()
}

function createRecordingWindowWrapper() {
  const previousWindow = mainWindow
  registerMainWindow(createHudOverlayWindow(), 'hud')
  if (previousWindow && !previousWindow.isDestroyed()) previousWindow.close()
}

function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow()
  sourceSelectorWindow.on('closed', () => {
    sourceSelectorWindow = null
  })
  return sourceSelectorWindow
}

function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = createSettingsWindow()
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function installApplicationMenu() {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'ToScreen',
      submenu: [
        { label: 'About ToScreen', role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Settings…',
          accelerator: 'CommandOrControl+,',
          click: showSettingsWindow,
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { label: 'Hide ToScreen', role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { label: 'Quit ToScreen', role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        ...(!isMac ? [{
          label: 'Settings…',
          accelerator: 'CommandOrControl+,',
          click: showSettingsWindow,
        }, { type: 'separator' as const }] : []),
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(VITE_DEV_SERVER_URL ? [
          { type: 'separator' as const },
          { role: 'reload' as const },
          { role: 'toggleDevTools' as const },
        ] : []),
      ],
    },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Keep app running (macOS behavior)
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('activate', () => {
  showOrCreateMainWindow()
})


protocol.registerSchemesAsPrivileged([
  { scheme: 'toscreen', privileges: { supportFetchAPI: true, bypassCSP: true, secure: true, corsEnabled: true } }
]);

// Register all IPC handlers when app is ready
app.whenReady().then(async () => {
  // Listen for HUD overlay quit event (macOS only)
  const { ipcMain } = await import('electron');
  ipcMain.on('hud-overlay-close', () => {
    app.quit();
  });

  registerPreferenceIpcHandlers()
  installApplicationMenu()

  // Register custom protocol to bypass fetch API file:// restrictions
  protocol.registerFileProtocol('toscreen', (request, callback) => {
    let url = request.url.substring(11); // remove 'toscreen://'
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      url = url.substring(0, queryIndex);
    }
    try {
      callback({ path: decodeURIComponent(url) });
    } catch (error) {
      callback({ error: -2 }); // net::ERR_FAILED
    }
  });

  createTray()
  updateTrayMenu()
  // Ensure recordings directory exists
  await ensureRecordingsDir()

  // Diagnostic Logs for Display Configuration
  try {
    const { screen } = await import('electron');
    console.log('[DIAGNOSTIC] Primary Display Bounds:', screen.getPrimaryDisplay().bounds, 'Scale:', screen.getPrimaryDisplay().scaleFactor);
    console.log('[DIAGNOSTIC] All Displays:', screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor
    })));
  } catch (err) {
    console.error('[DIAGNOSTIC] Failed to print screen info:', err);
  }

  // Register DisplayMediaRequestHandler to bypass standard system capture prompts in getDisplayMedia!
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    import('./ipc/handlers').then(({ getSelectedSourceForMediaRequest }) => {
      getSelectedSourceForMediaRequest().then((rawSource) => {
        if (rawSource) {
          callback({
            video: rawSource,
            enableLocalEcho: true
          });
        } else {
          callback({});
        }
      }).catch((err) => {
        console.error('[Main] Failed to get selected source:', err);
        callback({});
      });
    }).catch((err) => {
      console.error('[Main] Failed to import handlers:', err);
      callback({});
    });
  });

  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording: boolean, sourceName: string) => {
      selectedSourceName = sourceName
      if (!tray) createTray();
      updateTrayMenu(recording);
      if (!recording) {
        if (mainWindow) mainWindow.restore();
      }
    }
  )
  registerTranscriptionHandlers(() => mainWindow)
  registerIOSDeviceCaptureHandlers(() => mainWindow)
  ipcMain.handle('show-recorder', () => createRecordingWindowWrapper())
  createInitialWindow()
})
