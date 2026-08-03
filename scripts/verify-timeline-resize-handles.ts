import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const itemPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "Item.tsx",
);
const itemGlassPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "ItemGlass.module.css",
);
const timelineEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineEditor.tsx",
);

const itemContent = fs.readFileSync(itemPath, "utf8");
const itemGlassContent = fs.readFileSync(itemGlassPath, "utf8");
const timelineEditorContent = fs.readFileSync(timelineEditorPath, "utf8");

function fail(message: string, details: unknown) {
  console.error(JSON.stringify({ status: "failed", message, details }, null, 2));
  process.exit(1);
}

const leftMarker = "{/* Left Resize Handle */}";
const rightMarker = "{/* Right Resize Handle */}";
const waveformMarker = "{/* Waveform";
const leftStart = itemContent.indexOf(leftMarker);
const rightStart = itemContent.indexOf(rightMarker);
const end = itemContent.indexOf(waveformMarker, rightStart);

if (leftStart < 0 || rightStart < 0 || end < 0 || rightStart <= leftStart) {
  fail("Resize handle JSX markers are missing or out of order.", {
    leftStart,
    rightStart,
    end,
  });
}

const handleBlock = itemContent.slice(leftStart, end);

const requiredItemNeedles = [
  "className={cn(glassStyles.zoomEndCap, glassStyles.left, \"flex items-center justify-center\")}",
  "className={cn(glassStyles.zoomEndCap, glassStyles.right, \"flex items-center justify-center\")}",
  "style={{ cursor: 'col-resize', pointerEvents: 'auto', width: `${dynamicResizeHandleWidth}px` }}",
  "onPointerDown={canTimelineDirectResize ? handleDirectResizePointerDown('start') : undefined}",
  "onPointerDown={canTimelineDirectResize ? handleDirectResizePointerDown('end') : undefined}",
  "title=\"Resize left\"",
  "title=\"Resize right\"",
  "<div className=\"w-1 h-3 bg-white/60 rounded-full\" />",
];

const forbiddenItemNeedles = [
  "<svg",
  "ChevronLeft",
  "ChevronRight",
  "Minus",
  "bg-yellow",
  "bg-amber",
  "text-yellow",
  "&lt;",
  "&gt;",
];

const missingItemNeedles = requiredItemNeedles.filter((needle) => !handleBlock.includes(needle));
const missingInteractionNeedles = [
  "const TIMELINE_RESIZE_HIT_AREA_PX = 18;",
  "resizeHandleWidth: TIMELINE_RESIZE_HIT_AREA_PX",
  "const canTimelineDirectResize = isTrim || isAudio || isAnnotation",
  "|| isSpeed",
  "if (!onDirectSpanChange || !canTimelineDirectResize) return;",
].filter((needle) => !itemContent.includes(needle));
const forbiddenItemNeedlesFound = forbiddenItemNeedles.filter((needle) => handleBlock.includes(needle));

if (
  missingItemNeedles.length > 0
  || missingInteractionNeedles.length > 0
  || forbiddenItemNeedlesFound.length > 0
) {
  fail("Timeline resize handle JSX no longer matches the accepted vertical-handle contract.", {
    missing: missingItemNeedles,
    missingInteraction: missingInteractionNeedles,
    forbidden: forbiddenItemNeedlesFound,
  });
}

const requiredCssNeedles = [
  ".zoomEndCap {",
  "opacity: 0;",
  ".glassPurple:hover .zoomEndCap",
  ".glassRed:hover .zoomEndCap",
  ".glassYellow:hover .zoomEndCap",
  ".glassBlue:hover .zoomEndCap",
  ".glassVideo:hover .zoomEndCap",
  "opacity: 1;",
  ".zoomEndCap.left",
  "left: 0;",
  ".zoomEndCap.right",
  "right: 0;",
  "cursor: ew-resize;",
];

const forbiddenCssNeedles = [
  "content: \"<\"",
  "content: \">\"",
  "content: '-'",
  "background: #facc15",
  "background: yellow",
];

const missingCssNeedles = requiredCssNeedles.filter((needle) => !itemGlassContent.includes(needle));
const forbiddenCssNeedlesFound = forbiddenCssNeedles.filter((needle) => itemGlassContent.includes(needle));

if (missingCssNeedles.length > 0 || forbiddenCssNeedlesFound.length > 0) {
  fail("Timeline resize handle CSS no longer matches the accepted vertical-handle contract.", {
    missing: missingCssNeedles,
    forbidden: forbiddenCssNeedlesFound,
  });
}

const requiredAnnotationNeedles = [
  "const defaultDuration = 1000;",
  "const startPos = Math.max(0, currentTimeMs);",
  "const endPos = startPos + defaultDuration;",
  "onDirectSpanPreview={onItemResizePreview}",
  "onDirectResizeStart={onTimelineResizeStart}",
  "onDirectResizeEnd={onTimelineResizeEnd}",
  "getVisualResizeSnapSpan={getVisualResizeSnapSpan}",
  "getVisualResizeSnapSpan={isMagneticSnapEnabled ? getVisualResizeMagneticSnapSpan : undefined}",
];
const forbiddenAnnotationNeedles = [
  "const endPos = Math.min(startPos + defaultDuration, totalMs);",
];
const missingAnnotationNeedles = requiredAnnotationNeedles.filter(
  (needle) => !timelineEditorContent.includes(needle),
);
const forbiddenAnnotationNeedlesFound = forbiddenAnnotationNeedles.filter(
  (needle) => timelineEditorContent.includes(needle),
);

if (missingAnnotationNeedles.length > 0 || forbiddenAnnotationNeedlesFound.length > 0) {
  fail("Annotation clips no longer match the accepted duration and resize contract.", {
    missing: missingAnnotationNeedles,
    forbidden: forbiddenAnnotationNeedlesFound,
  });
}

console.log(JSON.stringify({
  status: "ok",
  checked: [
    "left and right handles share zoomEndCap positioning",
    "dnd-timeline edge hit radius covers the visually inset handle",
    "handles render only a vertical white rounded pill",
    "Annotation, Audio, and Speed regions use direct resize handles; Focus remains on dnd-timeline",
    "new Annotation clips receive a full one-second duration and may extend the project",
    "Annotation resize preview, lifecycle, and magnetic snap callbacks are wired",
    "hover/selected states reveal handles for all clip color classes",
    "legacy SVG caps, yellow handles, and text glyphs are absent from the handle block",
  ],
}, null, 2));
