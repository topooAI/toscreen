import { validateVideoEditorProject, type VideoEditorProject } from "../src/components/video-editor/project";

const project: VideoEditorProject = {
  id: "project-future-entry-smoke",
  schemaVersion: 1,
  name: "Future Entry Smoke",
  durationMs: 5000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: {
      wallpaper: "/wallpapers/wallpaper1.jpg",
      showBlur: false,
    },
    padding: 60,
    borderRadius: 20,
    shadow: {
      intensity: 0.6,
    },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [{
    id: "asset-ui-source-figma",
    type: "ui-source",
    name: "Figma Source",
    sourceUrl: "figma://file/toscreen/node/demo",
    metadata: {
      role: "ui-source",
    },
  }],
  uiSources: [{
    id: "ui-source-figma-demo",
    name: "Demo Figma Screen",
    provider: "figma",
    sourceUrl: "figma://file/toscreen/node/demo",
    capturedAt: "2026-06-30T00:00:00.000Z",
    elements: [{
      id: "ui-element-primary-button",
      name: "Primary Button",
      role: "button",
      stableSelector: "figma:primary-button",
      bounds: { x: 120, y: 240, width: 180, height: 48 },
    }],
  }],
  tracks: [{
    id: "track-ui-motion-main",
    type: "ui-motion",
    name: "UI Motion",
    order: 0,
  }],
  clips: [{
    id: "clip-ui-motion-primary-button",
    type: "ui-element-motion",
    trackId: "track-ui-motion-main",
    startMs: 500,
    endMs: 1800,
    name: "Primary button emphasis",
    props: {
      uiSourceId: "ui-source-figma-demo",
      elementId: "ui-element-primary-button",
      action: "highlight",
      from: { opacity: 0.4 },
      to: { opacity: 1, width: 200 },
      easing: "smooth",
      generatedFrom: {
        recordingEventId: "recording-click-1",
        aiPlanStepId: "ai-step-highlight-button",
      },
    },
  }],
  scenes: [{
    id: "scene-feature-demo",
    name: "Feature Demo",
    startMs: 0,
    endMs: 5000,
    purpose: "feature",
    clipIds: ["clip-ui-motion-primary-button"],
    aiSummary: "Highlight the primary button during the feature explanation.",
  }],
  aiEditPlans: [{
    id: "ai-plan-feature-demo",
    createdAt: "2026-06-30T00:00:00.000Z",
    goal: "Turn a recorded UI action into an editable product-demo motion beat.",
    summary: "Emphasize the primary button when the user clicks it.",
    status: "draft",
    steps: [{
      id: "ai-step-highlight-button",
      type: "ui-motion",
      target: {
        clipIds: ["clip-ui-motion-primary-button"],
        trackIds: ["track-ui-motion-main"],
        sceneIds: ["scene-feature-demo"],
        timeRangeMs: {
          startMs: 500,
          endMs: 1800,
        },
      },
      params: {
        action: "highlight",
      },
      rationale: "The UI source lets ToScreen animate the semantic element instead of treating the recording as flat pixels.",
      status: "draft",
    }],
  }],
  activeAIEditPlanId: "ai-plan-feature-demo",
  exportSettings: {
    quality: "good",
  },
};

const result = validateVideoEditorProject(project);

if (!result.valid) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  uiSources: project.uiSources?.length ?? 0,
  uiElements: project.uiSources?.reduce((total, source) => total + source.elements.length, 0) ?? 0,
  clips: project.clips.length,
  aiEditPlans: project.aiEditPlans?.length ?? 0,
  warnings: result.warnings,
}, null, 2));
