"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  hudOverlayHide: () => {
    electron.ipcRenderer.send("hud-overlay-hide");
  },
  hudOverlayClose: () => {
    electron.ipcRenderer.send("hud-overlay-close");
  },
  getAssetBasePath: async () => {
    return await electron.ipcRenderer.invoke("get-asset-base-path");
  },
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  },
  switchToEditor: () => {
    return electron.ipcRenderer.invoke("switch-to-editor");
  },
  openSourceSelector: () => {
    return electron.ipcRenderer.invoke("open-source-selector");
  },
  selectSource: (source) => {
    return electron.ipcRenderer.invoke("select-source", source);
  },
  getSelectedSource: () => {
    return electron.ipcRenderer.invoke("get-selected-source");
  },
  storeRecordedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("store-recorded-video", videoData, fileName);
  },
  getRecordedVideoPath: () => {
    return electron.ipcRenderer.invoke("get-recorded-video-path");
  },
  setRecordingState: (recording, videoStartTime) => {
    return electron.ipcRenderer.invoke("set-recording-state", recording, videoStartTime);
  },
  onStopRecordingFromTray: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("stop-recording-from-tray", listener);
    return () => electron.ipcRenderer.removeListener("stop-recording-from-tray", listener);
  },
  openExternalUrl: (url) => {
    return electron.ipcRenderer.invoke("open-external-url", url);
  },
  saveExportedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("save-exported-video", videoData, fileName);
  },
  openVideoFilePicker: () => {
    return electron.ipcRenderer.invoke("open-video-file-picker");
  },
  setCurrentVideoPath: (path, proxyPath) => {
    return electron.ipcRenderer.invoke("set-current-video-path", path, proxyPath);
  },
  getCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("get-current-video-path");
  },
  clearCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("clear-current-video-path");
  },
  getPlatform: () => {
    return electron.ipcRenderer.invoke("get-platform");
  },
  // Mouse Tracker APIs
  recordMouseClick: (x, y) => {
    return electron.ipcRenderer.invoke("record-mouse-click", x, y);
  },
  getMouseTrackingStatus: () => {
    return electron.ipcRenderer.invoke("get-mouse-tracking-status");
  },
  readClicksJson: (videoPath) => {
    return electron.ipcRenderer.invoke("read-clicks-json", videoPath);
  },
  isNativeRecordingAvailable: () => {
    return electron.ipcRenderer.invoke("is-native-recording-available");
  },
  startNativeRecording: () => {
    return electron.ipcRenderer.invoke("start-native-recording");
  },
  stopNativeRecording: () => {
    return electron.ipcRenderer.invoke("stop-native-recording");
  },
  generateProxyVideo: (inputPath) => {
    return electron.ipcRenderer.invoke("generate-proxy-video", inputPath);
  },
  saveProject: (videoPath, projectData) => {
    return electron.ipcRenderer.invoke("save-project", videoPath, projectData);
  },
  loadProject: (videoPath) => {
    return electron.ipcRenderer.invoke("load-project", videoPath);
  },
  onProxyGenerationProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    electron.ipcRenderer.on("proxy-generation-progress", listener);
    return () => electron.ipcRenderer.removeListener("proxy-generation-progress", listener);
  }
});
