import { generateAutoZooms, RawClickEvent, DEFAULT_AUTO_ZOOM_OPTIONS } from '../generator';
import * as assert from 'assert';

console.log('🧪 Testing Auto-Zoom Generator...\n');

// Mock data helpers
const createClick = (ms: number, type: 'click' = 'click'): RawClickEvent => ({
    timestamp: ms,
    x: 0, y: 0,
    cx: 0.5, cy: 0.5,
    type
});

// Test 1: Basic Conversion
console.log('Test 1: Single click conversion');
const clicks1 = [createClick(1000)];
const regions1 = generateAutoZooms(clicks1);

assert.strictEqual(regions1.length, 1, 'Should create 1 region');
assert.strictEqual(regions1[0].startMs, 1000 - DEFAULT_AUTO_ZOOM_OPTIONS.preRollMs, 'Start should be click - preRoll');
assert.strictEqual(regions1[0].endMs, 1000 + DEFAULT_AUTO_ZOOM_OPTIONS.zoomDurationMs, 'End should be click + duration');
console.log('✅ Test 1 passed\n');

// Test 2: Debouncing
console.log('Test 2: Debouncing rapid clicks');
const clicks2 = [
    createClick(1000),
    createClick(1100), // Within 300ms debounce
    createClick(1500)  // After debounce
];
const regions2 = generateAutoZooms(clicks2);

assert.strictEqual(regions2.length, 2, 'Should create only 2 regions (middle click ignored)');
assert.strictEqual(regions2[0].startMs, 500);
assert.strictEqual(regions2[1].startMs, 1000); // 1500 - 500
console.log('✅ Test 2 passed\n');

// Test 3: Sequential processing (Cut logic)
console.log('Test 3: Sequential cuts');
// Click 1 at 1000 (ends at 2500)
// Click 2 at 2000 (starts at 1500) -> Overlap!
const clicks3 = [createClick(1000), createClick(2000)];
const regions3 = generateAutoZooms(clicks3);

assert.strictEqual(regions3.length, 2, 'Should create 2 regions');
assert.strictEqual(regions3[0].endMs, 1500, 'First region should be cut short at start of second');
assert.strictEqual(regions3[1].startMs, 1500, 'Second region starts at pre-roll time');
console.log('✅ Test 3 passed\n');

console.log('🎉 All generator tests passed!');
