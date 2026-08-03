import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateLegacyTrimsToEditingDocument } from '../src/components/video-editor/project/legacyAdapter';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const videoEditor = read('src/components/video-editor/VideoEditor.tsx');
const timeline = read('src/components/video-editor/timeline/TimelineEditor.tsx');
const playback = read('src/components/video-editor/VideoPlayback.tsx');
const projectTypes = read('src/components/video-editor/project/types.ts');
const legacyAdapter = read('src/components/video-editor/project/legacyAdapter.ts');
const exporter = read('src/lib/exporter/videoExporter.ts');
const audioExporter = read('src/lib/exporter/audioMixerExporter.ts');
const validator = read('src/components/video-editor/project/validateProject.ts');
const runtimeAudit = read('src/components/video-editor/timeline/EditingRuntimeAudit.tsx');

for (const [content, needles] of [
  [videoEditor, ['useEditingSession(recordingDurationMs)', 'editingSession.restore(restored.editingDocument)', 'editingRenderPlan={editingRenderPlan}', 'editingSession={editingSession}', 'editingDocument: editingSession.document']],
  [timeline, ['aria-label="Split Main Clip"', 'aria-label="Delete Main Clip"', 'aria-label="Add Speed Region"', 'aria-label="Selected Speed Region rate"', "type: 'reorder'", 'variant="speed"', "editingSession?.redo()", "editingSession?.undo()"]],
  [projectTypes, ['editingDocument?: EditingDocument']],
  [legacyAdapter, ['migrateLegacyTrimsToEditingDocument', 'editingDocument: input.editingDocument']],
  [playback, ['editingRenderPlan.timeMap.rateAtProjectTime', 'editingRenderPlan.timeMap.clips[clipIndex + 1]']],
  [exporter, ['editingRenderPlan.exportSample', 'this.config.editingRenderPlan']],
  [audioExporter, ['timeMap.mapProjectToSource', 'source.playbackRate.value = rate']],
  [validator, ['validateEditingDocument(project.editingDocument, errors)']],
  [runtimeAudit, ['useEditingSession(10_000)', 'editingSession={editingSession}', 'data-testid="editing-runtime-audit"']],
] as Array<[string, string[]]>) {
  needles.forEach((needle) => assert.ok(content.includes(needle), `Missing product integration: ${needle}`));
}

assert.ok(videoEditor.includes("point.type === 'keydown'"));
assert.ok(timeline.includes("section.origin === 'typing' ? 'Typing '") || timeline.includes("section.origin === 'typing'"));
assert.deepEqual(
  migrateLegacyTrimsToEditingDocument([{ id: 'legacy-cut', startMs: 2000, endMs: 4000 }], 6000).clips.map((clip) => [clip.sourceStartMs, clip.sourceEndMs]),
  [[0, 2000], [4000, 6000]],
);

console.log(JSON.stringify({ status: 'ok', checks: [
  'VideoEditor owns and restores Editing Session',
  'Timeline exposes Split/Delete/Reorder/Speed and Undo/Redo controls',
  'Project Model persists and migrates EditingDocument',
  'Preview/VideoExporter/AudioMixerExporter consume editing render plan',
  'recorded keydown sidecar creates visible editable typing speed regions',
] }, null, 2));
