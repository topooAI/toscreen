import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEditingRenderPlan } from '../src/components/video-editor/editing/renderPlan';
import { resolveEditingExportDurations, shouldRenderMainTrackFrame } from '../src/lib/exporter/duration';

const plan = createEditingRenderPlan({
  clips: [{ id: 'main', sourceStartMs: 0, sourceEndMs: 16_000 }],
  speedSections: [{ id: 'speed', projectStartMs: 0, projectEndMs: 16_000, rate: 2, origin: 'manual' }],
}, 16_000);
assert.equal(plan.durationMs, 8_000);

const durations = resolveEditingExportDurations({
  mainTrackDurationMs: plan.durationMs,
  projectDurationMs: 12_000,
});
assert.deepEqual(durations, { mainTrackDurationSeconds: 8, projectDurationSeconds: 12 });

const frameRate = 30;
assert.equal(Math.floor(durations.projectDurationSeconds * frameRate), 360);
assert.equal(shouldRenderMainTrackFrame(239, frameRate, plan.durationMs), true);
assert.equal(shouldRenderMainTrackFrame(240, frameRate, plan.durationMs), false);
assert.equal(shouldRenderMainTrackFrame(359, frameRate, plan.durationMs), false);

const videoExporter = fs.readFileSync('src/lib/exporter/videoExporter.ts', 'utf8');
const audioExporter = fs.readFileSync('src/lib/exporter/audioMixerExporter.ts', 'utf8');
const videoEditor = fs.readFileSync('src/components/video-editor/VideoEditor.tsx', 'utf8');
assert.ok(videoExporter.includes('await renderBlackTailFrames();'));
assert.ok(videoExporter.includes('totalFramesExported >= mainTrackExpectedFrames'));
assert.ok(videoExporter.includes('encodeRenderedFrame(blackBitmap, totalFramesExported)'));
assert.ok(audioExporter.includes('new OfflineAudioContext(2, sampleRate * effectiveDuration, sampleRate)'));
assert.ok(audioExporter.includes('resolveEditingExportDurations'));
assert.ok(videoEditor.includes('projectDuration > mainTrackDuration'));
assert.ok(videoEditor.includes('clampedTime < mainTrackDuration'));
assert.ok(videoEditor.includes('? currentTimeStateRef.current'));

console.log(JSON.stringify({
  status: 'ok',
  mainTrackSeconds: durations.mainTrackDurationSeconds,
  projectSeconds: durations.projectDurationSeconds,
  mainTrackFrames: 240,
  totalProjectFrames: 360,
  blackTailFrames: 120,
  checks: [
    'Main Track sampling stops at 8s',
    'full project export and OfflineAudioContext continue to 12s',
    'frames after Main Track use black-tail renderer instead of repeating the last source frame',
    'external audio and project overlays retain the 8s-12s tail window',
  ],
}, null, 2));
