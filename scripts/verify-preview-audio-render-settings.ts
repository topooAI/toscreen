import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  resolveRuntimeAudioRegions,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";
import type { AudioRegion } from "../src/components/video-editor/types";

const diskAudioRegion: AudioRegion = {
  id: "preview-audio-disk",
  startMs: 0,
  endMs: 3000,
  sourceUrl: "file:///tmp/preview-project-audio.wav",
  path: "/tmp/preview-project-audio.wav",
  volume: 0.4,
  sourceStartMs: 0,
  sourceEndMs: 3000,
  totalDurationMs: 3000,
  name: "Preview project audio",
};

const blobAudioRegion: AudioRegion = {
  id: "preview-audio-blob",
  startMs: 3000,
  endMs: 6000,
  sourceUrl: "blob:toscreen-preview-memory-audio",
  volume: 0.6,
  sourceStartMs: 0,
  sourceEndMs: 3000,
  totalDurationMs: 3000,
  name: "Preview memory audio",
};

const project = createProjectFromLegacyEditorState({
  projectId: "project-preview-audio-render-settings",
  projectName: "Preview Audio Render Settings",
  videoPath: "/tmp/toscreen-preview-audio-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-preview-audio.mov",
  companionAudioPath: "/tmp/preview-project-audio.wav",
  durationSeconds: 6,
  projectDurationSeconds: 6,
  zoomRegions: [],
  trimRegions: [],
  annotationRegions: [],
  audioRegions: [diskAudioRegion, blobAudioRegion],
  cursorData: [],
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorOffset: -150,
  cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  wallpaper: "/wallpapers/wallpaper1.jpg",
  shadowIntensity: 0.5,
  showBlur: false,
  motionBlurEnabled: true,
  borderRadius: 20,
  padding: 60,
  aspectRatio: "16:9",
  exportQuality: "good",
  now: new Date("2026-06-30T00:00:00.000Z"),
});

const validation = validateVideoEditorProject(project);
if (!validation.valid) {
  fail("ProjectModel validation failed.", validation);
}

const renderSettings = getProjectRenderSettings(project);
const memoryOnlyFile = { __kind: "preview-memory-file" } as unknown as File;
const staleMemoryAudioRegions: AudioRegion[] = [
  {
    ...diskAudioRegion,
    volume: 1,
    file: { __kind: "stale-preview-disk-file" } as unknown as File,
  },
  {
    ...blobAudioRegion,
    file: memoryOnlyFile,
  },
];

const previewAudioRegions = resolveRuntimeAudioRegions(
  renderSettings.timeline.audioRegions,
  staleMemoryAudioRegions,
);

const previewDiskAudio = previewAudioRegions.find((region) => region.id === diskAudioRegion.id);
const previewBlobAudio = previewAudioRegions.find((region) => region.id === blobAudioRegion.id);

if (!previewDiskAudio || !previewBlobAudio) {
  fail("Expected both disk and blob audio regions to reach preview audio.", previewAudioRegions);
}

if (previewDiskAudio.volume !== diskAudioRegion.volume || previewDiskAudio.file) {
  fail("Disk-backed preview audio should come from ProjectModel render settings, not stale memory state.", previewDiskAudio);
}

if (previewBlobAudio.file !== memoryOnlyFile || previewBlobAudio.volume !== blobAudioRegion.volume) {
  fail("Blob-backed preview audio should keep ProjectModel timing/volume while recovering the in-memory File.", previewBlobAudio);
}

console.log(JSON.stringify({
  status: "ok",
  renderSettingsAudioRegions: renderSettings.timeline.audioRegions.length,
  previewAudioRegions: previewAudioRegions.length,
  diskAudioSource: "project-render-settings",
  blobAudioFileRecovered: previewBlobAudio.file === memoryOnlyFile,
  warnings: validation.warnings,
}, null, 2));

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
