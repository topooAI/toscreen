import { app, BrowserWindow, Tray, Menu, nativeImage, session, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHudOverlayWindow, createEditorWindow, createSourceSelectorWindow } from './windows'
import { registerIpcHandlers } from './ipc/handlers'

// Electron 30 + macOS Metal/ANGLE can intermittently lose the GPU context after
// ScreenCaptureKit recording. Prefer the GL ANGLE backend in development so the
// Pixi preview does not disappear after an app restart or recording stop.
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('use-angle', 'gl')
}

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
let tray: Tray | null = null
let selectedSourceName = ''

// Tray Icons
const defaultTrayIcon = getTrayIcon('openscreen.png');
const recordingTrayIcon = getTrayIcon('rec-button.png');

function createWindow() {
  if (VITE_DEV_SERVER_URL && process.env.TOSCREEN_DEV_WINDOW_TYPE === 'editor') {
    mainWindow = createEditorWindow()
    return
  }
  mainWindow = createHudOverlayWindow()
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
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.isMinimized() && mainWindow.restore();
          } else {
            createWindow();
          }
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
  if (mainWindow) {
    mainWindow.close()
    mainWindow = null
  }
  mainWindow = createEditorWindow()
}

function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow()
  sourceSelectorWindow.on('closed', () => {
    sourceSelectorWindow = null
  })
  return sourceSelectorWindow
}

// On macOS, applications and their menu bar stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Keep app running (macOS behavior)
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
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
  createWindow()
})
