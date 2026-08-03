import assert from 'node:assert/strict';
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project';
import { presenterEffectFromCameraPath } from '../src/components/video-editor/project/presenterContract';
import { recordedShortcutEffects } from '../src/components/video-editor/presentation/presentationEffects';
import { updateHeldKeyState } from '../shared/keyboardModifiers';

const project = createProjectFromLegacyEditorState({
  projectId: 'recording-contract', projectName: 'Recording contract', videoPath: '/tmp/screen.mov', originalVideoPath: '/tmp/screen.mov', companionAudioPath: null,
  durationSeconds: 12, projectDurationSeconds: 12, zoomRegions: [], trimRegions: [], annotationRegions: [], audioRegions: [], cursorData: [], cursorSize: 1,
  cursorSmoothing: true, showVectorCursor: true, cursorOffset: 0, cropRegion: { x: 0, y: 0, width: 1, height: 1 }, wallpaper: '#000', shadowIntensity: 0,
  showBlur: false, borderRadius: 0, padding: 0, aspectRatio: '16:9', exportQuality: '1080p', presentationEffects: [],
});
project.assets.push({ id: 'asset-camera', type: 'video', name: 'Recorded camera', sourceUrl: '', filePath: '/tmp/camera.mov', metadata: { role: 'presenter-camera', posterDataUrl: 'data:image/png;base64,AA==', sourceStartMs: 120 } });
project.tracks.push({ id: 'track-presenter', type: 'presenter', name: 'Presenter', order: 2 });
project.clips.push({ id: 'clip-presenter', type: 'presenter', trackId: 'track-presenter', assetId: 'asset-camera', startMs: 800, endMs: 9800, sourceStartMs: 250, sourceEndMs: 9250, props: { sourceKind: 'camera', layout: 'corner', transform: { x: .72, y: .58, width: .2, height: .32, opacity: 1, borderRadius: 999 }, shape: 'circle', fit: 'contain', visible: true } } as any);

const presenter = restoreLegacyEditorStateFromProjectModel(project).presentationEffects?.find(effect => effect.kind === 'presenter');
assert.ok(presenter && presenter.kind === 'presenter');
assert.deepEqual({ startMs: presenter.startMs, endMs: presenter.endMs, sourceStartMs: presenter.sourceStartMs }, { startMs: 800, endMs: 9800, sourceStartMs: 250 });
assert.equal(presenter.bounds.x, 72); assert.ok(Math.abs(presenter.bounds.y - 58) < .0001); assert.equal(presenter.bounds.width, 20); assert.equal(presenter.bounds.height, 32);
assert.equal(presenter.shape, 'circle'); assert.equal(presenter.fit, 'contain'); assert.equal(presenter.visible, true); assert.match(presenter.sourceUrl ?? '', /camera\.mov/);
assert.equal(presenter.opacity, 1);

const missingProject = structuredClone(project); missingProject.clips[missingProject.clips.length - 1].assetId = 'missing-camera';
const missing = restoreLegacyEditorStateFromProjectModel(missingProject).presentationEffects?.find(effect => effect.kind === 'presenter');
assert.ok(missing && missing.kind === 'presenter' && !missing.sourceUrl, 'missing camera media must restore as an explicit presenter region');

const first = presenterEffectFromCameraPath('/tmp/live-camera.mov', 12000, []); assert.ok(first?.sourceUrl?.includes('live-camera.mov'));
assert.equal(presenterEffectFromCameraPath('/tmp/live-camera.mov', 12000, first ? [first] : []), null, 'first-entry cameraPath must deduplicate');

const held = new Set<number>();
updateHeldKeyState(held, 'keydown', 3675); updateHeldKeyState(held, 'keydown', 42); const modifiers = updateHeldKeyState(held, 'keydown', 25);
assert.deepEqual(modifiers, { meta: true, ctrl: false, alt: false, shift: true });
const shortcut = recordedShortcutEffects([{ timestamp: 500, x: 0, y: 0, cx: 0, cy: 0, type: 'keydown', data: { keycode: 25, heldKeycodes: [...held] }, modifiers }])[0];
assert.deepEqual(shortcut.keys, ['⌘', '⇧', 'P']);
updateHeldKeyState(held, 'keyup', 25); updateHeldKeyState(held, 'keyup', 42); const released = updateHeldKeyState(held, 'keyup', 3675);
assert.deepEqual(released, { meta: false, ctrl: false, alt: false, shift: false });

console.log(JSON.stringify({ status: 'ok', contract: 'recording-presentation', presenterClipRestore: true, firstCameraPath: true, shortcut: shortcut.keys }));
