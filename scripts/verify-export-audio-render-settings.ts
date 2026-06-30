import {
  createProjectFromLegacyEditorState,
  getProjectRenderSettings,
  resolveExportAudioRegions,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";
import type { AudioRegion } from "../src/components/video-editor/types";

const diskAudioRegion: AudioRegion = {
  id: "audio-disk",
  startMs: 0,
  endMs: 4000,
  sourceUrl: "file:///tmp/project-audio.wav",
  path: "/tmp/project-audio.wav",
  volume: 0.5,
  sourceStartMs: 0,
  sourceEndMs: 4000,
  totalDurationMs: 4000,
  name: "Project audio",
};

const blobAudioRegion: AudioRegion = {
  id: "audio-blob",
  startMs: 4000,
  endMs: 8000,
  sourceUrl: "blob:toscreen-memory-audio",
  volume: 0.7,
  sourceStartMs: 0,
  sourceEndMs: 4000,
  totalDurationMs: 4000,
  name: "Memory audio",
};

const project = createProjectFromLegacyEditorState({
  projectId: "project-export-audio-render-settings",
  projectName: "Export Audio Render Settings",
  videoPath: "/tmp/toscreen-export-audio-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-export-audio.mov",
  companionAudioPath: "/tmp/project-audio.wav",
  durationSeconds: 8,
  projectDurationSeconds: 8,
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
const memoryOnlyFile = { __kind: "memory-file" } as unknown as File;
const staleMemoryAudioRegions: AudioRegion[] = [
  {
    ...diskAudioRegion,
    volume: 1,
    file: { __kind: "stale-disk-file" } as unknown as File,
  },
  {
    ...blobAudioRegion,
    file: memoryOnlyFile,
  },
];

const exportAudioRegions = resolveExportAudioRegions(
  renderSettings.timeline.audioRegions,
  staleMemoryAudioRegions,
);

const exportedDiskAudio = exportAudioRegions.find((region) => region.id === diskAudioRegion.id);
const exportedBlobAudio = exportAudioRegions.find((region) => region.id === blobAudioRegion.id);

if (!exportedDiskAudio || !exportedBlobAudio) {
  fail("Expected both disk and blob audio regions to be exported.", exportAudioRegions);
}

if (exportedDiskAudio.volume !== diskAudioRegion.volume || exportedDiskAudio.file) {
  fail("Disk-backed export audio should come from ProjectModel render settings, not stale memory state.", exportedDiskAudio);
}

if (exportedBlobAudio.file !== memoryOnlyFile || exportedBlobAudio.volume !== blobAudioRegion.volume) {
  fail("Blob-backed export audio should keep ProjectModel timing/volume while recovering the in-memory File.", exportedBlobAudio);
}

console.log(JSON.stringify({
  status: "ok",
  renderSettingsAudioRegions: renderSettings.timeline.audioRegions.length,
  exportAudioRegions: exportAudioRegions.length,
  diskAudioSource: "project-render-settings",
  blobAudioFileRecovered: exportedBlobAudio.file === memoryOnlyFile,
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
