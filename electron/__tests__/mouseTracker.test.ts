/**
 * Mouse Tracker Test Script
 * 
 * This script validates the mouse tracking functionality:
 * 1. Start tracking
 * 2. Simulate some clicks
 * 3. Stop tracking and verify events
 * 4. Export to JSON file
 */

import { mouseTracker, MouseClickEvent, RecordingBounds } from '../mouseTracker';
import * as assert from 'assert';

console.log('🧪 Testing Mouse Tracker...\n');

// Test 1: Basic start/stop
console.log('Test 1: Basic start/stop');
mouseTracker.start();
let status = mouseTracker.getStatus();
assert.strictEqual(status.isTracking, true, 'Should be tracking');
assert.strictEqual(status.eventCount, 0, 'Should have 0 events');

const events1 = mouseTracker.stop();
status = mouseTracker.getStatus();
assert.strictEqual(status.isTracking, false, 'Should not be tracking');
assert.strictEqual(events1.length, 0, 'Should have returned 0 events');
console.log('✅ Test 1 passed\n');

// Test 2: Record clicks with normalization
console.log('Test 2: Record clicks with coordinate normalization');
const bounds: RecordingBounds = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
};

mouseTracker.start(bounds);

// Simulate clicks
mouseTracker.addClickEvent(960, 540);   // Center: should be (0.5, 0.5)
mouseTracker.addClickEvent(0, 0);       // Top-left: should be (0, 0)
mouseTracker.addClickEvent(1920, 1080); // Bottom-right: should be (1, 1)
mouseTracker.addClickEvent(480, 270);   // Quarter: should be (0.25, 0.25)

const events2 = mouseTracker.stop();
assert.strictEqual(events2.length, 4, 'Should have 4 events');

// Verify normalization
assert.strictEqual(events2[0].cx, 0.5, 'Center X should be 0.5');
assert.strictEqual(events2[0].cy, 0.5, 'Center Y should be 0.5');

assert.strictEqual(events2[1].cx, 0, 'Top-left X should be 0');
assert.strictEqual(events2[1].cy, 0, 'Top-left Y should be 0');

assert.strictEqual(events2[2].cx, 1, 'Bottom-right X should be 1');
assert.strictEqual(events2[2].cy, 1, 'Bottom-right Y should be 1');

assert.strictEqual(events2[3].cx, 0.25, 'Quarter X should be 0.25');
assert.strictEqual(events2[3].cy, 0.25, 'Quarter Y should be 0.25');

console.log('✅ Test 2 passed\n');

// Test 3: Timestamp accuracy
console.log('Test 3: Timestamp accuracy');
mouseTracker.start();

setTimeout(() => {
    mouseTracker.addClickEvent(100, 100);
}, 100);

setTimeout(() => {
    mouseTracker.addClickEvent(200, 200);
}, 200);

setTimeout(() => {
    const events3 = mouseTracker.stop();
    assert.strictEqual(events3.length, 2, 'Should have 2 events');

    assert.ok(events3[0].timestamp >= 100 && events3[0].timestamp < 150,
        `First click should be ~100ms, got ${events3[0].timestamp}ms`);

    assert.ok(events3[1].timestamp >= 200 && events3[1].timestamp < 250,
        `Second click should be ~200ms, got ${events3[1].timestamp}ms`);

    console.log('✅ Test 3 passed\n');
    console.log('🎉 All tests passed!');
}, 300);
