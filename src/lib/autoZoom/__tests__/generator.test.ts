import { generateAutoZooms, RawClickEvent, DEFAULT_AUTO_ZOOM_OPTIONS } from '../generator';
import * as assert from 'assert';

console.log('🧪 Testing Auto-Zoom Generator...\n');

// Mock data helpers
const createEvent = (
    ms: number,
    type: RawClickEvent['type'] = 'click',
    cx = 0.5,
    cy = 0.5,
): RawClickEvent => ({
    timestamp: ms,
    x: 0, y: 0,
    cx, cy,
    type
});

// Test 1: Basic Conversion
console.log('Test 1: Single click conversion');
const clicks1 = [createEvent(1000)];
const regions1 = generateAutoZooms(clicks1);

assert.strictEqual(regions1.length, 1, 'Should create 1 region');
assert.strictEqual(regions1[0].startMs, 1000 - DEFAULT_AUTO_ZOOM_OPTIONS.preRollMs, 'Start should be click - preRoll');
assert.strictEqual(
    regions1[0].endMs,
    1000 + DEFAULT_AUTO_ZOOM_OPTIONS.zoomDurationMs - DEFAULT_AUTO_ZOOM_OPTIONS.preRollMs,
    'Duration includes pre-roll and post-click hold',
);
assert.strictEqual(regions1[0].focusMode, 'manual', 'Generated Focus must use a fixed composition');
console.log('✅ Test 1 passed\n');

// Test 2: Interaction bursts
console.log('Test 2: Merging clicks from the same interaction burst');
const clicks2 = [
    createEvent(1000),
    createEvent(1100),
    createEvent(1800),
];
const regions2 = generateAutoZooms(clicks2);

assert.strictEqual(regions2.length, 1, 'One interaction burst should create one camera region');
assert.strictEqual(regions2[0].startMs, 1000 - DEFAULT_AUTO_ZOOM_OPTIONS.preRollMs);
console.log('✅ Test 2 passed\n');

// Test 3: Connect nearby fixed camera shots without an empty Focus gap
console.log('Test 3: Connecting nearby fixed camera shots');
const clicks3 = [createEvent(1000), createEvent(3200)];
const regions3 = generateAutoZooms(clicks3);

assert.strictEqual(regions3.length, 2, 'Should create 2 regions');
assert.strictEqual(
    regions3[0].endMs,
    regions3[1].startMs,
    'A short camera handoff must not create an empty Focus gap',
);
console.log('✅ Test 3 passed\n');

console.log('Test 4: Ignoring cursor movement and wheel-only telemetry');
const regions4 = generateAutoZooms([
    createEvent(1000, 'move'),
    createEvent(1400, 'wheel'),
    createEvent(1800, 'move'),
]);
assert.strictEqual(regions4.length, 0, 'Movement and scrolling alone must not create Focus clips');
console.log('✅ Test 4 passed\n');

console.log('Test 5: Holding the final fixed camera through the recording end');
const regions5 = generateAutoZooms([createEvent(4600)], { totalDurationMs: 5000 });
assert.strictEqual(regions5.length, 1, 'An action near the end must still create a Focus clip');
assert.strictEqual(
    regions5[0].endMs,
    5000,
    'The last Focus must hold until the recording ends instead of returning to the base view',
);
console.log('✅ Test 5 passed\n');

console.log('Test 6: Splitting long, continuously active sessions into fixed camera shots');
const regions7 = generateAutoZooms([
    createEvent(1000, 'click', 0.2, 0.3),
    createEvent(2000, 'click', 0.21, 0.31),
    createEvent(3000, 'click', 0.2, 0.3),
    createEvent(4000, 'click', 0.21, 0.31),
    createEvent(5000, 'click', 0.2, 0.3),
    createEvent(6000, 'click', 0.21, 0.31),
    createEvent(7000, 'click', 0.2, 0.3),
    createEvent(8000, 'click', 0.21, 0.31),
    createEvent(9000, 'click', 0.2, 0.3),
    createEvent(10000, 'click', 0.21, 0.31),
]);
assert.ok(regions7.length >= 2, 'A ten-second action stream must not collapse into one Focus clip');
assert.ok(
    regions7.every(region => region.endMs - region.startMs <= DEFAULT_AUTO_ZOOM_OPTIONS.maxRegionMs),
    'Each generated Focus must have a bounded duration',
);
console.log('✅ Test 6 passed\n');

console.log('Test 7: Using deeper zoom for dense local detail work');
const detailRegions = generateAutoZooms([
    createEvent(1000, 'click', 0.48, 0.48),
    createEvent(1200, 'click', 0.49, 0.49),
    createEvent(1450, 'keydown', 0.49, 0.49),
    createEvent(1700, 'keydown', 0.49, 0.49),
    createEvent(1950, 'keydown', 0.5, 0.5),
    createEvent(2200, 'keydown', 0.5, 0.5),
]);
assert.strictEqual(detailRegions.length, 1);
assert.ok(detailRegions[0].depth > DEFAULT_AUTO_ZOOM_OPTIONS.depth, 'Dense local work should select a deeper zoom');
assert.strictEqual(detailRegions[0].focusMode, 'manual', 'The camera must remain fixed inside the Focus clip');
console.log('✅ Test 7 passed\n');

console.log('Test 8: Splitting spatially separate actions into different fixed cameras');
const spatialRegions = generateAutoZooms([
    createEvent(1000, 'click', 0.15, 0.2),
    createEvent(1500, 'click', 0.82, 0.75),
]);
assert.strictEqual(spatialRegions.length, 2, 'Far-apart actions must not share an averaged camera position');
assert.notDeepStrictEqual(spatialRegions[0].focus, spatialRegions[1].focus);
console.log('✅ Test 8 passed\n');

console.log('Test 9: Recognizing detailed pointer motion without creating follow-camera movement');
const pointerDetailRegions = generateAutoZooms([
    createEvent(1000, 'click', 0.45, 0.45),
    createEvent(1100, 'move', 0.48, 0.46),
    createEvent(1200, 'move', 0.52, 0.49),
    createEvent(1300, 'move', 0.47, 0.52),
    createEvent(1450, 'click', 0.5, 0.5),
]);
assert.strictEqual(pointerDetailRegions.length, 1);
assert.ok(pointerDetailRegions[0].depth > DEFAULT_AUTO_ZOOM_OPTIONS.depth, 'Local pointer detail should increase the fixed shot depth');
assert.strictEqual(pointerDetailRegions[0].focusMode, 'manual');
console.log('✅ Test 9 passed\n');

console.log('Test 10: Ending a fixed shot before the pointer leaves its safe viewport');
const departingPointerRegions = generateAutoZooms([
    createEvent(1000, 'click', 0.5, 0.7),
    createEvent(1500, 'click', 0.52, 0.7),
    createEvent(1900, 'move', 0.54, 0.68),
    createEvent(2000, 'move', 0.62, 0.56),
    createEvent(2050, 'move', 0.72, 0.36),
    createEvent(2100, 'move', 0.85, 0.15),
    createEvent(3200, 'click', 0.85, 0.15),
]);
assert.strictEqual(departingPointerRegions.length, 2);
assert.ok(departingPointerRegions[0].endMs <= 2000, 'The transition must begin at the start of the cursor departure burst');
assert.strictEqual(
    departingPointerRegions[0].endMs,
    departingPointerRegions[1].startMs,
    'The cross-screen cursor move should transition directly between fixed shots',
);
console.log('✅ Test 10 passed\n');

console.log('🎉 All generator tests passed!');
