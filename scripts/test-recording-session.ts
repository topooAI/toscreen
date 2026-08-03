import assert from 'node:assert/strict'
import { clampSelection, selectionToGlobalBounds } from '../src/components/launch/recordingGeometry'
import { mergeSegmentEvents, totalSegmentDuration } from '../electron/recordingTimeline'
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project/legacyAdapter'

assert.deepEqual(clampSelection({ x: -5, y: 90, width: 80, height: 30 }, { x: 0, y: 0, width: 100, height: 100 }), { x: 0, y: 68, width: 80, height: 32 })
assert.deepEqual(selectionToGlobalBounds({ x: 50, y: 25, width: 100, height: 50 }, { x: 0, y: 0, width: 200, height: 100 }, { x: -1920, y: 0, width: 1920, height: 1080 }), { x: -1440, y: 270, width: 960, height: 540 })

const merged = mergeSegmentEvents([
  { videoStartTime: 1000, durationMs: 500, events: [{ absoluteTime: 1100, nativeTimeMs: 1, id: 'a' }, { absoluteTime: 1600, id: 'late' }] },
  { videoStartTime: 3000, durationMs: 400, events: [{ absoluteTime: 3050, nativeTimeMs: 2, id: 'b' }] },
], 1000)
assert.deepEqual(merged.map(event => [event.id, event.absoluteTime]), [['a', 1100], ['b', 1550]])
assert.equal(totalSegmentDuration([{ durationMs: 500 }, { durationMs: 400 }]), 900)

const project = createProjectFromLegacyEditorState({
  videoPath: '/tmp/screen-proxy.mp4', originalVideoPath: '/tmp/screen.mov', companionAudioPath: '/tmp/system.webm', cameraPath: '/tmp/camera.mov',
  durationSeconds: 10, projectDurationSeconds: 10, zoomRegions: [], trimRegions: [], annotationRegions: [], cursorData: [], cursorSize: 1, cursorSmoothing: true,
  showVectorCursor: true, cursorOffset: 0, cropRegion: { x: 0, y: 0, width: 1, height: 1 }, wallpaper: '', shadowIntensity: 0, showBlur: false,
  motionBlurEnabled: false, borderRadius: 0, padding: 0, aspectRatio: '16:9', exportQuality: 'good',
  audioRegions: [
    { id: 'system', startMs: 0, endMs: 10000, sourceUrl: 'file:///tmp/system.webm', path: '/tmp/system.webm', volume: 1, role: 'system-audio' },
    { id: 'mic', startMs: 0, endMs: 10000, sourceUrl: 'file:///tmp/mic.webm', path: '/tmp/mic.webm', volume: 0.8, isMuted: true, role: 'microphone' },
  ],
})
assert.equal(project.tracks.filter(track => track.type === 'presenter').length, 1)
assert.equal(project.clips.filter(clip => clip.type === 'presenter').length, 1)
assert.deepEqual(project.assets.filter(asset => asset.type === 'audio').map(asset => asset.metadata?.role).filter(Boolean).sort(), ['companion-audio', 'microphone', 'system-audio'])
const restored = restoreLegacyEditorStateFromProjectModel(project)
assert.equal(restored.cameraPath, '/tmp/camera.mov')
assert.deepEqual(restored.audioRegions.map(region => [region.role, region.volume, Boolean(region.isMuted)]), [['system-audio', 1, false], ['microphone', 0.8, true]])

console.log('Recording session executable tests passed: geometry, multi-display mapping, segment timeline, presenter track, independent audio restore.')
