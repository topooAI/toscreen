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

const itemContent = fs.readFileSync(itemPath, "utf8");

function fail(message: string, details: unknown) {
  console.error(JSON.stringify({ status: "failed", message, details }, null, 2));
  process.exit(1);
}

function countNeedle(content: string, needle: string) {
  return content.split(needle).length - 1;
}

const waveformStart = itemContent.indexOf("function WaveformOverlay");
const waveformEnd = itemContent.indexOf("\ninterface ItemProps", waveformStart);
const waveformBlock = waveformStart >= 0 && waveformEnd > waveformStart
  ? itemContent.slice(waveformStart, waveformEnd)
  : "";

if (waveformBlock.length === 0) {
  fail("WaveformOverlay component was not found in Item.tsx.", { itemPath });
}

const requiredWaveformNeedles = [
  "className=\"absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none overflow-hidden opacity-90\"",
  "id={`waveform-${id}`}",
  "viewBox={`0 0 ${svgAbsoluteWidth} 100`}",
  "preserveAspectRatio=\"none\"",
  "left: `${svgAbsoluteLeft}px`",
  "width: `${svgAbsoluteWidth}px`",
  "height: '100%'",
  "transformOrigin: 'left'",
  "transform: `translateX(${svgOffset}px)`",
  "style={{ vectorEffect: 'non-scaling-stroke' }}",
];

const missingWaveformNeedles = requiredWaveformNeedles.filter(
  (needle) => !waveformBlock.includes(needle),
);

const forbiddenWaveformNeedles = [
  "className=\"absolute inset-0",
  "className=\"absolute top-0",
  "h-full pointer-events-none overflow-hidden",
  "pointer-events-auto",
].filter((needle) => waveformBlock.includes(needle));

const requiredTitleNeedles = [
  "paddingTop: '6px'",
  "paddingLeft: '6px'",
  "pointerEvents: 'none'",
  "zIndex: 20",
];

const missingTitleNeedles = requiredTitleNeedles.filter(
  (needle) => countNeedle(itemContent, needle) < 2,
);

const titleZIndexCount = countNeedle(itemContent, "zIndex: 20");
if (titleZIndexCount < 2) {
  missingTitleNeedles.push("at least two title overlays with zIndex: 20");
}

const volumeEnvelopeNeedles = [
  "absolute bottom-0 left-0 right-0 h-1/2 z-30 pointer-events-auto",
  "<VolumeEnvelope",
];
const missingVolumeEnvelopeNeedles = volumeEnvelopeNeedles.filter(
  (needle) => !itemContent.includes(needle),
);

const waveformUsageCount = countNeedle(itemContent, "<WaveformOverlay");
if (waveformUsageCount < 2) {
  fail("Expected WaveformOverlay to cover both normal audio clips and attached original-audio clips.", {
    waveformUsageCount,
  });
}

if (
  missingWaveformNeedles.length > 0 ||
  forbiddenWaveformNeedles.length > 0 ||
  missingTitleNeedles.length > 0 ||
  missingVolumeEnvelopeNeedles.length > 0
) {
  fail("Timeline waveform layout contract is out of sync.", {
    itemPath,
    missingWaveformNeedles,
    forbiddenWaveformNeedles,
    missingTitleNeedles,
    missingVolumeEnvelopeNeedles,
  });
}

console.log(JSON.stringify({
  status: "ok",
  itemPath,
  checked: [
    "WaveformOverlay is confined to the bottom 45% of audio clips.",
    "Waveform SVG remains source-time aligned through left offset and translateX.",
    "Audio labels stay top-left with zIndex above the waveform.",
    "Selected audio volume envelope stays in the lower half above the waveform.",
    "Both normal audio and attached original-audio clips use WaveformOverlay.",
  ],
}, null, 2));
