import fs from 'node:fs'
import path from 'node:path'
import {
  mergeCursorShapeTelemetry,
  normalizeNativeCursorEvents,
  rebaseCursorEventsToTimeline,
  resolveCursorTimelineStart,
} from '../electron/cursorTelemetry'
import { prepareCursorTrack, sampleCursorTrack } from '../src/components/video-editor/videoPlayback/cursorTrack'
import {
  CURSOR_STYLE_OPTIONS,
  cursorElementMarkup,
  cursorSvgMarkup,
  normalizeCursorVisualType,
  SUPPORTED_CURSOR_VISUAL_TYPES,
} from '../src/components/video-editor/videoPlayback/cursorVisuals'

const timelineStart = 10_000
const preciseEvents = [
  { timestamp: 0, absoluteTime: timelineStart, nativeTimeMs: 1, x: 0.1, y: 0.2, cx: 0.1, cy: 0.2, type: 'move' },
  { timestamp: 200, absoluteTime: timelineStart + 200, nativeTimeMs: 2, x: 0.3, y: 0.4, cx: 0.3, cy: 0.4, type: 'move' },
  { timestamp: 400, absoluteTime: timelineStart + 400, nativeTimeMs: 3, x: 0.5, y: 0.6, cx: 0.5, cy: 0.6, type: 'move' },
]
const nativeEvents = normalizeNativeCursorEvents([
  { timestamp: 0, unixTimeMs: timelineStart, x: 100, y: 200, cursorType: 'default', videoInfo: { width: 1000, height: 1000 } },
  { timestamp: 150, unixTimeMs: timelineStart + 150, x: 250, y: 350, cursorType: 'pointer', videoInfo: { width: 1000, height: 1000 } },
  { timestamp: 300, unixTimeMs: timelineStart + 300, x: 400, y: 500, cursorType: 'text', videoInfo: { width: 1000, height: 1000 } },
], timelineStart)

const track = prepareCursorTrack(mergeCursorShapeTelemetry(preciseEvents, nativeEvents), false)
if (sampleCursorTrack(track, 175)?.cursorType !== 'pointer') {
  throw new Error('Pointer-hand cursor transitions must be merged into the precise cursor track.')
}
if (sampleCursorTrack(track, 325)?.cursorType !== 'text') {
  throw new Error('Text I-beam cursor transitions must be merged into the precise cursor track.')
}

const textDropoutTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, cursorType: 'text' },
  { timestamp: 100, x: 0.41, y: 0.4, cx: 0.41, cy: 0.4, cursorType: 'default' },
  { timestamp: 260, x: 0.42, y: 0.4, cx: 0.42, cy: 0.4, cursorType: 'default' },
  { timestamp: 285, x: 0.43, y: 0.4, cx: 0.43, cy: 0.4, cursorType: 'text' },
], false)
if (sampleCursorTrack(textDropoutTrack, 180)?.cursorType !== 'text') {
  throw new Error('A short default dropout inside a continuous text state must be suppressed.')
}

const realTextExitTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, cursorType: 'text' },
  { timestamp: 100, x: 0.5, y: 0.5, cx: 0.5, cy: 0.5, cursorType: 'default' },
  { timestamp: 400, x: 0.6, y: 0.6, cx: 0.6, cy: 0.6, cursorType: 'text' },
], false)
if (sampleCursorTrack(realTextExitTrack, 200)?.cursorType !== 'default') {
  throw new Error('A sustained default state must remain a real text-area exit.')
}
const textSpikeTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, cursorType: 'default' },
  { timestamp: 100, x: 0.41, y: 0.4, cx: 0.41, cy: 0.4, cursorType: 'text' },
  { timestamp: 180, x: 0.42, y: 0.4, cx: 0.42, cy: 0.4, cursorType: 'default' },
], false)
if (sampleCursorTrack(textSpikeTrack, 140)?.cursorType !== 'default') {
  throw new Error('A short text spike inside a continuous default state must be suppressed.')
}

const multiStateGlitchTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, cursorType: 'text' },
  { timestamp: 100, x: 0.41, y: 0.4, cx: 0.41, cy: 0.4, cursorType: 'default' },
  { timestamp: 125, x: 0.42, y: 0.4, cx: 0.42, cy: 0.4, cursorType: 'col-resize' },
  { timestamp: 160, x: 0.43, y: 0.4, cx: 0.43, cy: 0.4, cursorType: 'text' },
], false)
if (
  sampleCursorTrack(multiStateGlitchTrack, 110)?.cursorType !== 'text'
  || sampleCursorTrack(multiStateGlitchTrack, 140)?.cursorType !== 'text'
) {
  throw new Error('A short multi-state cursor glitch must not interrupt a sustained text state.')
}

const textSelectionTrack = prepareCursorTrack([
  { timestamp: 0, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, type: 'move', cursorType: 'default' },
  { timestamp: 100, x: 0.4, y: 0.4, cx: 0.4, cy: 0.4, type: 'mousedown', cursorType: 'default' },
  { timestamp: 130, x: 0.42, y: 0.4, cx: 0.42, cy: 0.4, type: 'drag', cursorType: 'text' },
  { timestamp: 180, x: 0.46, y: 0.4, cx: 0.46, cy: 0.4, type: 'drag', cursorType: 'text' },
  { timestamp: 230, x: 0.5, y: 0.4, cx: 0.5, cy: 0.4, type: 'drag', cursorType: 'text' },
  { timestamp: 280, x: 0.5, y: 0.4, cx: 0.5, cy: 0.4, type: 'mouseup', cursorType: 'default' },
  { timestamp: 500, x: 0.6, y: 0.5, cx: 0.6, cy: 0.5, type: 'move', cursorType: 'default' },
], false)
if (
  sampleCursorTrack(textSelectionTrack, 110)?.cursorType !== 'text'
  || sampleCursorTrack(textSelectionTrack, 250)?.cursorType !== 'text'
  || sampleCursorTrack(textSelectionTrack, 500)?.cursorType !== 'default'
) {
  throw new Error('A text-selection drag must keep the text cursor until pointer release.')
}

const explicitTimelineTrack = prepareCursorTrack([
  { timestamp: 850, x: 0.1, y: 0.1, cx: 0.1, cy: 0.1, type: 'move', cursorType: 'default' },
  { timestamp: 1850, x: 0.2, y: 0.2, cx: 0.2, cy: 0.2, type: 'move', cursorType: 'default' },
  { timestamp: 10_850, x: 0.8, y: 0.8, cx: 0.8, cy: 0.8, type: 'move', cursorType: 'default' },
], false, 10_000)
if (
  explicitTimelineTrack[0]?.timestamp !== 850
  || explicitTimelineTrack.at(-1)?.timestamp !== 10_850
) {
  throw new Error('Renderer must not infer cursor offsets from media duration.')
}

const nativeClockEvents = [{
  timestamp: 90,
  unixTimeMs: 10_090,
  x: 100,
  y: 100,
  cursorType: 'text',
  videoInfo: { width: 1000, height: 1000 },
  _syncMetadata: { videoStartTime: 9_000 },
}]
const resolvedClockStart = resolveCursorTimelineStart(nativeClockEvents, 10_000)
if (resolvedClockStart !== 10_000) {
  throw new Error('The event sidecar media clock must override stale native session metadata.')
}
const rebasedPrecise = rebaseCursorEventsToTimeline([{
  timestamp: 130,
  absoluteTime: 10_090,
  x: 0.1,
  y: 0.2,
  cx: 0.1,
  cy: 0.2,
}], resolvedClockStart)
if (rebasedPrecise[0]?.timestamp !== 90) {
  throw new Error('Precise cursor events must share the native sidecar media clock.')
}
if (normalizeCursorVisualType('pointer') !== 'pointer' || normalizeCursorVisualType('text') !== 'text') {
  throw new Error('Cursor visual variants must normalize pointer and text types.')
}

const nativeCursorStates = [
  'default', 'pointer', 'text', 'vertical-text', 'grab', 'grabbing',
  'copy', 'alias', 'context-menu', 'not-allowed', 'help', 'progress',
  'crosshair', 'all-scroll', 'zoom-in', 'zoom-out', 'row-resize',
  'col-resize', 'ns-resize', 'nwse-resize', 'nesw-resize', 'none',
] as const
if (SUPPORTED_CURSOR_VISUAL_TYPES.length !== nativeCursorStates.length) {
  throw new Error('The native cursor state inventory is incomplete.')
}
for (const cursorType of nativeCursorStates) {
  if (normalizeCursorVisualType(cursorType) !== cursorType) {
    throw new Error(`Native cursor state is not preserved: ${cursorType}`)
  }
  const markup = cursorSvgMarkup(cursorType)
  if (cursorType === 'none' ? markup !== '' : !markup.includes(`data-cursor-type="${cursorType}"`)) {
    throw new Error(`Native cursor state has no matching SVG: ${cursorType}`)
  }
}

for (const style of CURSOR_STYLE_OPTIONS) {
  for (const cursorType of nativeCursorStates.filter(type => type !== 'none')) {
    const markup = cursorSvgMarkup(cursorType, style.id)
    if (!markup.includes(`data-cursor-type="${cursorType}"`)) {
      throw new Error(`Cursor style ${style.id} does not render ${cursorType}.`)
    }
    if (!markup.includes(style.fill) || !markup.includes(style.stroke)) {
      throw new Error(`Cursor style ${style.id} colors are missing from ${cursorType}.`)
    }
  }
}

const customCursorImage = 'data:image/png;base64,dG9zY3JlZW4tY3Vyc29y'
const customMarkup = cursorElementMarkup('pointer', 'custom', { pointer: customCursorImage })
if (!customMarkup.includes('data-cursor-type="pointer"') || !customMarkup.includes(customCursorImage)) {
  throw new Error('Custom cursor image must render independently from built-in SVG styles.')
}
const customFallbackMarkup = cursorElementMarkup('text', 'custom', { pointer: customCursorImage })
if (!customFallbackMarkup.includes('data-cursor-type="text"') || customFallbackMarkup.includes(customCursorImage)) {
  throw new Error('Missing custom cursor states must fall back to the matching built-in shape.')
}

const aliases = {
  wait: 'progress',
  cell: 'crosshair',
  move: 'all-scroll',
  'no-drop': 'not-allowed',
  'ew-resize': 'col-resize',
  'n-resize': 'ns-resize',
  'se-resize': 'nwse-resize',
  'sw-resize': 'nesw-resize',
} as const
for (const [sourceType, expectedType] of Object.entries(aliases)) {
  if (normalizeCursorVisualType(sourceType) !== expectedType) {
    throw new Error(`Cursor alias ${sourceType} must map to ${expectedType}.`)
  }
}

const root = process.cwd()
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const handlers = read('electron/ipc/handlers.ts')
const preview = read('src/components/video-editor/hooks/useCursorRenderer.ts')
const exporter = read('src/lib/exporter/frameRenderer.ts')
const sidebar = read('src/components/video-editor/sidebar/Sidebar.tsx')
const cursorControls = read('src/components/video-editor/sidebar/CursorControls.tsx')
const legacyAdapter = read('src/components/video-editor/project/legacyAdapter.ts')

for (const [source, contract] of [
  [handlers, 'mergeCursorShapeTelemetry(eventDrivenClicks, nativeEvents)'],
  [preview, 'cursorElementMarkup(currentCursorType, currentCursorStyle, currentCustomImages)'],
  [exporter, 'drawCursorVisual(this.compositeCtx'],
] as const) {
  if (!source.includes(contract)) throw new Error(`Missing cursor variant contract: ${contract}`)
}

for (const contract of [
  'const targetSizePx = 56 * displayScale',
  'cursor.style.width = `${targetSizePx}px`',
  'cursor.style.height = `${targetSizePx}px`',
  'const animationScale = jiggleScale * pressedScale',
] as const) {
  if (!preview.includes(contract)) throw new Error(`Missing sharp cursor sizing contract: ${contract}`)
}
if (preview.includes('pressedScale * displayScale')) {
  throw new Error('Cursor size must not be applied through CSS transform scaling.')
}

if ((sidebar.match(/\{cursorInspector\}/g) || []).length < 5) {
  throw new Error('Cursor controls must remain available in every sidebar inspector context.')
}
if (!cursorControls.includes('CURSOR_STYLE_OPTIONS.map')) {
  throw new Error('Cursor controls must expose the visual style library.')
}
if (!cursorControls.includes('CURSOR_CUSTOMIZABLE_STATES.map') || !cursorControls.includes('onCursorCustomImagesChange')) {
  throw new Error('Cursor controls must support per-state custom cursor pack upload.')
}
if (!legacyAdapter.includes('style: resolveCursorStyle(input.cursorStyle, input.showVectorCursor)')) {
  throw new Error('Cursor style must persist in the project cursor clip.')
}
if (!legacyAdapter.includes('customImages: cursorCustomImages')) {
  throw new Error('Custom cursor pack must persist in the project cursor clip.')
}

console.log(`${nativeCursorStates.length} cursor states across ${CURSOR_STYLE_OPTIONS.length} persistent styles verified.`)
