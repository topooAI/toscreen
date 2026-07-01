import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildThumbnailSegments,
  getZoomBoundaryPercents,
} from "../src/components/video-editor/timeline/timelineThumbnailSegments";
import type { ZoomRegion } from "../src/components/video-editor/types";

const repoRoot = process.cwd();
const videoThumbnailsPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "VideoThumbnails.tsx",
);
const itemPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "Item.tsx",
);

const zooms: ZoomRegion[] = [
  { id: "zoom-a", startMs: 2000, endMs: 5000, depth: 5, focus: { cx: 0.2, cy: 0.3 } },
  { id: "zoom-b", startMs: 7000, endMs: 11000, depth: 2, focus: { cx: 0.7, cy: 0.5 } },
];

assert.deepEqual(
  buildThumbnailSegments(0, 10000, []).map((segment) => ({
    id: segment.id,
    startMs: segment.startMs,
    endMs: segment.endMs,
    hasZoom: Boolean(segment.zoom),
  })),
  [{ id: "default-0-10000", startMs: 0, endMs: 10000, hasZoom: false }],
  "Main video thumbnails without Zoom/Focus should render one default source segment.",
);

assert.deepEqual(
  buildThumbnailSegments(0, 10000, zooms).map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zoomId: segment.zoom?.id ?? "default",
  })),
  [
    { startMs: 0, endMs: 2000, zoomId: "default" },
    { startMs: 2000, endMs: 5000, zoomId: "zoom-a" },
    { startMs: 5000, endMs: 7000, zoomId: "default" },
    { startMs: 7000, endMs: 10000, zoomId: "zoom-b" },
  ],
  "Main video thumbnails should split by default and Zoom/Focus source ranges.",
);

assert.deepEqual(
  getZoomBoundaryPercents(0, 10000, zooms),
  [20, 50, 70],
  "Zoom/Focus boundaries should map to local main-clip percentages and omit the clipped right edge.",
);

assert.deepEqual(
  buildThumbnailSegments(3000, 4000, zooms).map((segment) => ({
    startMs: segment.startMs,
    endMs: segment.endMs,
    zoomId: segment.zoom?.id ?? "default",
  })),
  [
    { startMs: 3000, endMs: 5000, zoomId: "zoom-a" },
    { startMs: 5000, endMs: 7000, zoomId: "default" },
  ],
  "Main video thumbnail segmentation should clamp Zoom/Focus regions to the source-backed clip range.",
);

const videoThumbnails = fs.readFileSync(videoThumbnailsPath, "utf8");
const videoThumbnailNeedles = [
  "buildThumbnailSegments(sourceStartMs, effTotalDuration, thumbnailZoomRegions)",
  "getZoomBoundaryPercents(sourceStartMs, effTotalDuration, thumbnailZoomRegions)",
  "const thumbnailZoomRegions = boundaryZoomRegions || zoomRegions || []",
  "const thumbnailZoomSignature = JSON.stringify(thumbnailZoomRegions)",
  "ZOOM_DEPTH_SCALES[segment.zoom.depth]",
  "ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height)",
  "borderLeft: '1px dashed rgba(255,255,255,0.86)'",
];
for (const needle of videoThumbnailNeedles) {
  assert.ok(
    videoThumbnails.includes(needle),
    `VideoThumbnails is missing main-video thumbnail wiring: ${needle}`,
  );
}

const item = fs.readFileSync(itemPath, "utf8");
const itemNeedles = [
  "<VideoThumbnails",
  "sourceStartMs={sourceStartMs}",
  "effTotalDuration={trueTotalDurMs}",
  "zoomRegions={zoomRegions}",
  "boundaryZoomRegions={zoomBoundaryRegions}",
];
for (const needle of itemNeedles) {
  assert.ok(
    item.includes(needle),
    `Item.tsx is missing main-video thumbnail wiring: ${needle}`,
  );
}

console.log(JSON.stringify({
  status: "ok",
  checked: {
    helperCases: 4,
    videoThumbnailWiring: videoThumbnailNeedles.length,
    itemWiring: itemNeedles.length,
  },
}, null, 2));
