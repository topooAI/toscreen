import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  packageJson: path.join(repoRoot, "package.json"),
  electronBuilder: path.join(repoRoot, "electron-builder.json5"),
  viteConfig: path.join(repoRoot, "vite.config.ts"),
  electronWindows: path.join(repoRoot, "electron", "windows.ts"),
  electronMain: path.join(repoRoot, "electron", "main.ts"),
  electronHandlers: path.join(repoRoot, "electron", "ipc", "handlers.ts"),
  proxyGenerator: path.join(repoRoot, "electron", "ipc", "proxyGenerator.ts"),
  videoPlayback: path.join(repoRoot, "src", "components", "video-editor", "VideoPlayback.tsx"),
  usePixiApp: path.join(repoRoot, "src", "components", "video-editor", "hooks", "usePixiApp.ts"),
  timelineEditor: path.join(repoRoot, "src", "components", "video-editor", "timeline", "TimelineEditor.tsx"),
  timelineItem: path.join(repoRoot, "src", "components", "video-editor", "timeline", "Item.tsx"),
  videoThumbnails: path.join(repoRoot, "src", "components", "video-editor", "timeline", "VideoThumbnails.tsx"),
  row: path.join(repoRoot, "src", "components", "video-editor", "timeline", "Row.tsx"),
  itemGlass: path.join(repoRoot, "src", "components", "video-editor", "timeline", "ItemGlass.module.css"),
  topooUserPill: path.join(repoRoot, "src", "components", "video-editor", "TopooUserPill.tsx"),
  projectHome: path.join(repoRoot, "src", "components", "projects", "ProjectHome.tsx"),
  projectHomeStyles: path.join(repoRoot, "src", "components", "projects", "ProjectHome.module.css"),
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
    area: "toscreen-application-identity",
    file: "electronBuilder",
    needles: [
      '"appId": "ai.topoo.toscreen"',
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
    area: "electron-renderer-source-selection",
    file: "electronWindows",
    needles: [
      "const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL\n",
      "if (VITE_DEV_SERVER_URL)",
      "win.loadFile(path.join(RENDERER_DIST, 'index.html')",
    ],
  },
  {
    area: "electron-editor-direct-window",
    file: "electronMain",
    needles: [
      "process.env.TOSCREEN_DEV_WINDOW_TYPE === 'editor'",
      "registerMainWindow(createEditorWindow(), 'editor')",
    ],
  },
  {
    area: "recording-proxy-restore",
    file: "electronHandlers",
    needles: [
      "file.startsWith('recording-')",
      "const proxyResult = await generateProxyVideo(videoPath)",
      "proxyPath: proxyResult.success ? proxyResult.proxyPath : undefined",
    ],
  },
  {
    area: "recording-proxy-timeline",
    file: "proxyGenerator",
    needles: [
      "PROXY_TIMELINE_VERSION = 4",
      "const activeProxyJobs = new Map<string, ProxyGenerationJob>()",
      "const activeJob = activeProxyJobs.get(outputPath)",
      "return activeJob.promise",
      "fps=fps=30:start_time=0:round=near,setpts=PTS-STARTPTS",
      "'-vsync cfr'",
      "fs.renameSync(temporaryOutputPath, outputPath)",
      "writeProxyMetadata(inputPath, outputPath)",
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
      "const videoRowHeight = hasAssociatedAudio",
      "isAssociatedAudioSelected ? 122 : 104",
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
      "marginLeft: TIMELINE_BREATHING_GAP_PX",
      "id !== \"row-video\"",
    ],
  },
  {
    area: "projects-window-titlebar",
    file: "projectHome",
    needles: [
      "<TopooUserPill />",
      "className={styles.account}",
      "className={styles.pageHeader}",
      "<ImportVideoMorphIcon",
      "<ImportPackageMorphIcon",
      "<NewRecordingMorphIcon",
      "<MoreHorizontal size={15}/>",
      "Remove from recent",
      "Delete project",
    ],
  },
  {
    area: "projects-window-titlebar-layout",
    file: "projectHomeStyles",
    needles: [
      "height: 38px",
      "-webkit-app-region: drag",
      "-webkit-app-region: no-drag",
      "padding: 4px",
      "background: #fafafa",
      "height: 32px",
      "font-size: 12px",
      "width: 24px",
    ],
  },
  {
    area: "projects-window-native-controls-alignment",
    file: "electronWindows",
    needles: [
      "trafficLightPosition: { x: 12, y: 17 }",
    ],
  },
  {
    area: "topoo-account-trigger",
    file: "topooUserPill",
    needles: [
      "if (session.state === 'loading') return null",
      "if (session.state !== 'signed-in') return <button",
      "h-[26px]",
      "border-0 bg-transparent",
      "size-[13px]",
      "textAnchor=\"middle\" dominantBaseline=\"central\"",
      "text-[12.8694px]",
      "leading-[13px]",
    ],
  },
  {
    area: "video-clip-style",
    file: "itemGlass",
    needles: [
      ".glassVideo",
      "background: #27272a",
      ".glassVideo.selected",
      "border-radius: 6px",
      "box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.82)",
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

const clipClasses = ["glassPurple", "glassRed", "glassYellow", "glassBlue", "glassVideo"] as const;

for (const className of clipClasses) {
  const baseRule = new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?\\}`, "m").exec(content.itemGlass)?.[0] ?? "";
  const selectedRule = new RegExp(`\\.${className}\\.selected\\s*\\{[\\s\\S]*?\\}`, "m").exec(content.itemGlass)?.[0] ?? "";
  const missing: string[] = [];

  if (!baseRule.includes("border-radius: 6px")) {
    missing.push(`${className} base border-radius: 6px`);
  }

  if (!selectedRule.includes("box-shadow: inset")) {
    missing.push(`${className}.selected inset box-shadow`);
  }

  if (selectedRule.includes("background:")) {
    missing.push(`${className}.selected must not change background`);
  }

  if (missing.length > 0) {
    failures.push({ area: "clip-selected-visual-contract", file: files.itemGlass, missing });
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
