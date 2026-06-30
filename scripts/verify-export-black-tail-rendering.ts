import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const videoExporterPath = path.join(repoRoot, "src", "lib", "exporter", "videoExporter.ts");
const frameRendererPath = path.join(repoRoot, "src", "lib", "exporter", "frameRenderer.ts");

const videoExporter = fs.readFileSync(videoExporterPath, "utf8");
const frameRenderer = fs.readFileSync(frameRendererPath, "utf8");

assertIncludes(
  videoExporter,
  "const renderBlackTailFrames = async () =>",
  "VideoExporter must keep an explicit black-tail rendering path after source-video end.",
);
assertIncludes(
  videoExporter,
  "const encoded = await encodeRenderedFrame(blackBitmap, totalFramesExported);",
  "Black-tail export frames must go through encodeRenderedFrame instead of bypassing the renderer.",
);
assertIncludes(
  videoExporter,
  "await this.renderer!.renderFrame(source, frameIndex * (1000000 / this.config.frameRate));",
  "encodeRenderedFrame must route every source frame through FrameRenderer with the project frame timestamp.",
);
assertNotIncludes(
  videoExporter,
  "new VideoFrame(blackBitmap",
  "Black-tail frames must not be encoded directly as raw black frames.",
);
assertIncludes(
  frameRenderer,
  "const timeMs = this.currentVideoTime * 1000;",
  "FrameRenderer must derive effect time from the export timestamp.",
);
assertIncludes(
  frameRenderer,
  "const motionIntensity = this.updateAnimationState(timeMs);",
  "FrameRenderer must continue Zoom/Camera animation from export time.",
);
assertIncludes(
  frameRenderer,
  "await renderAnnotations(",
  "FrameRenderer must render annotations after compositing the source frame.",
);
assertIncludes(
  frameRenderer,
  "this.renderCursor(timeMs);",
  "FrameRenderer must render cursor using the same export timestamp.",
);

console.log(JSON.stringify({
  status: "ok",
  checks: [
    "black tail path exists",
    "black tail frames route through encodeRenderedFrame",
    "encodeRenderedFrame routes through FrameRenderer",
    "black tail frames are not directly encoded",
    "FrameRenderer drives Zoom, annotations, and cursor from export time",
  ],
}, null, 2));

function assertIncludes(content: string, needle: string, message: string) {
  if (!content.includes(needle)) {
    fail(message, { needle });
  }
}

function assertNotIncludes(content: string, needle: string, message: string) {
  if (content.includes(needle)) {
    fail(message, { needle });
  }
}

function fail(message: string, details?: unknown): never {
  console.error(JSON.stringify({
    status: "failed",
    message,
    details,
  }, null, 2));
  process.exit(1);
}
