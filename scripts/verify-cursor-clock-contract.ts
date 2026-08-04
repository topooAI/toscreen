import assert from 'node:assert/strict';
import { NativeInputClock, nativeInputTimeToMs } from '../shared/cursorClock';
import { selectNativeCursorSidecar } from '../electron/cursorTelemetry';
import { sampleCursorTrack } from '../src/components/video-editor/videoPlayback/cursorTrack';
import type { CursorDataPoint } from '../src/components/video-editor/types';

assert.equal(nativeInputTimeToMs(1_500_000_000, 'darwin'), 1500);
assert.equal(nativeInputTimeToMs(1500, 'win32'), 1500);

const mediaTimestamp = 1_785_791_721_929;
assert.equal(
  selectNativeCursorSidecar(mediaTimestamp, [
    'temp_cursor_1785791721930.json',
    'temp_cursor_1785791722929.json',
  ]),
  'temp_cursor_1785791721930.json',
  'the nearest native cursor sidecar within the bounded drift must be restored',
);
assert.equal(
  selectNativeCursorSidecar(mediaTimestamp, ['temp_cursor_1785791722930.json']),
  null,
  'a sidecar outside the bounded drift must not attach to another recording',
);

const clock = new NativeInputClock();
const firstNativeTime = clock.observe(1_000_000_000, 6010, 'darwin');
assert.equal(firstNativeTime, 1000);
clock.observe(1_020_000_000, 6022, 'darwin');
clock.observe(1_040_000_000, 6090, 'darwin');
assert.equal(clock.toEpoch(1040), 6042, 'callback latency must not shift native event time');

const longGapTrack: CursorDataPoint[] = [
  { timestamp: 0, x: 0.1, y: 0.1, cx: 0.1, cy: 0.1, type: 'move' },
  { timestamp: 1000, x: 0.9, y: 0.9, cx: 0.9, cy: 0.9, type: 'move' },
];
assert.deepEqual(
  sampleCursorTrack(longGapTrack, 900),
  { x: 0.1, y: 0.1, index: 0, isPointerDown: false, cursorType: 'default' },
  'a stationary gap must not generate phantom cursor motion',
);

const continuousTrack: CursorDataPoint[] = [
  { timestamp: 0, x: 0.1, y: 0.1, cx: 0.1, cy: 0.1, type: 'move' },
  { timestamp: 100, x: 0.3, y: 0.3, cx: 0.3, cy: 0.3, type: 'move' },
];
const continuousSample = sampleCursorTrack(continuousTrack, 50);
assert(continuousSample && continuousSample.x > 0.1 && continuousSample.x < 0.3);

console.log('Cursor clock and sampling contract verified.');
