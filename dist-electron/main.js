var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { ipcMain, screen, BrowserWindow, desktopCapturer, shell, app, dialog, nativeImage, Tray, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs$1 from "node:fs/promises";
import * as fs from "fs/promises";
import { uIOhook } from "uiohook-napi";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL$1 = process.env["VITE_DEV_SERVER_URL"];
const RENDERER_DIST$1 = path.join(APP_ROOT, "dist");
let hudOverlayWindow = null;
ipcMain.on("hud-overlay-hide", () => {
  if (hudOverlayWindow && !hudOverlayWindow.isDestroyed()) {
    hudOverlayWindow.minimize();
  }
});
function createHudOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const windowWidth = 960;
  const windowHeight = 240;
  const x = Math.floor(workArea.x + (workArea.width - windowWidth) / 2);
  const y = Math.floor(workArea.y + workArea.height - windowHeight / 2 - 80);
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    maxWidth: 1100,
    minHeight: 200,
    maxHeight: 400,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  hudOverlayWindow = win;
  win.on("closed", () => {
    if (hudOverlayWindow === win) {
      hudOverlayWindow = null;
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "hud-overlay" }
    });
  }
  return win;
}
function createEditorWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "toScreen",
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });
  win.center();
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "editor" }
    });
  }
  return win;
}
function createSourceSelectorWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((width - 620) / 2),
    y: Math.round((height - 420) / 2),
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL$1) {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  } else {
    win.loadFile(path.join(RENDERER_DIST$1, "index.html"), {
      query: { windowType: "source-selector" }
    });
  }
  return win;
}
class MouseTracker {
  constructor() {
    __publicField(this, "isTracking", false);
    __publicField(this, "startTime", 0);
    __publicField(this, "events", []);
    __publicField(this, "recordingBounds", null);
    __publicField(this, "lastX", 0);
    __publicField(this, "lastY", 0);
    __publicField(this, "lastMoveTime", 0);
    __publicField(this, "lastRecordedX", -1);
    __publicField(this, "lastRecordedY", -1);
    this.handleInputCheck();
  }
  // Proactively check if we have input monitoring permissions?
  // Doing this by just initializing the hook and seeing if it works is one way,
  // but typically we just start it when needed.
  handleInputCheck() {
  }
  /**
   * Start tracking mouse clicks for a recording session
   * @param bounds The screen area being recorded (for coordinate normalization)
   */
  start(bounds) {
    if (this.isTracking) {
      console.warn("[MouseTracker] Already tracking, stopping previous session");
      this.stop();
    }
    this.isTracking = true;
    this.startTime = Date.now();
    this.events = [];
    if (bounds) {
      this.recordingBounds = bounds;
    } else {
      const primaryDisplay = screen.getPrimaryDisplay();
      this.recordingBounds = {
        x: 0,
        y: 0,
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height
      };
    }
    this.startGlobalTracking();
    console.log("[MouseTracker] Started tracking", {
      bounds: this.recordingBounds,
      startTime: this.startTime
    });
  }
  /**
   * Stop tracking and return collected events
   */
  stop() {
    if (!this.isTracking) {
      uIOhook.stop();
      return { events: [], bounds: null };
    }
    this.isTracking = false;
    this.stopGlobalTracking();
    const capturedEvents = [...this.events];
    const capturedBounds = this.recordingBounds;
    console.log("[MouseTracker] Stopped tracking", {
      eventsCount: capturedEvents.length,
      duration: Date.now() - this.startTime
    });
    return { events: capturedEvents, bounds: capturedBounds };
  }
  /**
   * Export click events to JSON file
   */
  async exportToFile(outputPath, events, bounds) {
    const data = {
      recordingBounds: bounds,
      startTime: this.startTime,
      events
    };
    await fs.writeFile(
      outputPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    this.events = [];
    this.recordingBounds = null;
    console.log("[MouseTracker] Exported to", outputPath);
  }
  /**
   * Get current tracking status
   */
  getStatus() {
    return {
      isTracking: this.isTracking,
      eventCount: this.events.length
    };
  }
  startGlobalTracking() {
    this.lastRecordedX = this.lastX;
    this.lastRecordedY = this.lastY;
    this.lastMoveTime = Date.now();
    uIOhook.on("mousedown", (e) => {
      if (!this.isTracking) return;
      if (e.button === 1) {
        this.addEvent(e.x, e.y, "click");
      }
    });
    uIOhook.on("mousemove", (e) => {
      this.lastX = e.x;
      this.lastY = e.y;
      if (!this.isTracking) return;
      const now = Date.now();
      const dist = Math.sqrt(Math.pow(e.x - this.lastRecordedX, 2) + Math.pow(e.y - this.lastRecordedY, 2));
      if (dist > 100 || now - this.lastMoveTime > 1e3 && dist > 10) {
        this.addEvent(e.x, e.y, "move");
        this.lastRecordedX = e.x;
        this.lastRecordedY = e.y;
        this.lastMoveTime = now;
      }
    });
    uIOhook.on("keydown", (e) => {
      if (!this.isTracking) return;
      this.addEvent(this.lastX, this.lastY, "keydown", { keycode: e.keycode });
    });
    uIOhook.on("wheel", (e) => {
      if (!this.isTracking) return;
      this.addEvent(this.lastX, this.lastY, "wheel", { amount: e.amount, rotation: e.rotation });
    });
    uIOhook.start();
    console.log("[MouseTracker] uIOhook started with extended action tracking");
  }
  stopGlobalTracking() {
    uIOhook.stop();
    uIOhook.removeAllListeners();
    console.log("[MouseTracker] uIOhook stopped");
  }
  /**
   * Add an event to the session
   */
  addEvent(x, y, type, data) {
    if (!this.isTracking || !this.recordingBounds) {
      return;
    }
    const timestamp = Date.now() - this.startTime;
    const cx = (x - this.recordingBounds.x) / this.recordingBounds.width;
    const cy = (y - this.recordingBounds.y) / this.recordingBounds.height;
    const event = {
      timestamp,
      x,
      y,
      cx,
      cy,
      type,
      data
    };
    if (type === "keydown") {
      const lastEvent = this.events[this.events.length - 1];
      if (lastEvent && lastEvent.type === "keydown" && timestamp - lastEvent.timestamp < 100) {
        return;
      }
    }
    this.events.push(event);
    console.log(`[MouseTracker] ${type} recorded`, { x, y, timestamp, cx, cy });
  }
}
const mouseTracker = new MouseTracker();
let selectedSource = null;
function registerIpcHandlers(createEditorWindow2, createSourceSelectorWindow2, getMainWindow, getSourceSelectorWindow, onRecordingStateChange) {
  (async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      if (sources.length > 0) {
        selectedSource = {
          id: sources[0].id,
          name: sources[0].name,
          display_id: sources[0].display_id,
          thumbnail: sources[0].thumbnail.toDataURL(),
          appIcon: sources[0].appIcon ? sources[0].appIcon.toDataURL() : null
        };
        console.log("[IPC] Auto-selected source:", selectedSource.name);
      }
    } catch (err) {
      console.error("[IPC] Failed to auto-select source:", err);
    }
  })();
  ipcMain.handle("get-sources", async (_, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });
  ipcMain.handle("select-source", (_, source) => {
    selectedSource = source;
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.close();
    }
    return selectedSource;
  });
  ipcMain.handle("get-selected-source", () => {
    return selectedSource;
  });
  ipcMain.handle("open-source-selector", () => {
    const sourceSelectorWin = getSourceSelectorWindow();
    if (sourceSelectorWin) {
      sourceSelectorWin.focus();
      return;
    }
    createSourceSelectorWindow2();
  });
  ipcMain.handle("switch-to-editor", () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      mainWin.close();
    }
    createEditorWindow2();
  });
  ipcMain.handle("store-recorded-video", async (_, videoData, fileName) => {
    try {
      const videoPath = path.join(RECORDINGS_DIR, fileName);
      await fs$1.writeFile(videoPath, Buffer.from(videoData));
      currentVideoPath = videoPath;
      const tempClicksPath = path.join(RECORDINGS_DIR, "temp-clicks.json");
      const clicksPath = videoPath + ".clicks.json";
      try {
        await fs$1.access(tempClicksPath);
        await fs$1.rename(tempClicksPath, clicksPath);
        console.log(`[IPC] Associated clicks data with video: ${clicksPath}`);
      } catch (e) {
        console.log("[IPC] No temp clicks file to associate or failed to move");
      }
      return {
        success: true,
        path: videoPath,
        message: "Video stored successfully"
      };
    } catch (error) {
      console.error("Failed to store video:", error);
      return {
        success: false,
        message: "Failed to store video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("get-recorded-video-path", async () => {
    try {
      const files = await fs$1.readdir(RECORDINGS_DIR);
      const videoFiles = files.filter((file) => file.endsWith(".webm"));
      if (videoFiles.length === 0) {
        return { success: false, message: "No recorded video found" };
      }
      const latestVideo = videoFiles.sort().reverse()[0];
      const videoPath = path.join(RECORDINGS_DIR, latestVideo);
      return { success: true, path: videoPath };
    } catch (error) {
      console.error("Failed to get video path:", error);
      return { success: false, message: "Failed to get video path", error: String(error) };
    }
  });
  ipcMain.handle("set-recording-state", async (_, recording) => {
    const source = selectedSource || { name: "Screen" };
    if (recording) {
      mouseTracker.start();
      console.log("[IPC] Mouse tracking started for recording");
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.minimize();
      }
    } else {
      const { events, bounds } = mouseTracker.stop();
      console.log(`[IPC] Mouse tracking stopped, captured ${events.length} clicks`);
      if (events.length > 0) {
        try {
          const clicksFilePath = path.join(RECORDINGS_DIR, "temp-clicks.json");
          await mouseTracker.exportToFile(clicksFilePath, events, bounds);
          console.log("[IPC] Clicks exported to temp file", clicksFilePath);
        } catch (error) {
          console.error("[IPC] Failed to export clicks:", error);
        }
      } else {
        console.log("[IPC] No clicks recorded, skipping export");
      }
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.restore();
        mainWin.focus();
      }
    }
    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name);
    }
  });
  ipcMain.handle("open-external-url", async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open URL:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("get-asset-base-path", () => {
    try {
      if (app.isPackaged) {
        return path.join(process.resourcesPath, "assets");
      }
      return path.join(app.getAppPath(), "public", "assets");
    } catch (err) {
      console.error("Failed to resolve asset base path:", err);
      return null;
    }
  });
  ipcMain.handle("save-exported-video", async (_, videoData, fileName) => {
    try {
      const result = await dialog.showSaveDialog({
        title: "Save Exported Video",
        defaultPath: path.join(app.getPath("downloads"), fileName),
        filters: [
          { name: "MP4 Video", extensions: ["mp4"] }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      if (result.canceled || !result.filePath) {
        return {
          success: false,
          cancelled: true,
          message: "Export cancelled"
        };
      }
      await fs$1.writeFile(result.filePath, Buffer.from(videoData));
      return {
        success: true,
        path: result.filePath,
        message: "Video exported successfully"
      };
    } catch (error) {
      console.error("Failed to save exported video:", error);
      return {
        success: false,
        message: "Failed to save exported video",
        error: String(error)
      };
    }
  });
  ipcMain.handle("open-video-file-picker", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Select Video File",
        defaultPath: RECORDINGS_DIR,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error("Failed to open file picker:", error);
      return {
        success: false,
        message: "Failed to open file picker",
        error: String(error)
      };
    }
  });
  let currentVideoPath = null;
  ipcMain.handle("set-current-video-path", (_, path2) => {
    currentVideoPath = path2;
    return { success: true };
  });
  ipcMain.handle("get-current-video-path", () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });
  ipcMain.handle("clear-current-video-path", () => {
    currentVideoPath = null;
    return { success: true };
  });
  ipcMain.handle("get-platform", () => {
    return process.platform;
  });
  ipcMain.handle("record-mouse-click", (_, x, y) => {
    mouseTracker.addEvent(x, y, "click");
    return { success: true };
  });
  ipcMain.handle("get-mouse-tracking-status", () => {
    return mouseTracker.getStatus();
  });
  ipcMain.handle("read-clicks-json", async (_, videoPath) => {
    try {
      const normalizedPath = videoPath.replace("file://", "");
      const clicksPath = normalizedPath + ".clicks.json";
      const content = await fs$1.readFile(clicksPath, "utf-8");
      const data = JSON.parse(content);
      const clicks = Array.isArray(data) ? data : data.events || [];
      return { success: true, clicks };
    } catch (error) {
      return { success: false, message: "No clicks file found" };
    }
  });
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = path.join(app.getPath("userData"), "recordings");
async function ensureRecordingsDir() {
  try {
    await fs$1.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
    console.log("User Data Path:", app.getPath("userData"));
  } catch (error) {
    console.error("Failed to create recordings directory:", error);
  }
}
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
let tray = null;
let selectedSourceName = "";
const defaultTrayIcon = getTrayIcon("openscreen.png");
const recordingTrayIcon = getTrayIcon("rec-button.png");
function createWindow() {
  mainWindow = createHudOverlayWindow();
}
function createTray() {
  tray = new Tray(defaultTrayIcon);
}
function getTrayIcon(filename) {
  return nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function updateTrayMenu(recording = false) {
  if (!tray) return;
  const trayIcon = recording ? recordingTrayIcon : defaultTrayIcon;
  const trayToolTip = recording ? `Recording: ${selectedSourceName}` : "OpenScreen";
  const menuTemplate = recording ? [
    {
      label: "Stop Recording",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("stop-recording-from-tray");
        }
      }
    }
  ] : [
    {
      label: "Open",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.isMinimized() && mainWindow.restore();
        } else {
          createWindow();
        }
      }
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      }
    }
  ];
  tray.setImage(trayIcon);
  tray.setToolTip(trayToolTip);
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}
function createEditorWindowWrapper() {
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  mainWindow = createEditorWindow();
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
app.on("window-all-closed", () => {
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  const { ipcMain: ipcMain2 } = await import("electron");
  ipcMain2.on("hud-overlay-close", () => {
    app.quit();
  });
  createTray();
  updateTrayMenu();
  await ensureRecordingsDir();
  registerIpcHandlers(
    createEditorWindowWrapper,
    createSourceSelectorWindowWrapper,
    () => mainWindow,
    () => sourceSelectorWindow,
    (recording, sourceName) => {
      selectedSourceName = sourceName;
      if (!tray) createTray();
      updateTrayMenu(recording);
      if (!recording) {
        if (mainWindow) mainWindow.restore();
      }
    }
  );
  createWindow();
});
export {
  MAIN_DIST,
  RECORDINGS_DIR,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
