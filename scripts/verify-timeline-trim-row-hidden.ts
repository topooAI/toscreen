import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const timelineEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineEditor.tsx",
);
const mainClipSegmentsPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "timelineMainClipSegments.ts",
);

const timelineEditor = fs.readFileSync(timelineEditorPath, "utf8");
const mainClipSegments = fs.readFileSync(mainClipSegmentsPath, "utf8");

function fail(message: string, details: unknown) {
  console.error(JSON.stringify({ status: "failed", message, details }, null, 2));
  process.exit(1);
}

const requiredEditorNeedles = [
  "const TRIM_ROW_ID = \"row-trim\"",
  "const isTrimTrackVisible = false",
  "物理 Trim 轨道废除，直接渲染在 VIDEO_ROW 内，使其贴底绝对定位",
  "items.filter(item => item.rowId === TRIM_ROW_ID).map((item) => (",
  "rowId={VIDEO_ROW_ID} // 强行挂载在主轨中",
  "variant=\"trim\"",
  "isNestedTrim={true}",
  "const trims: TimelineRenderItem[] = isTrimTrackVisible ? trimRegions.map((region, index) => ({",
  "rowId: TRIM_ROW_ID",
  "})) : []",
  "if (!isTrimTrackVisible) {",
  "const segments = editingSession",
  "editingSession.document.clips.map((clip, index) => {",
  ": buildMainClipSegments(trimRegions, sourceTotalMs, mapSourceToEffective)",
  "segments.forEach((segment) => {",
  "const videoItems = isTrimTrackVisible ? videos : mainClips",
  "return [...videoItems, ...speeds, ...zooms, ...trims, ...annotations",
  "...presentations",
];

const missingEditorNeedles = requiredEditorNeedles.filter(
  (needle) => !timelineEditor.includes(needle),
);

const forbiddenEditorNeedles = [
  "<Row id={TRIM_ROW_ID}",
  "<Row id=\"row-trim\"",
  "finalTrimRowIds",
].filter((needle) => timelineEditor.includes(needle));

const requiredMainClipNeedles = [
  "export function buildMainClipSegments",
  "normalizeTrimIntervals(trimRegions, sourceEndMs)",
  "sourceStartMs: currentSourceStartMs",
  "sourceEndMs: trim.startMs",
  "effectiveStartMs: mapSourceToEffective(currentSourceStartMs)",
  "effectiveEndMs: mapSourceToEffective(trim.startMs)",
];

const missingMainClipNeedles = requiredMainClipNeedles.filter(
  (needle) => !mainClipSegments.includes(needle),
);

if (
  missingEditorNeedles.length > 0 ||
  forbiddenEditorNeedles.length > 0 ||
  missingMainClipNeedles.length > 0
) {
  fail("Timeline Trim-row hidden contract is out of sync.", {
    timelineEditorPath,
    mainClipSegmentsPath,
    missingEditorNeedles,
    forbiddenEditorNeedles,
    missingMainClipNeedles,
  });
}

console.log(JSON.stringify({
  status: "ok",
  checked: [
    "Trim track visibility is forced off in TimelineEditor.",
    "Trim items are mounted inside the main video row instead of a standalone Trim row.",
    "Editing Session main clips are rendered in project order, with the legacy Trim-folded segment builder retained as migration fallback.",
    "TimelineEditor does not render a dedicated row-trim Row.",
  ],
}, null, 2));
