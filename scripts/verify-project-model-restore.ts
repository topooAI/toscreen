import {
  createProjectFromLegacyEditorState,
  restoreLegacyEditorStateFromProjectModel,
  validateVideoEditorProject,
} from "../src/components/video-editor/project";
import { DEFAULT_CROP_REGION } from "../src/components/video-editor/types";

const companionAudioPath = "/tmp/toscreen-restore-companion-audio.mov";
const project = createProjectFromLegacyEditorState({
  videoPath: "/tmp/toscreen-restore-recording-proxy.mp4",
  originalVideoPath: "/tmp/toscreen-restore-recording.mov",
  companionAudioPath,
  durationSeconds: 12,
  projectDurationSeconds: 12,
  zoomRegions: [{
    id: "zoom-1",
    startMs: 1000,
    endMs: 3000,
    depth: 3,
    focus: { cx: 0.5, cy: 0.5 },
  }],
  trimRegions: [],
  annotationRegions: [],
  audioRegions: [{
    id: "audio-original",
    startMs: 0,
    endMs: 12000,
    sourceUrl: `file://${companionAudioPath}`,
    volume: 1,
    name: "Recorded Audio",
    path: companionAudioPath,
    totalDurationMs: 12000,
    sourceStartMs: 0,
    sourceEndMs: 12000,
    isOriginal: true,
    isDetached: false,
  }],
  cursorData: [],
  cursorSize: 1.5,
  cursorSmoothing: true,
  showVectorCursor: true,
  cursorStyle: "custom",
  cursorCustomImage: "data:image/png;base64,dG9zY3JlZW4tY3Vyc29y",
  cursorOffset: -180,
  cropRegion: DEFAULT_CROP_REGION,
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

const validation = validateVideoEditorProject(project);
if (!validation.valid) {
  console.error("[ProjectModel] Generated project is invalid.");
  console.error(validation.errors);
  process.exit(1);
}

const restored = restoreLegacyEditorStateFromProjectModel(project);

if (
  restored.cursorStyle !== "custom"
  || restored.cursorCustomImage !== "data:image/png;base64,dG9zY3JlZW4tY3Vyc29y"
  || restored.cursorCustomImages?.default !== "data:image/png;base64,dG9zY3JlZW4tY3Vyc29y"
  || restored.cursorData?.length !== 0
) {
  console.error("[ProjectModel] empty cursor telemetry must retain cursor appearance settings.");
  console.error(restored);
  process.exit(1);
}

if (restored.companionAudioPath !== companionAudioPath) {
  console.error("[ProjectModel] companionAudioPath restore failed.");
  console.error(`  expected: ${companionAudioPath}`);
  console.error(`  actual:   ${restored.companionAudioPath}`);
  process.exit(1);
}

const restoredOriginalAudio = restored.audioRegions.find((region) => region.isOriginal && !region.isDetached);
if (!restoredOriginalAudio || restoredOriginalAudio.path !== companionAudioPath) {
  console.error("[ProjectModel] original audio region restore failed.");
  console.error(restored.audioRegions);
  process.exit(1);
}

if (
  restored.zoomRegions.length !== 1 ||
  restored.zoomRegions[0].id !== "zoom-1" ||
  restored.zoomRegions[0].depth !== 3 ||
  restored.zoomRegions[0].focus.cx !== 0.5 ||
  restored.zoomRegions[0].focus.cy !== 0.5
) {
  console.error("[ProjectModel] zoom region restore failed.");
  console.error(restored.zoomRegions);
  process.exit(1);
}

const legacyProjectWithoutCompanionAsset = {
  ...project,
  assets: project.assets.filter((asset) => asset.metadata?.role !== "companion-audio"),
  clips: project.clips.map((clip) => (
    clip.type === "screen-recording"
      ? {
        ...clip,
        props: {
          ...clip.props,
          companionAudioAssetId: undefined,
        },
      }
      : clip
  )),
};
const restoredLegacyProject = restoreLegacyEditorStateFromProjectModel(legacyProjectWithoutCompanionAsset);
if (restoredLegacyProject.companionAudioPath !== companionAudioPath) {
  console.error("[ProjectModel] legacy original audio fallback restore failed.");
  console.error(`  expected: ${companionAudioPath}`);
  console.error(`  actual:   ${restoredLegacyProject.companionAudioPath}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  companionAudioPath: restored.companionAudioPath,
  zoomRegions: restored.zoomRegions.length,
  audioRegions: restored.audioRegions.length,
  cursorStyle: restored.cursorStyle,
  legacyFallbackCompanionAudioPath: restoredLegacyProject.companionAudioPath,
}, null, 2));
