import assert from 'node:assert/strict';
import { createProductCameraRegion, sampleCameraMotion } from '../src/components/video-editor/videoPlayback/cameraMotion';
import { findInterpolatedTarget } from '../src/components/video-editor/videoPlayback/zoomRegionUtils';

const region = createProductCameraRegion(1_000, 4_000);
const before = sampleCameraMotion([region], 999);
const start = sampleCameraMotion([region], 1_000);
const middle = sampleCameraMotion([region], 2_500);
const end = sampleCameraMotion([region], 4_000);
const after = sampleCameraMotion([region], 4_001);

assert.equal(before.scale, 1, 'Camera Motion must be neutral before its clip');
assert.equal(after.scale, 1, 'Camera Motion must be neutral after its clip');
assert.equal(start.scale, region.cameraMotion?.from.scale);
assert.equal(end.scale, region.cameraMotion?.to.scale);
assert.ok(middle.scale > start.scale && middle.scale < end.scale, 'Camera push must interpolate continuously');
assert.notEqual(middle.rotateZ, 0, 'Product preset must retain its oblique composition');

const focusTarget = findInterpolatedTarget([region], 2_500);
assert.equal(focusTarget.region, null, 'Camera Motion clips must never be sampled as Focus clips');

console.log(JSON.stringify({
  cameraMotion: 'ok',
  preset: region.cameraMotion?.name,
  start,
  middle,
  end,
  focusIsolation: true,
}, null, 2));
