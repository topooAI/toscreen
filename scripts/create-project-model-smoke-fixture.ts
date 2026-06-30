import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProjectFromLegacyEditorState } from "../src/components/video-editor/project/legacyAdapter.ts";

const outputPath = process.argv[2] || path.join(os.tmpdir(), "toscreen-project-model-smoke.project.json");

const projectModel = createProjectFromLegacyEditorState({
  videoPath: "/tmp/toscreen-smoke-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-smoke.mov",
  companionAudioPath: "/tmp/toscreen-smoke-audio.mov",
  durationSeconds: 8,
  projectDurationSeconds: 10,
  zoomRegions: [{
    id: "zoom-1",
    startMs: 1000,
    endMs: 3000,
    depth: 3,
    focus: { cx: 0.5, cy: 0.5 },
  }],
  trimRegions: [{
    id: "trim-1",
    startMs: 4000,
    endMs: 4500,
  }],
  annotationRegions: [],
  audioRegions: [{
    id: "audio-1",
    startMs: 0,
    endMs: 10000,
    sourceUrl: "file:///tmp/toscreen-smoke-audio.mov",
    path: "/tmp/toscreen-smoke-audio.mov",
    volume: 1,
    isOriginal: true,
    isDetached: false,
    sourceStartMs: 0,
    sourceEndMs: 10000,
    totalDurationMs: 10000,
    name: "Smoke Audio",
  }],
  cursorData: [{
    timestamp: 0,
    x: 100,
    y: 100,
    cx: 0.5,
    cy: 0.5,
    isClick: false,
  }],
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorOffset: -180,
  cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  wallpaper: "/wallpapers/wallpaper1.jpg",
  shadowIntensity: 0.6,
  showBlur: false,
  motionBlurEnabled: true,
  borderRadius: 20,
  padding: 60,
  aspectRatio: "16:9",
  exportQuality: "good",
  now: new Date("2026-06-30T00:00:00.000Z"),
});

fs.writeFileSync(outputPath, JSON.stringify({
  zoomRegions: [],
  trimRegions: [],
  annotationRegions: [],
  audioRegions: [],
  projectModel,
}, null, 2));

console.log(outputPath);
