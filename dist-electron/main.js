var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { ipcMain, screen, BrowserWindow, desktopCapturer, shell, app, dialog, nativeImage, protocol, session, Menu, Tray } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs$3 from "node:fs";
import fs$2 from "node:fs/promises";
import * as fs from "fs/promises";
import { uIOhook } from "uiohook-napi";
import { createRequire } from "node:module";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as fs$1 from "fs";
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL$1 = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
path$1.join(APP_ROOT, "dist");
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
      preload: path$1.join(__dirname$1, "preload.mjs"),
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
  {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=hud-overlay");
  }
  return win;
}
function createEditorWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    ...isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 },
      vibrancy: "popover",
      visualEffectState: "active"
    },
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    title: "toScreen",
    backgroundColor: isMac ? "#00000000" : "#f4f5f7",
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs"),
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
  {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=editor");
  }
  return win;
}
function createSettingsWindow() {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 720,
    height: 520,
    minWidth: 720,
    minHeight: 520,
    maxWidth: 720,
    maxHeight: 520,
    ...isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 14 },
      vibrancy: "popover",
      visualEffectState: "active"
    },
    title: "ToScreen Settings",
    backgroundColor: isMac ? "#00000000" : "#f4f5f7",
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=settings");
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
      preload: path$1.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  {
    win.loadURL(VITE_DEV_SERVER_URL$1 + "?windowType=source-selector");
  }
  return win;
}
function nativeInputTimeToMs(rawEventTime, platform) {
  if (!Number.isFinite(rawEventTime) || rawEventTime <= 0) return null;
  return platform === "darwin" ? rawEventTime / 1e6 : rawEventTime;
}
class NativeInputClock {
  constructor() {
    __publicField(this, "nativeToEpochOffsetMs", null);
  }
  reset() {
    this.nativeToEpochOffsetMs = null;
  }
  observe(rawEventTime, callbackEpochMs, platform) {
    const nativeTimeMs = nativeInputTimeToMs(rawEventTime, platform);
    if (nativeTimeMs === null || !Number.isFinite(callbackEpochMs)) return null;
    const offsetCandidate = callbackEpochMs - nativeTimeMs;
    if (this.nativeToEpochOffsetMs === null || offsetCandidate < this.nativeToEpochOffsetMs) {
      this.nativeToEpochOffsetMs = offsetCandidate;
    }
    return nativeTimeMs;
  }
  toEpoch(nativeTimeMs) {
    if (!Number.isFinite(nativeTimeMs) || this.nativeToEpochOffsetMs === null) return null;
    return nativeTimeMs + this.nativeToEpochOffsetMs;
  }
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
    __publicField(this, "primaryButtonDown", false);
    __publicField(this, "nativeClock", new NativeInputClock());
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
    this.nativeClock.reset();
    if (bounds) {
      this.recordingBounds = bounds;
    } else {
      const primaryDisplay = screen.getPrimaryDisplay();
      this.recordingBounds = {
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height
      };
    }
    const initialPosition = screen.getCursorScreenPoint();
    this.lastX = initialPosition.x;
    this.lastY = initialPosition.y;
    this.lastRecordedX = initialPosition.x;
    this.lastRecordedY = initialPosition.y;
    this.primaryButtonDown = false;
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
    this.primaryButtonDown = false;
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
   * Export click events to JSON file with absolute start time alignment
   */
  async exportToFile(outputPath, events, bounds, videoStartTime) {
    const timelineStartTime = videoStartTime || this.startTime;
    const processedEvents = events.map((e) => {
      const absoluteTime = e.nativeTimeMs !== void 0 ? this.nativeClock.toEpoch(e.nativeTimeMs) ?? e.absoluteTime : e.absoluteTime;
      return {
        ...e,
        absoluteTime,
        timestamp: absoluteTime - timelineStartTime
      };
    }).filter((e) => !videoStartTime || e.timestamp >= 0);
    const data = {
      recordingBounds: bounds,
      startTime: this.startTime,
      videoStartTime: videoStartTime || this.startTime,
      events: processedEvents
    };
    await fs.writeFile(
      outputPath,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
    this.events = [];
    this.recordingBounds = null;
    console.log("[MouseTracker] Exported to", outputPath, videoStartTime ? `with alignment relative to ${videoStartTime}` : "");
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
    this.lastMoveTime = 0;
    uIOhook.on("mousedown", (e) => {
      if (!this.isTracking) return;
      if (e.button === 1) {
        this.primaryButtonDown = true;
        this.addEvent(e.x, e.y, "mousedown", void 0, this.captureNativeEventTime(e.time));
      }
    });
    uIOhook.on("mouseup", (e) => {
      if (!this.isTracking) return;
      if (e.button === 1) {
        this.primaryButtonDown = false;
        this.addEvent(e.x, e.y, "mouseup", void 0, this.captureNativeEventTime(e.time));
      }
    });
    const handleMoveOrDrag = (x, y, rawEventTime) => {
      this.lastX = x;
      this.lastY = y;
      if (!this.isTracking) return;
      const nativeTimeMs = this.captureNativeEventTime(rawEventTime);
      const now = nativeTimeMs ?? Date.now();
      const timeElapsed = now - this.lastMoveTime;
      if (timeElapsed >= 16) {
        if (x !== this.lastRecordedX || y !== this.lastRecordedY) {
          this.addEvent(x, y, this.primaryButtonDown ? "drag" : "move", void 0, nativeTimeMs);
          this.lastRecordedX = x;
          this.lastRecordedY = y;
          this.lastMoveTime = now;
        }
      }
    };
    uIOhook.on("mousemove", (e) => {
      handleMoveOrDrag(e.x, e.y, e.time);
    });
    uIOhook.on("keydown", (e) => {
      if (!this.isTracking) return;
      this.addEvent(
        this.lastX,
        this.lastY,
        "keydown",
        { keycode: e.keycode },
        this.captureNativeEventTime(e.time)
      );
    });
    uIOhook.on("wheel", (e) => {
      if (!this.isTracking) return;
      this.addEvent(
        this.lastX,
        this.lastY,
        "wheel",
        { amount: e.amount, rotation: e.rotation },
        this.captureNativeEventTime(e.time)
      );
    });
    uIOhook.start();
    console.log("[MouseTracker] uIOhook started with extended action tracking");
  }
  stopGlobalTracking() {
    uIOhook.stop();
    uIOhook.removeAllListeners();
    console.log("[MouseTracker] uIOhook stopped");
  }
  captureNativeEventTime(rawEventTime) {
    if (!Number.isFinite(rawEventTime) || rawEventTime <= 0) return void 0;
    return this.nativeClock.observe(rawEventTime, Date.now(), process.platform) ?? void 0;
  }
  addEvent(x, y, type, data, nativeTimeMs) {
    if (!this.isTracking || !this.recordingBounds) {
      return;
    }
    const absoluteTime = nativeTimeMs !== void 0 ? this.nativeClock.toEpoch(nativeTimeMs) ?? Date.now() : Date.now();
    const timestamp = absoluteTime - this.startTime;
    const cx = (x - this.recordingBounds.x) / this.recordingBounds.width;
    const cy = (y - this.recordingBounds.y) / this.recordingBounds.height;
    const event = {
      timestamp,
      absoluteTime,
      nativeTimeMs,
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
  }
}
const mouseTracker = new MouseTracker();
const require2 = createRequire(import.meta.url);
let MacRecorder = null;
let recorderInstance = null;
let nativeBinding = null;
try {
  MacRecorder = require2("node-mac-recorder");
  try {
    const recorderEntry = require2.resolve("node-mac-recorder");
    nativeBinding = require2(path$1.join(path$1.dirname(recorderEntry), "build", "Release", "mac_recorder.node"));
  } catch (bindingError) {
    console.warn("[NativeRecorder] Video start clock is unavailable:", bindingError.message);
  }
} catch (e) {
  console.warn("[NativeRecorder] node-mac-recorder not available on this platform:", e.message);
}
let isRecording = false;
let currentOutputPath = null;
let currentVideoStartTime = null;
async function readVideoStartTime(minimumStartTime, timeoutMs = 2500) {
  if (!(nativeBinding == null ? void 0 : nativeBinding.getVideoStartTimestamp)) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const timestamp = Number(nativeBinding.getVideoStartTimestamp());
    if (Number.isFinite(timestamp) && timestamp >= minimumStartTime) return timestamp;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return null;
}
function isNativeRecordingAvailable() {
  if (!MacRecorder) return false;
  if (process.platform !== "darwin") return false;
  return true;
}
async function startNativeRecording(options) {
  if (!MacRecorder) {
    return { success: false, error: "node-mac-recorder is not available on this platform" };
  }
  if (isRecording) {
    return { success: false, error: "A recording is already in progress" };
  }
  try {
    const timestamp = Date.now();
    const fileName = `recording-${timestamp}.mov`;
    currentOutputPath = path$1.join(RECORDINGS_DIR, fileName);
    recorderInstance = new MacRecorder();
    await recorderInstance.startRecording(currentOutputPath, {
      captureCursor: (options == null ? void 0 : options.showCursor) === void 0 ? false : options.showCursor,
      // node-mac-recorder 期望 captureCursor
      frameRate: (options == null ? void 0 : options.fps) ?? 60,
      displayId: (options == null ? void 0 : options.displayId) ?? null,
      includeMicrophone: true,
      includeSystemAudio: true
    });
    const detectedVideoStartTime = await readVideoStartTime(timestamp);
    currentVideoStartTime = detectedVideoStartTime && detectedVideoStartTime >= timestamp ? detectedVideoStartTime : timestamp;
    isRecording = true;
    console.log(`[NativeRecorder] Recording started → ${currentOutputPath}`, {
      captureCursor: (options == null ? void 0 : options.showCursor) ?? false,
      fps: (options == null ? void 0 : options.fps) ?? 60,
      displayId: (options == null ? void 0 : options.displayId) ?? null,
      videoStartTime: currentVideoStartTime
    });
    return {
      success: true,
      outputPath: currentOutputPath,
      videoStartTime: currentVideoStartTime || void 0
    };
  } catch (error) {
    console.error("[NativeRecorder] Failed to start recording:", error);
    isRecording = false;
    currentOutputPath = null;
    currentVideoStartTime = null;
    return { success: false, error: String(error) };
  }
}
async function stopNativeRecording() {
  if (!recorderInstance || !isRecording) {
    return { success: false, error: "No active recording to stop" };
  }
  try {
    const result = await recorderInstance.stopRecording();
    const outputPath = (result == null ? void 0 : result.outputPath) || currentOutputPath;
    console.log("[NativeRecorder] Recording stopped:", {
      outputPath,
      result
    });
    isRecording = false;
    currentOutputPath = null;
    recorderInstance = null;
    const videoStartTime = currentVideoStartTime;
    currentVideoStartTime = null;
    return {
      success: true,
      outputPath: outputPath || void 0,
      audioOutputPath: (result == null ? void 0 : result.audioOutputPath) || void 0,
      videoStartTime: videoStartTime || void 0
    };
  } catch (error) {
    console.error("[NativeRecorder] Failed to stop recording:", error);
    isRecording = false;
    currentOutputPath = null;
    recorderInstance = null;
    currentVideoStartTime = null;
    return { success: false, error: String(error) };
  }
}
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const PROXY_TIMELINE_VERSION = 4;
const activeProxyJobs = /* @__PURE__ */ new Map();
function metadataPathForProxy(proxyPath) {
  return `${proxyPath}.meta.json`;
}
function hasCurrentProxyMetadata(inputPath, proxyPath) {
  try {
    if (!fs$1.existsSync(proxyPath)) return false;
    const sourceStat = fs$1.statSync(inputPath);
    const metadata = JSON.parse(
      fs$1.readFileSync(metadataPathForProxy(proxyPath), "utf8")
    );
    return metadata.timelineVersion === PROXY_TIMELINE_VERSION && metadata.sourceSize === sourceStat.size && Math.abs(metadata.sourceMtimeMs - sourceStat.mtimeMs) < 1;
  } catch {
    return false;
  }
}
function writeProxyMetadata(inputPath, proxyPath) {
  const sourceStat = fs$1.statSync(inputPath);
  const metadata = {
    timelineVersion: PROXY_TIMELINE_VERSION,
    sourceSize: sourceStat.size,
    sourceMtimeMs: sourceStat.mtimeMs
  };
  fs$1.writeFileSync(metadataPathForProxy(proxyPath), JSON.stringify(metadata, null, 2));
}
function generateProxyVideo(inputPath, onProgress) {
  const parsedPath = path.parse(inputPath);
  const outputPath = path.join(parsedPath.dir, `${parsedPath.name}-proxy.mp4`);
  if (hasCurrentProxyMetadata(inputPath, outputPath)) {
    console.log(`[ProxyGenerator] Proxy already exists at ${outputPath}`);
    return Promise.resolve({ success: true, proxyPath: outputPath });
  }
  const activeJob = activeProxyJobs.get(outputPath);
  if (activeJob) {
    if (onProgress) activeJob.progressListeners.add(onProgress);
    console.log(`[ProxyGenerator] Reusing active proxy generation for ${inputPath}`);
    return activeJob.promise;
  }
  const progressListeners = /* @__PURE__ */ new Set();
  if (onProgress) progressListeners.add(onProgress);
  const promise = new Promise((resolve) => {
    try {
      const temporaryOutputPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}-proxy.building-${process.pid}.mp4`
      );
      const metadataPath = metadataPathForProxy(outputPath);
      if (fs$1.existsSync(metadataPath)) fs$1.unlinkSync(metadataPath);
      if (fs$1.existsSync(temporaryOutputPath)) fs$1.unlinkSync(temporaryOutputPath);
      console.log(`[ProxyGenerator] Starting proxy generation for ${inputPath} -> ${outputPath}`);
      let settled = false;
      ffmpeg(inputPath).videoFilters("fps=fps=30:start_time=0:round=near,setpts=PTS-STARTPTS").outputOptions([
        "-c:v libx264",
        // H264 codec for max web compatibility
        "-crf 23",
        // Better quality for editing preview
        "-preset ultrafast",
        // Fastest encoding speed
        "-vsync cfr",
        // Preserve a deterministic 30fps media timeline
        "-c:a aac",
        // AAC audio
        "-b:a 128k",
        // Basic audio bitrate
        "-pix_fmt yuv420p"
        // Standard pixel format for HTML5 video
      ]).on("progress", (progress) => {
        if (progress.percent) {
          const percent = Math.floor(progress.percent);
          progressListeners.forEach((listener) => listener(percent));
        }
      }).on("end", () => {
        if (settled) return;
        settled = true;
        try {
          fs$1.renameSync(temporaryOutputPath, outputPath);
          writeProxyMetadata(inputPath, outputPath);
          console.log(`[ProxyGenerator] Successfully generated proxy at ${outputPath}`);
          resolve({ success: true, proxyPath: outputPath });
        } catch (error) {
          if (fs$1.existsSync(temporaryOutputPath)) fs$1.unlinkSync(temporaryOutputPath);
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(`[ProxyGenerator] Failed to finalize proxy:`, error);
          resolve({ success: false, error: message });
        }
      }).on("error", (err) => {
        if (settled) return;
        settled = true;
        if (fs$1.existsSync(temporaryOutputPath)) fs$1.unlinkSync(temporaryOutputPath);
        console.error(`[ProxyGenerator] Error generating proxy:`, err);
        resolve({ success: false, error: err.message });
      }).save(temporaryOutputPath);
    } catch (error) {
      console.error(`[ProxyGenerator] Exception:`, error);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  activeProxyJobs.set(outputPath, { promise, progressListeners });
  void promise.finally(() => {
    var _a;
    if (((_a = activeProxyJobs.get(outputPath)) == null ? void 0 : _a.promise) === promise) {
      activeProxyJobs.delete(outputPath);
    }
  });
  return promise;
}
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function resolveCursorTimelineStart(nativeEvents, fallbackTimelineStart) {
  const fallback = finiteNumber(fallbackTimelineStart);
  if (fallback !== null && fallback > 0) return fallback;
  if (Array.isArray(nativeEvents)) {
    for (const eventValue of nativeEvents) {
      const event = eventValue;
      const metadata = event == null ? void 0 : event._syncMetadata;
      const metadataStart = finiteNumber(metadata == null ? void 0 : metadata.videoStartTime);
      if (metadataStart !== null && metadataStart > 0) return metadataStart;
    }
  }
  return void 0;
}
function rebaseCursorEventsToTimeline(events, timelineStartTime) {
  if (!Number.isFinite(timelineStartTime)) return [...events];
  return events.flatMap((event) => {
    const absoluteTime = finiteNumber(event.absoluteTime ?? event.unixTimeMs);
    if (absoluteTime === null) return [{ ...event }];
    const timestamp = absoluteTime - Number(timelineStartTime);
    return timestamp >= 0 ? [{ ...event, timestamp }] : [];
  });
}
function normalizeNativeCursorEvents(events, timelineStartTime) {
  if (!Array.isArray(events)) return [];
  const resolvedTimelineStart = resolveCursorTimelineStart(events, timelineStartTime);
  let pointerDown = false;
  return events.flatMap((eventValue) => {
    var _a, _b, _c, _d;
    const event = eventValue;
    const unixTimeMs = finiteNumber(event == null ? void 0 : event.unixTimeMs);
    const sourceTimestamp = finiteNumber(event == null ? void 0 : event.timestamp);
    const timestamp = unixTimeMs !== null && Number.isFinite(resolvedTimelineStart) ? unixTimeMs - Number(resolvedTimelineStart) : sourceTimestamp;
    const x = finiteNumber(event == null ? void 0 : event.x);
    const y = finiteNumber(event == null ? void 0 : event.y);
    const width = finiteNumber(((_a = event == null ? void 0 : event.videoInfo) == null ? void 0 : _a.width) ?? ((_b = event == null ? void 0 : event.displayInfo) == null ? void 0 : _b.width));
    const height = finiteNumber(((_c = event == null ? void 0 : event.videoInfo) == null ? void 0 : _c.height) ?? ((_d = event == null ? void 0 : event.displayInfo) == null ? void 0 : _d.height));
    if (timestamp === null || timestamp < 0 || x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
      return [];
    }
    const type = String(event.type || "move");
    if (type === "mousedown" || type === "drag") pointerDown = true;
    if (type === "mouseup") pointerDown = false;
    return [{
      ...event,
      timestamp,
      absoluteTime: unixTimeMs ?? void 0,
      x,
      y,
      cx: clamp01(x / width),
      cy: clamp01(y / height),
      cursorType: typeof event.cursorType === "string" ? event.cursorType : "default",
      isClick: type === "click" || type === "mousedown",
      isPointerDown: pointerDown
    }];
  });
}
function positionAtTimestamp(events, timestamp) {
  if (events.length === 0) return null;
  let rightIndex = events.findIndex((event) => event.timestamp > timestamp);
  if (rightIndex === -1) rightIndex = events.length;
  const left = events[Math.max(0, rightIndex - 1)];
  const right = events[Math.min(events.length - 1, rightIndex)];
  const leftCx = finiteNumber(left.cx);
  const leftCy = finiteNumber(left.cy);
  const rightCx = finiteNumber(right.cx);
  const rightCy = finiteNumber(right.cy);
  if (leftCx === null || leftCy === null || rightCx === null || rightCy === null) return null;
  const duration = right.timestamp - left.timestamp;
  const progress = duration > 0 && duration <= 120 ? clamp01((timestamp - left.timestamp) / duration) : 0;
  const cx = leftCx + (rightCx - leftCx) * progress;
  const cy = leftCy + (rightCy - leftCy) * progress;
  return {
    x: cx,
    y: cy,
    cx,
    cy,
    isPointerDown: left.isPointerDown
  };
}
function mergeCursorShapeTelemetry(preciseEvents, nativeEvents) {
  if (preciseEvents.length === 0) return [...nativeEvents];
  if (nativeEvents.length === 0) return [...preciseEvents];
  const precise = [...preciseEvents].sort((a, b) => a.timestamp - b.timestamp);
  const native = [...nativeEvents].sort((a, b) => a.timestamp - b.timestamp);
  let nativeIndex = -1;
  let activeCursorType = "default";
  const typedPrecise = precise.map((event) => {
    while (nativeIndex + 1 < native.length && native[nativeIndex + 1].timestamp <= event.timestamp) {
      nativeIndex += 1;
      activeCursorType = native[nativeIndex].cursorType || activeCursorType;
    }
    return {
      ...event,
      cursorType: event.cursorType || activeCursorType
    };
  });
  let previousCursorType = null;
  const shapeTransitions = native.flatMap((event) => {
    const cursorType = event.cursorType || "default";
    if (cursorType === previousCursorType) return [];
    previousCursorType = cursorType;
    const position = positionAtTimestamp(typedPrecise, event.timestamp);
    if (!position) return [];
    return [{
      ...event,
      ...position,
      type: "move",
      isClick: false,
      cursorType
    }];
  });
  return [...typedPrecise, ...shapeTransitions].sort((a, b) => a.timestamp - b.timestamp);
}
function normalizeMediaPath(mediaPath) {
  const trimmedPath = mediaPath.trim();
  if (!trimmedPath) return trimmedPath;
  if (trimmedPath.startsWith("file://")) {
    try {
      return fileURLToPath(trimmedPath);
    } catch {
      return decodePath(trimmedPath.replace(/^file:\/\/\//, "/").replace(/^file:\/\//, ""));
    }
  }
  return decodePath(trimmedPath);
}
function projectPathForMediaPath(mediaPath) {
  const normalizedPath = normalizeMediaPath(mediaPath);
  const parsed = path$1.parse(normalizedPath);
  const projectBaseName = parsed.name.endsWith("-proxy") ? parsed.name.slice(0, -"-proxy".length) : parsed.name;
  return path$1.join(parsed.dir, `${projectBaseName}.project.json`);
}
function projectPathCandidatesForMediaPath(mediaPath) {
  const normalizedPath = normalizeMediaPath(mediaPath);
  const parsed = path$1.parse(normalizedPath);
  const canonicalProjectPath = projectPathForMediaPath(normalizedPath);
  const exactProjectPath = path$1.join(parsed.dir, `${parsed.name}.project.json`);
  return Array.from(/* @__PURE__ */ new Set([canonicalProjectPath, exactProjectPath]));
}
function companionAudioPathCandidatesForMediaPath(mediaPath) {
  var _a;
  const normalizedPath = normalizeMediaPath(mediaPath);
  const parsed = path$1.parse(normalizedPath);
  const baseName = parsed.name.endsWith("-proxy") ? parsed.name.slice(0, -"-proxy".length) : parsed.name;
  const timestamp = (_a = baseName.match(/^recording-(.+)$/)) == null ? void 0 : _a[1];
  const audioExtensions = [".mov", ".m4a", ".wav", ".aac"];
  const candidateBases = [
    `${baseName}-audio`,
    `${baseName}.audio`,
    timestamp ? `temp_audio_${timestamp}` : void 0,
    timestamp ? `temp_audio-${timestamp}` : void 0
  ].filter((value) => Boolean(value));
  return Array.from(new Set(
    candidateBases.flatMap((candidateBase) => audioExtensions.map((extension) => path$1.join(parsed.dir, `${candidateBase}${extension}`)))
  ));
}
function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
let selectedSource = null;
function nativeCursorPathForMediaPath(mediaPath) {
  var _a;
  const parsed = path$1.parse(mediaPath);
  const timestamp = (_a = parsed.name.match(/(?:^|[-_])(\d{13})$/)) == null ? void 0 : _a[1];
  return timestamp ? path$1.join(parsed.dir, `temp_cursor_${timestamp}.json`) : null;
}
function hasPreciseEventClock(events) {
  return events.some((event) => Number.isFinite(Number(event == null ? void 0 : event.nativeTimeMs)));
}
async function getSelectedSourceForMediaRequest() {
  if (!selectedSource) return null;
  const types = selectedSource.id.startsWith("screen") ? ["screen"] : ["window"];
  try {
    const sources = await desktopCapturer.getSources({ types });
    const matched = sources.find((s) => s.id === selectedSource.id);
    if (matched) return matched;
    return sources[0] || null;
  } catch (err) {
    console.error("[IPC] Failed to query raw media source:", err);
    return null;
  }
}
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
      const videoPath = path$1.join(RECORDINGS_DIR, fileName);
      await fs$2.writeFile(videoPath, Buffer.from(videoData));
      currentVideoPath = videoPath;
      const tempClicksPath = path$1.join(RECORDINGS_DIR, "temp-clicks.json");
      const clicksPath = videoPath + ".clicks.json";
      try {
        await fs$2.access(tempClicksPath);
        await fs$2.rename(tempClicksPath, clicksPath);
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
      const files = await fs$2.readdir(RECORDINGS_DIR);
      const videoFiles = files.filter((file) => file.startsWith("recording-") && (file.endsWith(".webm") || file.endsWith(".mov")));
      if (videoFiles.length === 0) {
        return { success: false, message: "No recorded video found" };
      }
      const latestVideo = videoFiles.sort().reverse()[0];
      const videoPath = path$1.join(RECORDINGS_DIR, latestVideo);
      const proxyResult = await generateProxyVideo(videoPath);
      const audioPath = await findFirstExistingPath(companionAudioPathCandidatesForMediaPath(videoPath));
      return {
        success: true,
        path: videoPath,
        proxyPath: proxyResult.success ? proxyResult.proxyPath : void 0,
        audioPath
      };
    } catch (error) {
      console.error("Failed to get video path:", error);
      return { success: false, message: "Failed to get video path", error: String(error) };
    }
  });
  ipcMain.handle("is-native-recording-available", () => {
    return isNativeRecordingAvailable();
  });
  ipcMain.handle("start-native-recording", async () => {
    const isAvailable = isNativeRecordingAvailable();
    if (!isAvailable) {
      return { success: false, error: "Native recording is not available on this platform." };
    }
    let recordingBounds = void 0;
    let displayId = void 0;
    if (selectedSource && selectedSource.id.startsWith("screen")) {
      try {
        const displays = screen.getAllDisplays();
        const matchedDisplay = displays.find((d) => {
          var _a;
          return d.id.toString() === ((_a = selectedSource.display_id) == null ? void 0 : _a.toString());
        });
        if (matchedDisplay) {
          recordingBounds = {
            x: matchedDisplay.bounds.x,
            y: matchedDisplay.bounds.y,
            width: matchedDisplay.bounds.width,
            height: matchedDisplay.bounds.height
          };
          displayId = Number(matchedDisplay.id);
        }
      } catch (err) {
        console.error("[IPC] Failed to resolve recording bounds:", err);
      }
    }
    mouseTracker.start(recordingBounds);
    const result = await startNativeRecording({ showCursor: false, displayId });
    if (result.success) {
      const mainWin = getMainWindow();
      if (mainWin) {
        mainWin.minimize();
      }
      if (onRecordingStateChange) {
        const sourceName = (selectedSource == null ? void 0 : selectedSource.name) || "Screen";
        onRecordingStateChange(true, sourceName);
      }
    } else {
      mouseTracker.stop();
    }
    return result;
  });
  ipcMain.handle("stop-native-recording", async () => {
    const { events, bounds } = mouseTracker.stop();
    const result = await stopNativeRecording();
    if (result.success && result.outputPath) {
      if (events.length > 0) {
        try {
          const clicksPath = result.outputPath + ".clicks.json";
          await mouseTracker.exportToFile(clicksPath, events, bounds, result.videoStartTime);
          console.log("[IPC] Exported clicks to native recording path:", clicksPath);
        } catch (error) {
          console.error("[IPC] Failed to export clicks for native recording:", error);
        }
      }
      currentVideoPath = result.outputPath;
      currentAudioPath = result.audioOutputPath || null;
    }
    const mainWin = getMainWindow();
    if (mainWin) {
      mainWin.restore();
      mainWin.focus();
    }
    if (onRecordingStateChange) {
      onRecordingStateChange(false, (selectedSource == null ? void 0 : selectedSource.name) || "Screen");
    }
    return result;
  });
  ipcMain.handle("set-recording-state", async (_, recording, videoStartTime) => {
    const source = selectedSource || { name: "Screen" };
    if (recording) {
      let recordingBounds = void 0;
      if (selectedSource && selectedSource.id.startsWith("screen")) {
        try {
          const displays = screen.getAllDisplays();
          const matchedDisplay = displays.find((d) => {
            var _a;
            return d.id.toString() === ((_a = selectedSource.display_id) == null ? void 0 : _a.toString());
          });
          if (matchedDisplay) {
            recordingBounds = {
              x: matchedDisplay.bounds.x,
              y: matchedDisplay.bounds.y,
              width: matchedDisplay.bounds.width,
              height: matchedDisplay.bounds.height
            };
            console.log("[IPC] Matched recording display bounds:", recordingBounds);
          }
        } catch (err) {
          console.error("[IPC] Failed to resolve recording bounds:", err);
        }
      }
      mouseTracker.start(recordingBounds);
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
          const clicksFilePath = path$1.join(RECORDINGS_DIR, "temp-clicks.json");
          await mouseTracker.exportToFile(clicksFilePath, events, bounds, videoStartTime);
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
        return path$1.join(process.resourcesPath, "assets");
      }
      return path$1.join(app.getAppPath(), "public", "assets");
    } catch (err) {
      console.error("Failed to resolve asset base path:", err);
      return null;
    }
  });
  ipcMain.handle("save-exported-video", async (_, videoData, fileName) => {
    try {
      const result = await dialog.showSaveDialog({
        title: "Save Exported Video",
        defaultPath: path$1.join(app.getPath("downloads"), fileName),
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
      await fs$2.writeFile(result.filePath, Buffer.from(videoData));
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
  let currentProxyPath = null;
  let currentAudioPath = null;
  ipcMain.handle("set-current-video-path", (_, path2, proxyPath, audioPath) => {
    currentVideoPath = path2;
    currentProxyPath = proxyPath || null;
    currentAudioPath = audioPath || null;
    return { success: true };
  });
  ipcMain.handle("get-current-video-path", () => {
    return currentVideoPath ? { success: true, path: currentVideoPath, proxyPath: currentProxyPath, audioPath: currentAudioPath } : { success: false };
  });
  ipcMain.handle("clear-current-video-path", () => {
    currentVideoPath = null;
    currentProxyPath = null;
    currentAudioPath = null;
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
    const normalizedPath = normalizeMediaPath(videoPath);
    let eventDrivenClicks = [];
    let eventTimelineStartTime;
    try {
      const clicksPath = normalizedPath + ".clicks.json";
      const content = await fs$2.readFile(clicksPath, "utf-8");
      const data = JSON.parse(content);
      eventDrivenClicks = Array.isArray(data) ? data : data.events || [];
      const parsedTimelineStart = Number(Array.isArray(data) ? void 0 : data.videoStartTime);
      eventTimelineStartTime = Number.isFinite(parsedTimelineStart) ? parsedTimelineStart : void 0;
    } catch {
    }
    const nativeCursorPath = nativeCursorPathForMediaPath(normalizedPath);
    let nativeEvents = [];
    if (nativeCursorPath) {
      try {
        const nativeContent = await fs$2.readFile(nativeCursorPath, "utf-8");
        const rawNativeEvents = JSON.parse(nativeContent);
        const resolvedTimelineStart = resolveCursorTimelineStart(rawNativeEvents, eventTimelineStartTime);
        nativeEvents = normalizeNativeCursorEvents(rawNativeEvents, resolvedTimelineStart);
        eventDrivenClicks = rebaseCursorEventsToTimeline(eventDrivenClicks, resolvedTimelineStart);
      } catch {
      }
    }
    if (eventDrivenClicks.length > 0 && hasPreciseEventClock(eventDrivenClicks)) {
      const mergedEvents = mergeCursorShapeTelemetry(eventDrivenClicks, nativeEvents);
      return {
        success: true,
        clicks: mergedEvents,
        source: nativeEvents.length > 0 ? "event-cursor-with-native-shapes" : "event-cursor"
      };
    }
    if (nativeEvents.length > 0) {
      return { success: true, clicks: nativeEvents, source: "native-cursor" };
    }
    if (eventDrivenClicks.length > 0) {
      return { success: true, clicks: eventDrivenClicks, source: "legacy-clicks" };
    }
    return { success: false, message: "No clicks file found" };
  });
  ipcMain.handle("save-project", async (_, videoPath, projectData) => {
    try {
      if (!videoPath) return { success: false, message: "No video path provided" };
      const projectPath = projectPathForMediaPath(videoPath);
      await fs$2.writeFile(projectPath, JSON.stringify(projectData, null, 2), "utf8");
      return { success: true };
    } catch (error) {
      console.error("[IPC] Failed to save project:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("load-project", async (_, videoPath) => {
    try {
      if (!videoPath) return { success: false, message: "No video path provided" };
      const candidates = projectPathCandidatesForMediaPath(videoPath);
      for (const projectPath of candidates) {
        try {
          const rawData = await fs$2.readFile(projectPath, "utf8");
          return { success: true, project: JSON.parse(rawData), projectPath };
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? error.code : void 0;
          if (code && code !== "ENOENT") throw error;
        }
      }
      return { success: false, message: "No project file found" };
    } catch (error) {
      console.error("[IPC] Failed to load project:", error);
      return { success: false, message: "Failed to load project", error: String(error) };
    }
  });
  ipcMain.handle("generate-proxy-video", async (event, inputPath) => {
    try {
      const normalizedPath = normalizeMediaPath(inputPath);
      const result = await generateProxyVideo(normalizedPath, (progressPercent) => {
        event.sender.send("proxy-generation-progress", progressPercent);
      });
      return result;
    } catch (error) {
      console.error("[IPC] Failed to generate proxy:", error);
      return { success: false, error: String(error) };
    }
  });
}
async function findFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    const exists = await fs$2.access(candidate).then(() => true).catch(() => false);
    if (exists) return candidate;
  }
  return void 0;
}
const handlers = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getSelectedSourceForMediaRequest,
  registerIpcHandlers
}, Symbol.toStringTag, { value: "Module" }));
const CURSOR_STYLE_PRESETS = [
  "toscreen",
  "system",
  "light",
  "blue",
  "yellow",
  "pink",
  "custom"
];
const DEFAULT_CURSOR_STYLE = "toscreen";
function isCursorStylePreset(value) {
  return typeof value === "string" && CURSOR_STYLE_PRESETS.includes(value);
}
function resolveCursorStyle(value, legacyVectorCursor = true) {
  if (isCursorStylePreset(value)) return value;
  return legacyVectorCursor ? DEFAULT_CURSOR_STYLE : "system";
}
const DEFAULT_EDITOR_PREFERENCES = {
  theme: "light",
  aspectRatio: "16:9",
  exportQuality: "good",
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorStyle: DEFAULT_CURSOR_STYLE,
  motionBlurEnabled: true,
  padding: 60,
  borderRadius: 20,
  shadowIntensity: 0.6,
  lastSettingsPane: "general"
};
const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "4:5"];
const EXPORT_QUALITIES = ["medium", "good", "source"];
const SETTINGS_PANES = ["general", "editing", "export", "shortcuts"];
const APP_THEMES = ["light", "dark"];
function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function sanitizeEditorPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const cursorStyle = resolveCursorStyle(
    input.cursorStyle,
    typeof input.showVectorCursor === "boolean" ? input.showVectorCursor : DEFAULT_EDITOR_PREFERENCES.showVectorCursor
  );
  return {
    theme: APP_THEMES.includes(input.theme) ? input.theme : DEFAULT_EDITOR_PREFERENCES.theme,
    aspectRatio: ASPECT_RATIOS.includes(input.aspectRatio) ? input.aspectRatio : DEFAULT_EDITOR_PREFERENCES.aspectRatio,
    exportQuality: EXPORT_QUALITIES.includes(input.exportQuality) ? input.exportQuality : DEFAULT_EDITOR_PREFERENCES.exportQuality,
    cursorSize: clampNumber(input.cursorSize, DEFAULT_EDITOR_PREFERENCES.cursorSize, 0.5, 3),
    cursorSmoothing: typeof input.cursorSmoothing === "boolean" ? input.cursorSmoothing : DEFAULT_EDITOR_PREFERENCES.cursorSmoothing,
    showVectorCursor: cursorStyle !== "system",
    cursorStyle,
    motionBlurEnabled: typeof input.motionBlurEnabled === "boolean" ? input.motionBlurEnabled : DEFAULT_EDITOR_PREFERENCES.motionBlurEnabled,
    padding: clampNumber(input.padding, DEFAULT_EDITOR_PREFERENCES.padding, 0, 200),
    borderRadius: clampNumber(input.borderRadius, DEFAULT_EDITOR_PREFERENCES.borderRadius, 0, 50),
    shadowIntensity: clampNumber(input.shadowIntensity, DEFAULT_EDITOR_PREFERENCES.shadowIntensity, 0, 1),
    lastSettingsPane: SETTINGS_PANES.includes(input.lastSettingsPane) ? input.lastSettingsPane : DEFAULT_EDITOR_PREFERENCES.lastSettingsPane
  };
}
const PREFERENCES_FILE_NAME = "editor-preferences.json";
let writeQueue = Promise.resolve();
function getPreferencesPath() {
  return path$1.join(app.getPath("userData"), PREFERENCES_FILE_NAME);
}
function readEditorPreferences() {
  try {
    const raw = fs$3.readFileSync(getPreferencesPath(), "utf8");
    return sanitizeEditorPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_EDITOR_PREFERENCES };
  }
}
async function persistEditorPreferences(value) {
  const preferences = sanitizeEditorPreferences(value);
  const preferencesPath = getPreferencesPath();
  const temporaryPath = `${preferencesPath}.tmp`;
  writeQueue = writeQueue.catch(() => void 0).then(async () => {
    await fs$3.promises.mkdir(path$1.dirname(preferencesPath), { recursive: true });
    await fs$3.promises.writeFile(temporaryPath, `${JSON.stringify(preferences, null, 2)}
`, "utf8");
    await fs$3.promises.rename(temporaryPath, preferencesPath);
  });
  await writeQueue;
  return preferences;
}
function notifyPreferencesChanged(preferences) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("editor-preferences-updated", preferences);
    }
  });
}
function registerPreferenceIpcHandlers() {
  ipcMain.on("get-editor-preferences-sync", (event) => {
    event.returnValue = readEditorPreferences();
  });
  ipcMain.handle("save-editor-preferences", async (_event, value) => {
    try {
      const preferences = await persistEditorPreferences(value);
      notifyPreferencesChanged(preferences);
      return { success: true, preferences };
    } catch (error) {
      console.error("[Preferences] Failed to save editor preferences:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("reset-editor-preferences", async () => {
    try {
      const preferences = await persistEditorPreferences(DEFAULT_EDITOR_PREFERENCES);
      notifyPreferencesChanged(preferences);
      return { success: true, preferences };
    } catch (error) {
      console.error("[Preferences] Failed to reset editor preferences:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-angle", "gl");
}
const existingUserDataPath = path$1.join(app.getPath("appData"), "toscreen");
fs$3.mkdirSync(existingUserDataPath, { recursive: true });
app.setName("ToScreen");
app.setPath("userData", existingUserDataPath);
const __dirname = path$1.dirname(fileURLToPath(import.meta.url));
const wrapConsole = (method) => {
  const original = console[method];
  console[method] = (...args) => {
    try {
      original.apply(console, args);
    } catch (e) {
    }
  };
};
["log", "error", "warn", "info"].forEach((m) => wrapConsole(m));
const RECORDINGS_DIR = path$1.join(app.getPath("userData"), "recordings");
async function ensureRecordingsDir() {
  try {
    await fs$2.mkdir(RECORDINGS_DIR, { recursive: true });
    console.log("RECORDINGS_DIR:", RECORDINGS_DIR);
    console.log("User Data Path:", app.getPath("userData"));
  } catch (error) {
    console.error("Failed to create recordings directory:", error);
  }
}
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let mainWindow = null;
let sourceSelectorWindow = null;
let settingsWindow = null;
let tray = null;
let selectedSourceName = "";
let mainWindowMode = null;
let isQuitting = false;
const defaultTrayIcon = getTrayIcon("openscreen.png");
const recordingTrayIcon = getTrayIcon("rec-button.png");
function registerMainWindow(win, mode) {
  mainWindow = win;
  mainWindowMode = mode;
  win.on("closed", () => {
    if (mainWindow !== win) return;
    mainWindow = null;
    mainWindowMode = null;
    if (mode === "editor" && !isQuitting) {
      setTimeout(() => {
        if (!mainWindow && !isQuitting) {
          registerMainWindow(createHudOverlayWindow(), "hud");
        }
      }, 0);
    }
  });
}
function createInitialWindow() {
  if (VITE_DEV_SERVER_URL && process.env.TOSCREEN_DEV_WINDOW_TYPE === "editor") {
    registerMainWindow(createEditorWindow(), "editor");
    return;
  }
  registerMainWindow(createHudOverlayWindow(), "hud");
}
function showOrCreateMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  registerMainWindow(createHudOverlayWindow(), "hud");
}
function createTray() {
  tray = new Tray(defaultTrayIcon);
}
function getTrayIcon(filename) {
  return nativeImage.createFromPath(path$1.join(process.env.VITE_PUBLIC || RENDERER_DIST, filename)).resize({
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
        showOrCreateMainWindow();
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
  if (mainWindowMode === "editor" && mainWindow && !mainWindow.isDestroyed()) {
    showOrCreateMainWindow();
    return;
  }
  const previousWindow = mainWindow;
  registerMainWindow(createEditorWindow(), "editor");
  if (previousWindow && !previousWindow.isDestroyed()) previousWindow.close();
}
function createSourceSelectorWindowWrapper() {
  sourceSelectorWindow = createSourceSelectorWindow();
  sourceSelectorWindow.on("closed", () => {
    sourceSelectorWindow = null;
  });
  return sourceSelectorWindow;
}
function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = createSettingsWindow();
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}
function installApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [{
      label: "ToScreen",
      submenu: [
        { label: "About ToScreen", role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "CommandOrControl+,",
          click: showSettingsWindow
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { label: "Hide ToScreen", role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: "Quit ToScreen", role: "quit" }
      ]
    }] : [],
    {
      label: "File",
      submenu: [
        ...!isMac ? [{
          label: "Settings…",
          accelerator: "CommandOrControl+,",
          click: showSettingsWindow
        }, { type: "separator" }] : [],
        { role: "close" }
      ]
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "togglefullscreen" },
        ...VITE_DEV_SERVER_URL ? [
          { type: "separator" },
          { role: "reload" },
          { role: "toggleDevTools" }
        ] : []
      ]
    },
    { role: "windowMenu" }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
app.on("window-all-closed", () => {
});
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("activate", () => {
  showOrCreateMainWindow();
});
protocol.registerSchemesAsPrivileged([
  { scheme: "toscreen", privileges: { supportFetchAPI: true, bypassCSP: true, secure: true, corsEnabled: true } }
]);
app.whenReady().then(async () => {
  const { ipcMain: ipcMain2 } = await import("electron");
  ipcMain2.on("hud-overlay-close", () => {
    app.quit();
  });
  registerPreferenceIpcHandlers();
  installApplicationMenu();
  protocol.registerFileProtocol("toscreen", (request, callback) => {
    let url = request.url.substring(11);
    const queryIndex = url.indexOf("?");
    if (queryIndex !== -1) {
      url = url.substring(0, queryIndex);
    }
    try {
      callback({ path: decodeURIComponent(url) });
    } catch (error) {
      callback({ error: -2 });
    }
  });
  createTray();
  updateTrayMenu();
  await ensureRecordingsDir();
  try {
    const { screen: screen2 } = await import("electron");
    console.log("[DIAGNOSTIC] Primary Display Bounds:", screen2.getPrimaryDisplay().bounds, "Scale:", screen2.getPrimaryDisplay().scaleFactor);
    console.log("[DIAGNOSTIC] All Displays:", screen2.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor
    })));
  } catch (err) {
    console.error("[DIAGNOSTIC] Failed to print screen info:", err);
  }
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    Promise.resolve().then(() => handlers).then(({ getSelectedSourceForMediaRequest: getSelectedSourceForMediaRequest2 }) => {
      getSelectedSourceForMediaRequest2().then((rawSource) => {
        if (rawSource) {
          callback({
            video: rawSource,
            enableLocalEcho: true
          });
        } else {
          callback({});
        }
      }).catch((err) => {
        console.error("[Main] Failed to get selected source:", err);
        callback({});
      });
    }).catch((err) => {
      console.error("[Main] Failed to import handlers:", err);
      callback({});
    });
  });
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
  createInitialWindow();
});
export {
  MAIN_DIST,
  RECORDINGS_DIR,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
