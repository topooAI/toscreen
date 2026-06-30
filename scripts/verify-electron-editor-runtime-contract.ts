import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  packageJson: path.join(repoRoot, "package.json"),
  viteConfig: path.join(repoRoot, "vite.config.ts"),
  electronWindows: path.join(repoRoot, "electron", "windows.ts"),
  electronMain: path.join(repoRoot, "electron", "main.ts"),
  electronHandlers: path.join(repoRoot, "electron", "ipc", "handlers.ts"),
  videoPlayback: path.join(repoRoot, "src", "components", "video-editor", "VideoPlayback.tsx"),
  usePixiApp: path.join(repoRoot, "src", "components", "video-editor", "hooks", "usePixiApp.ts"),
  timelineEditor: path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineEditor.tsx"),
  timelineItem: path.join(repoRoot, "src", "components", "video-editor", "timeline", "Item.tsx"),
  videoThumbnails: path.join(repoRoot, "src", "components", "video-editor", "timeline", "VideoThumbnails.tsx"),
  row: path.join(repoRoot, "src", "components", "video-editor", "timeline", "Row.tsx"),
  itemGlass: path.join(repoRoot, "src", "components", "video-editor", "timeline", "ItemGlass.module.css"),
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
) as Record<keyof typeof files, string>;

const checks = [
  {
    area: "electron-editor-dev-entry",
    file: "packageJson",
    needles: [
      "\"dev:editor\": \"TOSCREEN_DEV_WINDOW_TYPE=editor vite\"",
    ],
  },
  {
    area: "vite-localhost-hmr",
    file: "viteConfig",
    needles: [
      "host: 'localhost'",
      "strictPort: true",
      "hmr: {",
    ],
  },
  {
    area: "electron-localhost-dev-url",
    file: "electronWindows",
    needles: [
      "process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'",
    ],
  },
  {
    area: "electron-editor-direct-window",
    file: "electronMain",
    needles: [
      "process.env.TOSCREEN_DEV_WINDOW_TYPE === 'editor'",
      "mainWindow = createEditorWindow()",
    ],
  },
  {
    area: "recording-proxy-restore",
    file: "electronHandlers",
    needles: [
      "file.startsWith('recording-')",
      "const proxyPath = path.join(parsed.dir, `${parsed.name}-proxy.mp4`)",
      "proxyPath: hasProxy ? proxyPath : undefined",
    ],
  },
  {
    area: "pixi-context-loss-fallback",
    file: "usePixiApp",
    needles: [
      "webglcontextlost",
      "setPixiReady(false)",
      "falling back to native video preview",
    ],
  },
  {
    area: "native-video-preview-fallback",
    file: "videoPlayback",
    needles: [
      "pixiReady && videoReady ? \"hidden\"",
      "absolute inset-0 h-full w-full object-contain pointer-events-none",
    ],
  },
  {
    area: "timeline-resize-preview",
    file: "timelineItem",
    needles: [
      "onDirectSpanPreview?: (id: string, span: Span | null) => void",
      "onDirectSpanPreview?.(id, nextSpan)",
      "onDirectSpanPreview?.(id, null)",
    ],
  },
  {
    area: "focus-resize-preview-wiring",
    file: "timelineEditor",
    needles: [
      "onItemResizePreview?: (id: string, span: Span | null) => void",
      "onDirectSpanPreview={onItemResizePreview}",
      "zoomBoundaryRegions",
    ],
  },
  {
    area: "main-clip-compressed-height",
    file: "timelineEditor",
    needles: [
      "const videoRowHeight = isAssociatedAudioSelected ? 112 : (hasAssociatedAudio ? 96 : 82)",
    ],
  },
  {
    area: "main-clip-thumbnail-separators",
    file: "videoThumbnails",
    needles: [
      "const THUMBNAIL_HEIGHT = 64",
      "height: '70%'",
      "borderLeft: '1px dashed rgba(255,255,255,0.86)'",
    ],
  },
  {
    area: "timeline-track-structure",
    file: "row",
    needles: [
      "data-timeline-track-area=\"true\"",
      "marginLeft: 16",
      "id !== \"row-video\"",
    ],
  },
  {
    area: "video-clip-style",
    file: "itemGlass",
    needles: [
      ".glassVideo",
      "background: #27272a",
      ".glassVideo.selected",
    ],
  },
] as const;

const failures: Array<{ area: string; file: string; missing: string[] }> = [];

for (const check of checks) {
  const fileContent = content[check.file];
  const missing = check.needles.filter((needle) => !fileContent.includes(needle));
  if (missing.length > 0) {
    failures.push({ area: check.area, file: files[check.file], missing });
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Electron editor runtime contract is broken.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checks: checks.map((check) => check.area),
}, null, 2));
