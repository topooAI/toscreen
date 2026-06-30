import {
  validateVideoEditorProject,
  type VideoEditorProject,
} from "../src/components/video-editor/project";

const validProject: VideoEditorProject = {
  id: "project-annotation-contract",
  schemaVersion: 1,
  name: "Annotation Contract",
  durationMs: 6000,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  canvas: {
    aspectRatio: "16:9",
    background: { wallpaper: "/wallpapers/wallpaper1.jpg", showBlur: false },
    padding: 60,
    borderRadius: 20,
    shadow: { intensity: 0.5 },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
  },
  assets: [],
  tracks: [
    { id: "track-annotation", type: "annotation", name: "Annotation", order: 1 },
  ],
  clips: [
    {
      id: "clip-annotation-text",
      type: "annotation",
      trackId: "track-annotation",
      startMs: 1000,
      endMs: 5000,
      props: {
        sourceRegion: {
          id: "annotation-text-1",
          startMs: 1000,
          endMs: 5000,
          type: "text",
          content: "Important feature",
          textContent: "Important feature",
          position: { x: 50, y: 42 },
          size: { width: 34, height: 12 },
          style: {
            color: "#ffffff",
            backgroundColor: "transparent",
            fontSize: 32,
            fontFamily: "Inter",
            fontWeight: "bold",
            fontStyle: "normal",
            textDecoration: "none",
            textAlign: "center",
          },
          zIndex: 3,
        },
      },
    },
  ],
  scenes: [],
  exportSettings: { quality: "good" },
};

const validResult = validateVideoEditorProject(validProject);
if (!validResult.valid) {
  fail("Expected valid Annotation clip to pass.", { validation: validResult });
}

const invalidProject: VideoEditorProject = {
  ...validProject,
  id: "project-annotation-contract-invalid",
  clips: [
    {
      ...validProject.clips[0],
      id: "clip-annotation-invalid",
      props: {
        sourceRegion: {
          id: "",
          startMs: 5000,
          endMs: 1000,
          type: "sticker",
          content: 42,
          textContent: false,
          imageContent: 12,
          position: { x: "50", y: Number.NaN },
          size: { width: 0, height: -1 },
          style: {
            color: 1,
            backgroundColor: false,
            fontSize: 0,
            fontFamily: 1,
            fontWeight: "heavy",
            fontStyle: "slanted",
            textDecoration: "line-through",
            textAlign: "justify",
          },
          zIndex: Number.NaN,
          figureData: {
            arrowDirection: "around",
            color: 12,
            strokeWidth: 0,
          },
        },
      },
    },
  ],
};

const invalidResult = validateVideoEditorProject(invalidProject);
const requiredErrors = [
  "Annotation clip clip-annotation-invalid sourceRegion.id is required.",
  "Annotation clip clip-annotation-invalid sourceRegion endMs is before startMs.",
  "Annotation clip clip-annotation-invalid sourceRegion.type is invalid or missing.",
  "Annotation clip clip-annotation-invalid sourceRegion.content must be a string.",
  "Annotation clip clip-annotation-invalid sourceRegion.position.x must be finite.",
  "Annotation clip clip-annotation-invalid sourceRegion.size.width must be positive.",
  "Annotation clip clip-annotation-invalid sourceRegion.style.fontWeight is invalid or missing.",
  "Annotation clip clip-annotation-invalid sourceRegion.zIndex must be finite.",
  "Annotation clip clip-annotation-invalid sourceRegion.figureData.arrowDirection is invalid or missing.",
  "Annotation clip clip-annotation-invalid sourceRegion.figureData.strokeWidth must be positive.",
];

const missingErrors = requiredErrors.filter((message) => !invalidResult.errors.includes(message));
if (invalidResult.valid || missingErrors.length > 0) {
  fail("Expected invalid Annotation clip to be rejected.", {
    missingErrors,
    actualErrors: invalidResult.errors,
  });
}

console.log(JSON.stringify({
  status: "ok",
  validClips: validProject.clips.map((clip) => clip.type),
  invalidErrorsChecked: requiredErrors.length,
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
