import assert from 'node:assert/strict';
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project';
import { expandPendingPresenterDuration, presenterEffectFromCameraPath } from '../src/components/video-editor/project/presenterContract';
import { recordedShortcutEffects } from '../src/components/video-editor/presentation/presentationEffects';
import { calculateMediaDrawRect } from '../src/components/video-editor/presentation/presentationGeometry';
import { renderPresentationEffects } from '../src/lib/exporter/presentationRenderer';
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
const pending = presenterEffectFromCameraPath('/tmp/pending-camera.mov', 1, []); assert.ok(pending);
const expanded = expandPendingPresenterDuration(pending ? [pending] : [], 12_345); assert.equal(expanded[0].endMs, 12_345);
const userEdited = pending ? [{ ...pending, endMs: 4500 }] : []; assert.strictEqual(expandPendingPresenterDuration(userEdited, 12_345), userEdited, 'user-edited ranges must not be overwritten');

const held = new Set<number>(); const events: any[] = [];
const push = (timestamp: number, type: 'keydown' | 'keyup', keycode: number) => { const modifiers = updateHeldKeyState(held, type, keycode); events.push({ timestamp, x: 0, y: 0, cx: 0, cy: 0, type, data: { keycode, heldKeycodes: [...held] }, modifiers }); };
push(500, 'keydown', 3675); push(510, 'keydown', 42); push(520, 'keydown', 25); push(560, 'keydown', 25); push(700, 'keydown', 25); push(760, 'keyup', 25); push(770, 'keyup', 42); push(780, 'keyup', 3675);
const shortcuts = recordedShortcutEffects(events); assert.equal(shortcuts.length, 1, 'modifier-only events and key repeat must not create cards'); const shortcut = shortcuts[0];
assert.deepEqual(shortcut.keys, ['⌘', '⇧', 'P']);
assert.deepEqual(events.at(-1).modifiers, { meta: false, ctrl: false, alt: false, shift: false });

assert.deepEqual(calculateMediaDrawRect(1920, 1080, 0, 0, 400, 400, 'cover'), { sx: 420, sy: 0, sw: 1080, sh: 1080, dx: 0, dy: 0, dw: 400, dh: 400 });
assert.deepEqual(calculateMediaDrawRect(1920, 1080, 0, 0, 400, 400, 'contain'), { sx: 0, sy: 0, sw: 1920, sh: 1080, dx: 0, dy: 87.5, dw: 400, dh: 225 });

const commands: Array<{ name: string; args: unknown[]; fillStyle?: unknown }> = []; let fillStyle: unknown;
const context = { canvas: {}, save() {}, restore() {}, beginPath() {}, rect(...args: unknown[]) { commands.push({ name: 'rect', args }); }, roundRect(...args: unknown[]) { commands.push({ name: 'roundRect', args }); }, fill(...args: unknown[]) { commands.push({ name: 'fill', args, fillStyle }); }, fillRect(...args: unknown[]) { commands.push({ name: 'fillRect', args, fillStyle }); }, strokeRect(...args: unknown[]) { commands.push({ name: 'strokeRect', args }); }, set fillStyle(value: unknown) { fillStyle = value; }, get fillStyle() { return fillStyle; }, set globalAlpha(_value: number) {}, set strokeStyle(_value: string) {}, set lineWidth(_value: number) {} } as unknown as CanvasRenderingContext2D;
renderPresentationEffects(context, [{ id: 'highlight-test', kind: 'highlight', startMs: 0, endMs: 1000, bounds: { x: 25, y: 20, width: 50, height: 40 }, color: '#ffcc00', dimOpacity: .5, opacity: .75, radius: 8 }], 800, 600, 500);
assert.deepEqual(commands.find(command => command.name === 'fill')?.args, ['evenodd']);
assert.deepEqual(commands.find(command => command.name === 'fillRect'), { name: 'fillRect', args: [200, 120, 400, 240], fillStyle: '#ffcc00' });

console.log(JSON.stringify({ status: 'ok', contract: 'recording-presentation', presenterClipRestore: true, firstCameraPath: true, shortcut: shortcut.keys }));
