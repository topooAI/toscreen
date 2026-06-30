import { validateVideoEditorProject, type ProjectTrack, type VideoEditorProject } from "../src/components/video-editor/project";

type ReviewCapability =
  | "screen-recording"
  | "camera"
  | "presenter"
  | "b-roll"
  | "lottie"
  | "ui-aware-motion"
  | "ai-edit-plan";

interface ReviewPacket {
  productPositioning: string;
  project: {
    id: string;
    name: string;
    durationMs: number;
  };
  capabilities: ReviewCapability[];
  trackMap: Array<{
    id: string;
    type: ProjectTrack["type"];
    parentId?: string;
    clipCount: number;
  }>;
  userReviewQuestions: string[];
}

const project: VideoEditorProject = {
  id: "project-review-packet-smoke",
  schemaVersion: 1,
  name: "Phase 1 Product Demo Review Packet",
  durationMs: 12000,
  createdAt: "2026-06-30T00:00:00.000Z",
  updatedAt: "2026-06-30T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: {
      wallpaper: "/wallpapers/wallpaper1.jpg",
      showBlur: true,
    },
    padding: 56,
    borderRadius: 18,
    shadow: {
      intensity: 0.5,
    },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [
    {
      id: "asset-screen-main",
      type: "screen-recording",
      name: "Main screen recording",
      sourceUrl: "file:///recordings/product-demo.mov",
      metadata: { role: "primary-screen" },
    },
    {
      id: "asset-presenter-host",
      type: "digital-human",
      name: "Digital presenter",
      sourceUrl: "toscreen://digital-human/host",
      metadata: { role: "presenter" },
    },
    {
      id: "asset-broll-feature",
      type: "video",
      name: "Feature cutaway",
      sourceUrl: "file:///assets/feature-cutaway.mp4",
      metadata: { role: "b-roll" },
    },
    {
      id: "asset-lottie-cta",
      type: "lottie",
      name: "CTA accent",
      sourceUrl: "file:///assets/cta-accent.json",
      metadata: { role: "motion-accent" },
    },
    {
      id: "asset-voice-main",
      type: "audio",
      name: "Presenter voice",
      sourceUrl: "file:///assets/voice.wav",
      metadata: { role: "presenter-voice" },
    },
  ],
  uiSources: [{
    id: "ui-source-product-screen",
    name: "Product UI source",
    provider: "figma",
    sourceUrl: "figma://file/toscreen/node/product-screen",
    capturedAt: "2026-06-30T00:00:00.000Z",
    elements: [{
      id: "ui-element-primary-action",
      name: "Primary action",
      role: "button",
      stableSelector: "figma:primary-action",
      bounds: { x: 112, y: 240, width: 220, height: 48 },
    }],
  }],
  tracks: [
    { id: "track-video-main", type: "video", name: "Main Screen", order: 0 },
    { id: "track-camera-main", type: "camera", name: "Camera", order: 1 },
    { id: "track-presenter-main", type: "presenter", name: "Presenter", order: 2 },
    { id: "track-broll-main", type: "video", name: "B-roll", order: 3, parentId: "track-video-main" },
    { id: "track-lottie-main", type: "lottie", name: "Lottie", order: 4 },
    { id: "track-ui-motion-main", type: "ui-motion", name: "UI Motion", order: 5 },
  ],
  clips: [
    {
      id: "clip-screen-main",
      type: "screen-recording",
      trackId: "track-video-main",
      assetId: "asset-screen-main",
      startMs: 0,
      endMs: 12000,
      sourceStartMs: 0,
      sourceEndMs: 12000,
      name: "Main screen recording",
      props: {
        fitMode: "contain",
        freezeAfterEnd: true,
        companionAudioAssetId: "asset-voice-main",
      },
    },
    {
      id: "clip-camera-feature-zoom",
      type: "camera",
      trackId: "track-camera-main",
      startMs: 1500,
      endMs: 4200,
      name: "Feature zoom",
      props: {
        mode: "zoom",
        depth: 3,
        focus: { cx: 0.32, cy: 0.28 },
        easing: "smooth",
      },
    },
    {
      id: "clip-presenter-host",
      type: "presenter",
      trackId: "track-presenter-main",
      assetId: "asset-presenter-host",
      startMs: 0,
      endMs: 6400,
      name: "Digital presenter",
      props: {
        sourceKind: "digital-human",
        layout: "corner",
        transform: {
          x: 0.74,
          y: 0.56,
          width: 0.2,
          height: 0.34,
          opacity: 1,
          borderRadius: 24,
        },
        backgroundRemoval: true,
        voiceSync: {
          audioAssetId: "asset-voice-main",
        },
      },
    },
    {
      id: "clip-broll-feature",
      type: "video",
      trackId: "track-broll-main",
      assetId: "asset-broll-feature",
      startMs: 6400,
      endMs: 8600,
      sourceStartMs: 300,
      sourceEndMs: 2500,
      name: "Feature B-roll",
      props: {
        layout: "cutaway",
      },
    },
    {
      id: "clip-lottie-cta",
      type: "lottie",
      trackId: "track-lottie-main",
      assetId: "asset-lottie-cta",
      startMs: 8600,
      endMs: 10400,
      name: "CTA accent",
      props: {
        playback: {
          loop: false,
          speed: 1,
          direction: 1,
        },
        transform: {
          x: 0.64,
          y: 0.72,
          width: 0.22,
          height: 0.12,
          rotation: 0,
          opacity: 1,
        },
        enterPreset: "pop",
      },
    },
    {
      id: "clip-ui-motion-primary-action",
      type: "ui-element-motion",
      trackId: "track-ui-motion-main",
      startMs: 1800,
      endMs: 3300,
      name: "Primary action emphasis",
      props: {
        uiSourceId: "ui-source-product-screen",
        elementId: "ui-element-primary-action",
        action: "highlight",
        from: { opacity: 0.45 },
        to: { opacity: 1, width: 240 },
        easing: "smooth",
        generatedFrom: {
          recordingEventId: "recording-click-primary-action",
          aiPlanStepId: "ai-step-emphasize-primary-action",
        },
      },
    },
  ],
  scenes: [{
    id: "scene-product-demo",
    name: "Product demo with AI-readable structure",
    startMs: 0,
    endMs: 12000,
    purpose: "demo",
    clipIds: [
      "clip-screen-main",
      "clip-camera-feature-zoom",
      "clip-presenter-host",
      "clip-broll-feature",
      "clip-lottie-cta",
      "clip-ui-motion-primary-action",
    ],
    aiSummary: "A product demo scene combining screen recording, camera emphasis, presenter, B-roll, Lottie, and UI-aware motion.",
  }],
  aiEditPlans: [{
    id: "ai-plan-product-demo",
    createdAt: "2026-06-30T00:00:00.000Z",
    goal: "Turn the recording into a concise product-demo video.",
    summary: "Keep the recording as the base, add camera emphasis, presenter context, B-roll, CTA motion, and UI-aware button emphasis.",
    status: "draft",
    steps: [
      {
        id: "ai-step-camera-feature",
        type: "camera",
        target: {
          clipIds: ["clip-camera-feature-zoom"],
          trackIds: ["track-camera-main"],
          sceneIds: ["scene-product-demo"],
          timeRangeMs: { startMs: 1500, endMs: 4200 },
        },
        rationale: "Focus the viewer on the feature being explained.",
        status: "draft",
      },
      {
        id: "ai-step-emphasize-primary-action",
        type: "ui-motion",
        target: {
          clipIds: ["clip-ui-motion-primary-action"],
          trackIds: ["track-ui-motion-main"],
          sceneIds: ["scene-product-demo"],
          timeRangeMs: { startMs: 1800, endMs: 3300 },
        },
        rationale: "Use UI structure to animate the target element instead of treating it as flat video pixels.",
        status: "draft",
      },
    ],
  }],
  activeAIEditPlanId: "ai-plan-product-demo",
  exportSettings: {
    quality: "good",
  },
};

function buildReviewPacket(sourceProject: VideoEditorProject): ReviewPacket {
  const clipTypes = new Set(sourceProject.clips.map((clip) => clip.type));
  const assetRoles = new Set(sourceProject.assets.map((asset) => String(asset.metadata?.role ?? "")));
  const capabilities: ReviewCapability[] = [];

  if (clipTypes.has("screen-recording")) capabilities.push("screen-recording");
  if (clipTypes.has("camera")) capabilities.push("camera");
  if (clipTypes.has("presenter")) capabilities.push("presenter");
  if (assetRoles.has("b-roll")) capabilities.push("b-roll");
  if (clipTypes.has("lottie")) capabilities.push("lottie");
  if ((sourceProject.uiSources?.length ?? 0) > 0 && clipTypes.has("ui-element-motion")) {
    capabilities.push("ui-aware-motion");
  }
  if ((sourceProject.aiEditPlans?.length ?? 0) > 0) capabilities.push("ai-edit-plan");

  return {
    productPositioning: "AI product-demo editor, not a generic NLE or recorder.",
    project: {
      id: sourceProject.id,
      name: sourceProject.name,
      durationMs: sourceProject.durationMs,
    },
    capabilities,
    trackMap: sourceProject.tracks.map((track) => ({
      id: track.id,
      type: track.type,
      parentId: track.parentId,
      clipCount: sourceProject.clips.filter((clip) => clip.trackId === track.id).length,
    })),
    userReviewQuestions: [
      "Does this model support the Phase 1 Screen Studio-grade foundation?",
      "Does Camera Clip leave enough room for future 3D camera work?",
      "Should multi-source composition stay model-only in Phase 1 or enter the UI?",
      "Does AI Edit Plan correctly stay reviewable before applying changes?",
    ],
  };
}

const validation = validateVideoEditorProject(project);

if (!validation.valid) {
  console.error(JSON.stringify(validation, null, 2));
  process.exit(1);
}

const packet = buildReviewPacket(project);
const requiredCapabilities: ReviewCapability[] = [
  "screen-recording",
  "camera",
  "presenter",
  "b-roll",
  "lottie",
  "ui-aware-motion",
  "ai-edit-plan",
];
const missingCapabilities = requiredCapabilities.filter((capability) => !packet.capabilities.includes(capability));
const emptyTracks = packet.trackMap.filter((track) => track.clipCount < 1);

if (missingCapabilities.length > 0 || emptyTracks.length > 0 || packet.userReviewQuestions.length < 4) {
  console.error(JSON.stringify({
    status: "failed",
    missingCapabilities,
    emptyTracks,
    reviewQuestionCount: packet.userReviewQuestions.length,
    packet,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  packet,
  warnings: validation.warnings,
}, null, 2));
