import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

const validProject: VideoEditorProject = {
  id: "project-motion-clip-contract",
  schemaVersion: 1,
  name: "Motion Clip Contract",
  durationMs: 8000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: { wallpaper: "/wallpapers/wallpaper1.jpg", showBlur: false },
    padding: 60,
    borderRadius: 20,
    shadow: { intensity: 0.5 },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [
    { id: "asset-lottie-cta", type: "lottie", name: "CTA", sourceUrl: "file:///assets/cta.json" },
  ],
  uiSources: [
    {
      id: "ui-source-product",
      name: "Product UI",
      provider: "manual",
      elements: [{ id: "primary-button", name: "Generate", role: "button" }],
    },
  ],
  tracks: [
    { id: "track-lottie-main", type: "lottie", name: "Lottie", order: 1 },
    { id: "track-ui-motion-main", type: "ui-motion", name: "UI Motion", order: 2 },
  ],
  clips: [
    {
      id: "clip-lottie-cta",
      type: "lottie",
      trackId: "track-lottie-main",
      assetId: "asset-lottie-cta",
      startMs: 0,
      endMs: 3000,
      props: {
        playback: { loop: false, speed: 1, direction: 1 },
        transform: { x: 0.4, y: 0.72, width: 0.18, height: 0.18, rotation: 0, opacity: 1 },
        colorOverrides: { primary: "#34d399" },
        enterPreset: "pop",
        exitPreset: "fade",
      },
    },
    {
      id: "clip-ui-button-highlight",
      type: "ui-element-motion",
      trackId: "track-ui-motion-main",
      startMs: 3200,
      endMs: 6200,
      props: {
        uiSourceId: "ui-source-product",
        elementId: "primary-button",
        action: "highlight",
        from: { opacity: 0.4, width: 0.12, height: 0.06 },
        to: { opacity: 1, width: 0.16, height: 0.08 },
        easing: "smooth",
        generatedFrom: { recordingEventId: "click-1", aiPlanStepId: "ai-step-highlight" },
      },
    },
  ],
  scenes: [],
  exportSettings: { quality: "good" },
};

const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Expected valid Lottie and UI motion clips to pass.", { validation: validResult });
}

const invalidProject: VideoEditorProject = {
  ...validProject,
  id: "project-motion-clip-contract-invalid",
  clips: [
    {
      ...validProject.clips[0],
      id: "clip-lottie-invalid",
      props: {
        playback: { loop: "yes", speed: 0, direction: 0 },
        transform: { x: 0, y: 0, width: 0, height: -1, rotation: "none", opacity: 1.5 },
        colorOverrides: { primary: 42 },
      } as never,
    },
    {
      ...validProject.clips[1],
      id: "clip-ui-motion-invalid",
      props: {
        uiSourceId: "ui-source-product",
        elementId: "primary-button",
        action: "bounce",
        from: { width: 0, opacity: 2 },
        to: "not-an-object",
        easing: "rubber-band",
        generatedFrom: { recordingEventId: 1, aiPlanStepId: false },
      } as never,
    },
  ],
};

const invalidResult = validateVideoEditorProject(invalidProject);
const requiredErrors = [
  "Lottie clip clip-lottie-invalid playback.loop must be boolean.",
  "Lottie clip clip-lottie-invalid playback.speed must be positive.",
  "Lottie clip clip-lottie-invalid playback.direction must be 1 or -1.",
  "Lottie clip clip-lottie-invalid transform.width must be positive.",
  "Lottie clip clip-lottie-invalid transform.height must be positive.",
  "Lottie clip clip-lottie-invalid transform.rotation must be finite.",
  "Lottie clip clip-lottie-invalid transform.opacity must be between 0 and 1.",
  "Lottie clip clip-lottie-invalid colorOverrides.primary must be a string.",
  "Clip clip-ui-motion-invalid UI motion action is invalid or missing.",
  "Clip clip-ui-motion-invalid UI motion easing is invalid.",
  "Clip clip-ui-motion-invalid UI motion from.width must be positive.",
  "Clip clip-ui-motion-invalid UI motion from.opacity must be between 0 and 1.",
  "Clip clip-ui-motion-invalid UI motion to must be an object.",
  "Clip clip-ui-motion-invalid generatedFrom.recordingEventId must be a string.",
  "Clip clip-ui-motion-invalid generatedFrom.aiPlanStepId must be a string.",
];

const missingErrors = requiredErrors.filter((message) => !invalidResult.errors.includes(message));
if (missingErrors.length > 0) {
  fail("Expected invalid Lottie and UI motion clips to be rejected.", {
    missingErrors,
    actualErrors: invalidResult.errors,
  });
}

console.log(JSON.stringify({
  status: "ok",
  validClips: validProject.clips.map((clip) => clip.type),
  invalidErrors: requiredErrors,
  warnings: validResult.warnings,
}, null, 2));

function fail(message: string, details: Record<string, unknown>): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    ...details,
  }, null, 2));
  process.exit(1);
}
