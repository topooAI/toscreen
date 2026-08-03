import assert from 'node:assert/strict';
import {
  createEditingHistory,
  createEditingRenderPlan,
  createInitialEditingDocument,
  executeEditingCommand,
  redoEditingCommand,
  undoEditingCommand,
} from '../src/components/video-editor/editing/index';

const sourceDurationMs = 10_000;
let history = createEditingHistory(createInitialEditingDocument(sourceDurationMs));
const firstId = history.present.clips[0].id;
history = executeEditingCommand(history, { type: 'split', clipId: firstId, sourceTimeMs: 2_000 }, sourceDurationMs);
const secondId = history.present.clips[1].id;
history = executeEditingCommand(history, { type: 'split', clipId: secondId, sourceTimeMs: 7_000 }, sourceDurationMs);
assert.deepEqual(history.present.clips.map((clip) => [clip.sourceStartMs, clip.sourceEndMs]), [[0, 2_000], [2_000, 7_000], [7_000, 10_000]]);

history = executeEditingCommand(history, { type: 'delete', clipId: history.present.clips[1].id }, sourceDurationMs);
history = executeEditingCommand(history, { type: 'reorder', clipId: history.present.clips[1].id, toIndex: 0 }, sourceDurationMs);
assert.deepEqual(history.present.clips.map((clip) => [clip.sourceStartMs, clip.sourceEndMs]), [[7_000, 10_000], [0, 2_000]]);

history = executeEditingCommand(history, { type: 'set-speed', projectStartMs: 1_000, projectEndMs: 3_000, rate: 2 }, sourceDurationMs);
history = executeEditingCommand(history, {
  type: 'replace-typing-speed',
  events: [
    { timestamp: 250, type: 'keydown' },
    { timestamp: 390, type: 'keydown' },
    { timestamp: 2_200, type: 'keydown' },
  ],
  activeRate: 1,
  idleRate: 4,
}, sourceDurationMs);
assert.ok(history.present.speedSections.some((section) => section.origin === 'typing' && section.rate === 4));

const plan = createEditingRenderPlan(history.present, sourceDurationMs);
assert.equal(plan.timeMap.projectDurationMs, 5_000);
assert.ok(plan.durationMs < plan.timeMap.projectDurationMs);
assert.equal(plan.timeMap.mapProjectToSource(0), 7_000);
assert.equal(plan.timeMap.mapSourceToProject(500), 3_500);

for (const timeMs of [0, plan.durationMs * 0.25, plan.durationMs * 0.5, plan.durationMs]) {
  assert.deepEqual(plan.previewSample(timeMs), plan.exportSample(timeMs));
  assert.deepEqual(plan.previewSample(timeMs), plan.audioSample(timeMs));
  const sample = plan.previewSample(timeMs);
  assert.ok(Math.abs(plan.timeMap.mapSourceToEffective(sample.sourceTimeMs)! - sample.effectiveTimeMs) < 0.01);
}

const edited = history.present;
history = undoEditingCommand(history);
assert.notDeepEqual(history.present, edited);
history = redoEditingCommand(history);
assert.deepEqual(history.present, edited);

console.log(JSON.stringify({
  status: 'ok',
  checks: [
    'arbitrary repeated Main Track split',
    'clip delete and reorder',
    'manual range speed and typing-event auto speed',
    'source/project/effective bidirectional mapping',
    'Preview/Export/Audio share one render sample',
    'Undo/Redo restores immutable editing documents',
  ],
}, null, 2));
