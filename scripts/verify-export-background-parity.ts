import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  backgroundControls: path.join(repoRoot, "src", "components", "video-editor", "sidebar", "BackgroundControls.tsx"),
  videoPlayback: path.join(repoRoot, "src", "components", "video-editor", "VideoPlayback.tsx"),
  frameRenderer: path.join(repoRoot, "src", "lib", "exporter", "frameRenderer.ts"),
};

const content = Object.fromEntries(
  Object.entries(files).map(([key, filePath]) => [key, fs.readFileSync(filePath, "utf8")]),
) as Record<keyof typeof files, string>;

const checks = [
  {
    area: "background-controls-gradient-inputs",
    file: "backgroundControls",
    needles: [
      "const GRADIENTS = [",
      "linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%",
      "radial-gradient( circle farthest-corner at 3.2% 49.6%",
      "onWallpaperChange(g)",
      "onWallpaperChange(color.hex)",
    ],
  },
  {
    area: "preview-css-backgrounds",
    file: "videoPlayback",
    needles: [
      "wallpaper.startsWith('#') || wallpaper.startsWith('linear-gradient') || wallpaper.startsWith('radial-gradient')",
      "const backgroundStyle = isImageUrl",
      ": { background: resolvedWallpaper || '' }",
      "filter: showBlur ? 'blur(2px)' : 'none'",
    ],
  },
  {
    area: "export-canvas-gradient-backgrounds",
    file: "frameRenderer",
    needles: [
      "function splitTopLevelCommas(",
      "function createCanvasBackgroundFill(",
      "function createLinearGradientFill(",
      "function createRadialGradientFill(",
      "parseRadialCenter(",
      "bgCtx.fillStyle = fill ?? '#000000'",
      "ctx.createLinearGradient(",
      "ctx.createRadialGradient(",
      "ctx.filter = 'blur(6px)'",
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

const naiveGradientSplitPattern = /params\.split\(\s*["']\s*,\s*["']\s*\)/;
if (naiveGradientSplitPattern.test(content.frameRenderer)) {
  failures.push({
    area: "export-canvas-gradient-backgrounds",
    file: files.frameRenderer,
    missing: ["No naive params.split(',') parsing for CSS gradients with rgba() commas."],
  });
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    message: "Preview/export background parity contract is broken.",
    failures,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  checks: checks.map((check) => check.area),
}, null, 2));
