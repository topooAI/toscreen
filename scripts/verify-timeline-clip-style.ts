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

function countNeedle(content: string, needle: string) {
  return content.split(needle).length - 1;
}

function cssBlock(content: string, selector: string) {
  const start = content.indexOf(`${selector} {`);
  if (start < 0) return "";
  const end = content.indexOf("\n}", start);
  return end < 0 ? "" : content.slice(start, end + 2);
}

const requiredItemNeedles = [
  "width: 'calc(100% - 3px)'",
  "alignItems: 'flex-start'",
  "paddingTop: '6px'",
  "paddingLeft: '6px'",
  "pointerEvents: 'none'",
  "{isZoom && zoomDepth ? ZOOM_LABELS[zoomDepth] : children}",
  "{children}",
];

const missingItemNeedles = requiredItemNeedles.filter((needle) => !itemContent.includes(needle));
const forbiddenItemNeedles = [
  "from 'lucide-react'",
  "from \"lucide-react\"",
  "rounded-lg",
  "border border-",
  "<Icon",
  "Lucide",
].filter((needle) => itemContent.includes(needle));

const clipGapCount = countNeedle(itemContent, "width: 'calc(100% - 3px)'");
if (clipGapCount < 2) {
  fail("Expected both normal clips and associated-video clips to keep the 3px visual gap.", {
    clipGapCount,
  });
}

if (missingItemNeedles.length > 0 || forbiddenItemNeedles.length > 0) {
  fail("Timeline Item style contract is out of sync.", {
    missing: missingItemNeedles,
    forbidden: forbiddenItemNeedles,
  });
}

const classNames = [
  ".glassPurple",
  ".glassRed",
  ".glassYellow",
  ".glassBlue",
  ".glassVideo",
];

const cssErrors: string[] = [];

for (const className of classNames) {
  const baseBlock = cssBlock(itemGlassContent, className);
  const selectedBlock = cssBlock(itemGlassContent, `${className}.selected`);

  if (!baseBlock.includes("border-radius: 6px;")) {
    cssErrors.push(`${className} must keep border-radius: 6px.`);
  }

  if (!selectedBlock.includes("box-shadow: inset 0 0 0 1px")) {
    cssErrors.push(`${className}.selected must keep inset selected glow.`);
  }

  if (selectedBlock.includes("\nborder:")) {
    cssErrors.push(`${className}.selected must not use layout-affecting border.`);
  }
}

const forbiddenCssNeedles = [
  "border-radius: 8px",
  "rounded-lg",
  "box-shadow: 0 0 0 1px",
].filter((needle) => itemGlassContent.includes(needle));

if (cssErrors.length > 0 || forbiddenCssNeedles.length > 0) {
  fail("Timeline ItemGlass style contract is out of sync.", {
    cssErrors,
    forbidden: forbiddenCssNeedles,
  });
}

console.log(JSON.stringify({
  status: "ok",
  checked: [
    "3px visual clip gap",
    "top-left title alignment",
    "text-only clip labels without lucide icons",
    "6px radius across clip color classes",
    "selected state uses inset glow without layout border",
  ],
}, null, 2));
