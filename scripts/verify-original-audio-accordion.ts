import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildAssociatedOriginalAudioForSourceRange,
  getAttachedOriginalAudio,
  getStandaloneAudioRegions,
} from "../src/components/video-editor/timeline/timelineOriginalAudio";
import type { AudioRegion } from "../src/components/video-editor/types";

const repoRoot = process.cwd();
const timelineEditorPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "TimelineEditor.tsx",
);
const itemPath = path.join(
  repoRoot,
  "src",
  "components",
  "video-editor",
  "timeline",
  "Item.tsx",
);

function makeAudioRegion(partial: Partial<AudioRegion>): AudioRegion {
  return {
    id: partial.id ?? "audio",
    startMs: partial.startMs ?? 0,
    endMs: partial.endMs ?? 1000,
    sourceUrl: partial.sourceUrl ?? "file:///tmp/audio.wav",
    volume: partial.volume ?? 1,
    ...partial,
  };
}

const attachedOriginal = makeAudioRegion({
  id: "original-attached",
  isOriginal: true,
  isDetached: false,
  sourceStartMs: 100,
  sourceEndMs: 900,
});
const detachedOriginal = makeAudioRegion({
  id: "original-detached",
  isOriginal: true,
  isDetached: true,
});
const voiceover = makeAudioRegion({
  id: "voiceover",
  isOriginal: false,
  isDetached: false,
});

const audioRegions = [voiceover, detachedOriginal, attachedOriginal];
assert.equal(
  getAttachedOriginalAudio(audioRegions)?.id,
  "original-attached",
  "Only non-detached original audio should attach to the main video accordion.",
);
assert.deepEqual(
  getStandaloneAudioRegions(audioRegions).map((region) => region.id),
  ["voiceover", "original-detached"],
  "Detached original audio and non-original audio should remain standalone timeline audio.",
);

const associatedAudio = buildAssociatedOriginalAudioForSourceRange(attachedOriginal, 250, 750);
assert.equal(associatedAudio?.id, "original-attached");
assert.equal(associatedAudio?.sourceStartMs, 250);
assert.equal(associatedAudio?.sourceEndMs, 750);
assert.equal(attachedOriginal.sourceStartMs, 100, "Source range helper must not mutate the original region.");

assert.equal(
  buildAssociatedOriginalAudioForSourceRange(undefined, 0, 1000),
  undefined,
  "Missing original audio should not create a phantom associated audio region.",
);

const timelineEditor = fs.readFileSync(timelineEditorPath, "utf8");
const timelineEditorNeedles = [
  "getAttachedOriginalAudio(audioRegions)",
  "getStandaloneAudioRegions(audioRegions || [])",
  "buildAssociatedOriginalAudioForSourceRange(originalAudio, 0, sourceTotalMs)",
  "buildAssociatedOriginalAudioForSourceRange(\n            originalAudio,\n            segment.sourceStartMs,\n            segment.sourceEndMs,",
];
for (const needle of timelineEditorNeedles) {
  assert.ok(
    timelineEditor.includes(needle),
    `TimelineEditor is missing original-audio accordion wiring: ${needle}`,
  );
}

const item = fs.readFileSync(itemPath, "utf8");
const itemNeedles = [
  "if (isVideo && associatedAudio)",
  "id={`${id}-subaudio`}",
  "onSelectAudio?.()",
  '{associatedAudio.name || "原声音频"}',
  "isAudioSelected &&",
  "<VolumeEnvelope",
  "onVolumeKeyframesChange?.(newKeyframes)",
];
for (const needle of itemNeedles) {
  assert.ok(
    item.includes(needle),
    `Item.tsx is missing original-audio accordion UI wiring: ${needle}`,
  );
}

console.log(JSON.stringify({
  status: "ok",
  checked: {
    helperCases: 4,
    timelineEditorWiring: timelineEditorNeedles.length,
    itemAccordionWiring: itemNeedles.length,
  },
}, null, 2));
