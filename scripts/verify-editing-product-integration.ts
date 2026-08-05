import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateLegacyTrimsToEditingDocument } from '../src/components/video-editor/project/legacyAdapter';
import { createVideoEventHandlers } from '../src/components/video-editor/videoPlayback/videoEventHandlers';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const videoEditor = read('src/components/video-editor/VideoEditor.tsx');
const timeline = read('src/components/video-editor/timeline/TimelineEditor.tsx');
const sidebar = read('src/components/video-editor/sidebar/Sidebar.tsx');
const playbackControls = read('src/components/video-editor/PlaybackControls.tsx');
const playback = read('src/components/video-editor/VideoPlayback.tsx');
const videoEvents = read('src/components/video-editor/videoPlayback/videoEventHandlers.ts');
const projectTypes = read('src/components/video-editor/project/types.ts');
const legacyAdapter = read('src/components/video-editor/project/legacyAdapter.ts');
const exporter = read('src/lib/exporter/videoExporter.ts');
const audioExporter = read('src/lib/exporter/audioMixerExporter.ts');
const validator = read('src/components/video-editor/project/validateProject.ts');
const runtimeAudit = read('src/components/video-editor/timeline/EditingRuntimeAudit.tsx');

for (const [content, needles] of [
  [videoEditor, ['useEditingSession(recordingDurationMs)', 'editingSession.restore(restored.editingDocument)', 'editingRenderPlan={editingRenderPlan}', 'editingSession={editingSession}', 'editingDocument: editingSession.document']],
  [timeline, ['aria-label="Split Main Clip"', 'aria-label="Delete Main Clip"', "type: 'reorder'", "editingSession?.redo()", "editingSession?.undo()"]],
  [sidebar, ['aria-label="Selected video speed"']],
  [videoEditor, ['setCurrentTime(clipStartEffectiveSeconds)', 'videoPlaybackRef.current.video.currentTime = clipStartSourceSeconds']],
  [timeline, ['current.end > activeDurationMs', 'return createInitialRange(activeDurationMs)']],
  [playbackControls, ['formatTime(duration, true)']],
  [projectTypes, ['editingDocument?: EditingDocument']],
  [legacyAdapter, ['migrateLegacyTrimsToEditingDocument', 'editingDocument: input.editingDocument']],
  [playback, ['const resolvePlaybackRate = useCallback', 'vid.playbackRate = resolvePlaybackRate(vid.currentTime * 1000)', 'editingRenderPlan.timeMap.rateAtProjectTime', 'editingRenderPlan.timeMap.clips[clipIndex + 1]']],
  [videoEvents, ['syncPlaybackRate(video.currentTime * 1000)', 'video.playbackRate = rate']],
  [exporter, ['editingRenderPlan.exportSample', 'this.config.editingRenderPlan']],
  [audioExporter, ['timeMap.mapProjectToSource', 'source.playbackRate.value = rate']],
  [validator, ['validateEditingDocument(project.editingDocument, errors)']],
  [runtimeAudit, ['useEditingSession(10_000)', 'editingSession={editingSession}', 'data-testid="editing-runtime-audit"']],
] as Array<[string, string[]]>) {
  needles.forEach((needle) => assert.ok(content.includes(needle), `Missing product integration: ${needle}`));
}

assert.ok(videoEditor.includes("point.type === 'keydown'"));
assert.ok(videoEditor.includes("type: 'replace-typing-speed'"));
assert.ok(!timeline.includes('aria-label="Add Speed Region"'));
assert.ok(!timeline.includes('aria-label="Selected Speed Region rate"'));
assert.ok(sidebar.includes("return inspector(\n            'Canvas',"));
assert.ok(sidebar.includes('data-inspector-section="video-playback"'));
assert.ok(sidebar.includes('{canvasInspector}'));
assert.ok(sidebar.indexOf('const canvasInspector = (') < sidebar.indexOf('data-inspector-section="video-playback"'));
assert.ok(!sidebar.includes('Changes only this clip.'), 'Speed Inspector should not show explanatory copy below the control.');
assert.ok(
  sidebar.includes('border border-transparent bg-[var(--ui-control)]') && sidebar.includes('hover:border-[var(--ui-border)] focus:border-[#0D99FF]'),
  'Speed Inspector Mixed control should share the transparent-border treatment used by the other selects.',
);
assert.ok(
  timeline.includes('isAssociatedAudioSelected ? 122 : 104'),
  'Main Track must contain the attached-audio accordion at both collapsed and expanded heights.',
);
const blankTimelineClickHandler = timeline.slice(
  timeline.indexOf('const handleTimelineClick'),
  timeline.indexOf('return (', timeline.indexOf('const handleTimelineClick')),
);
for (const clearSelection of [
  'onSelectZoom?.(null);',
  'onSelectTrim?.(null);',
  'onSelectAnnotation?.(null);',
  'onSelectAudio?.(null);',
  'onSelectPresentation?.(null);',
  'onSelectSubtitle?.(null);',
  'onSelectVideo(null);',
]) {
  assert.ok(
    blankTimelineClickHandler.includes(clearSelection),
    `Timeline blank-space click must clear the active Inspector selection: ${clearSelection}`,
  );
}
assert.deepEqual(
  migrateLegacyTrimsToEditingDocument([{ id: 'legacy-cut', startMs: 2000, endMs: 4000 }], 6000).clips.map((clip) => [clip.sourceStartMs, clip.sourceEndMs]),
  [[0, 2000], [4000, 6000]],
);

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
const previewVideo = {
  currentTime: 0.25,
  duration: 10,
  playbackRate: 1,
  paused: false,
  ended: false,
  pause() { this.paused = true; },
} as unknown as HTMLVideoElement;
const previewHandlers = createVideoEventHandlers({
  video: previewVideo,
  isSeekingRef: { current: false },
  isPlayingRef: { current: false },
  allowPlaybackRef: { current: true },
  currentTimeRef: { current: 0 },
  timeUpdateAnimationRef: { current: null },
  onPlayStateChange: () => {},
  onTimeUpdate: () => {},
  trimRegionsRef: { current: [] },
  isSkippingRef: { current: false },
  immuneUntilRef: { current: 0 },
  resolvePlaybackRate: () => 8,
});
previewHandlers.handlePlay();
assert.equal(previewVideo.playbackRate, 8, 'Preview must apply the editing speed rate before media playback advances.');
globalThis.requestAnimationFrame = originalRequestAnimationFrame;

console.log(JSON.stringify({ status: 'ok', checks: [
  'VideoEditor owns and restores Editing Session',
  'Timeline exposes Split/Delete/Reorder and Undo/Redo; Video Inspector owns Speed',
  'Project Model persists and migrates EditingDocument',
  'Preview/VideoExporter/AudioMixerExporter consume editing render plan',
  'Preview applies speed sections from the media playback clock',
  'Timeline blank space clears Main Clip and other Inspector selections',
  'Main Track contains attached audio without visual overflow',
  'Speed Inspector keeps the Mixed control visually consistent without explanatory copy',
  'recorded keydown sidecar remains available to the editing speed engine',
] }, null, 2));
