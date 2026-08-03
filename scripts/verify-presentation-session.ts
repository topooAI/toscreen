import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clickProgress, isCursorHiddenAt, recordedShortcutEffects } from '../src/components/video-editor/presentation/presentationEffects';
import type { PresentationEffectRegion } from '../src/components/video-editor/presentation/types';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const effects: PresentationEffectRegion[] = [
  { id: 'mask', kind: 'mask', startMs: 100, endMs: 300, bounds: { x: 10, y: 10, width: 20, height: 20 }, mode: 'blur', blurPx: 18, color: '#111827', radius: 10 },
  { id: 'highlight', kind: 'highlight', startMs: 100, endMs: 300, bounds: { x: 30, y: 30, width: 20, height: 20 }, color: '#FFD748', dimOpacity: .48, radius: 10 },
  { id: 'hidden', kind: 'cursor-hide', startMs: 200, endMs: 400 },
];
assert.equal(isCursorHiddenAt(effects, 199), false);
assert.equal(isCursorHiddenAt(effects, 200), true);
assert.equal(isCursorHiddenAt(effects, 401), false);
assert.equal(clickProgress([{ timestamp: 100, x: .5, y: .5, cx: .5, cy: .5, isClick: true }], 360)?.progress, .5);
assert.equal(recordedShortcutEffects([{ timestamp: 500, x: 0, y: 0, cx: 0, cy: 0, type: 'keydown', data: { keycode: 91 } }])[0].kind, 'keystroke');

const annotationTypes = read('src/components/video-editor/types.ts');
assert.match(annotationTypes, /AnnotationType = 'text' \| 'image' \| 'figure'/);
assert.doesNotMatch(annotationTypes, /AnnotationType[^;]+mask/);
const preview = read('src/components/video-editor/VideoPlayback.tsx');
const frame = read('src/lib/exporter/frameRenderer.ts');
const audio = read('src/lib/exporter/audioMixerExporter.ts');
const adapter = read('src/components/video-editor/project/legacyAdapter.ts');
assert.match(preview, /PresentationOverlay/); assert.match(preview, /useClickSound/); assert.match(preview, /presentationEffects/);
assert.match(frame, /renderPresentationEffects/); assert.match(frame, /clickProgress/); assert.match(frame, /isCursorHiddenAt/);
assert.match(audio, /Synthetic click track/); assert.match(audio, /createOscillator/);
assert.match(adapter, /legacyState:[\s\S]+presentationEffects/); assert.match(adapter, /restoreLegacyEditorStateFromProjectModel[\s\S]+presentationEffects/);
assert.match(read('src/lib/exporter/presentationRenderer.ts'), /effect\.mode === 'cover'[\s\S]+ctx\.filter = `blur/);
assert.match(read('src/lib/exporter/presentationRenderer.ts'), /fill\('evenodd'\)/);
console.log(JSON.stringify({ status: 'ok', contract: 'presentation-session', effects: ['ripple', 'click-sound', 'cursor-hide', 'mask-blur-cover', 'highlight', 'keystroke'] }));
