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

const itemContent = fs.readFileSync(itemPath, "utf8");
const itemGlassContent = fs.readFileSync(itemGlassPath, "utf8");

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
  "onPointerDown={handleDirectResizePointerDown('start')}",
  "onPointerDown={handleDirectResizePointerDown('end')}",
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
const forbiddenItemNeedlesFound = forbiddenItemNeedles.filter((needle) => handleBlock.includes(needle));

if (missingItemNeedles.length > 0 || forbiddenItemNeedlesFound.length > 0) {
  fail("Timeline resize handle JSX no longer matches the accepted vertical-handle contract.", {
    missing: missingItemNeedles,
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

console.log(JSON.stringify({
  status: "ok",
  checked: [
    "left and right handles share zoomEndCap positioning",
    "handles render only a vertical white rounded pill",
    "handles use direct resize pointer handlers",
    "hover/selected states reveal handles for all clip color classes",
    "legacy SVG caps, yellow handles, and text glyphs are absent from the handle block",
  ],
}, null, 2));
