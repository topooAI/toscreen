import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { PROJECT_COVER_WIDTH_PX, resolveProjectCoverCandidate } from '../electron/projectCover'
import { resolveProjectCoverInteractionFocus } from '../electron/projectLibrary'
import { locateProjectCoverContent } from '../src/components/projects/projectCoverFocus'
import { estimateVisibleSourceWidth, getProjectCoverDetailScale, getProjectCoverMaxFrameScale } from '../src/components/projects/projectCoverScale'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toscreen-project-cover-'))
try {
  const mediaPath = path.join(root, 'recording.mov')
  const coversPath = path.join(root, 'covers')
  await fs.writeFile(mediaPath, 'video-fixture')
  const project = {
    cursorData: [{ videoInfo: { width: 3840, height: 2160 } }],
    projectModel: { assets: [{ type: 'screen-recording', filePath: mediaPath }] },
  }
  const first = await resolveProjectCoverCandidate(project, coversPath)
  const second = await resolveProjectCoverCandidate(project, coversPath)
  assert.ok(first, 'screen recording resolves a cover candidate')
  assert.deepEqual(second, first, 'unchanged source resolves the same cached cover')
  assert.equal(path.dirname(first.outputPath), coversPath, 'covers stay in the project-library cache')
  assert.equal(first.sourceWidth, 3840, 'cover candidate preserves the recording width')
  assert.equal(first.sourceHeight, 2160, 'cover candidate preserves the recording height')
  assert.equal(PROJECT_COVER_WIDTH_PX, 3840, '4K covers retain native pixels for local detail magnification')

  const fourKScale = getProjectCoverDetailScale(3840)
  const threeKScale = getProjectCoverDetailScale(3000)
  assert.ok(fourKScale > threeKScale, 'higher-resolution recordings receive proportionally more cover magnification')
  assert.ok(fourKScale > 2.8 && threeKScale > 2.2, 'project covers magnify into a readable local detail range')
  assert.ok(estimateVisibleSourceWidth(PROJECT_COVER_WIDTH_PX, fourKScale) >= 740,
    '4K cover crops remain downsampled instead of being stretched across the card')
  assert.ok(Math.abs(estimateVisibleSourceWidth(3840, fourKScale) - estimateVisibleSourceWidth(3000, threeKScale)) < 2,
    '3K and 4K recordings retain the same readable source-detail span')
  const fourKMaxFrameScale = getProjectCoverMaxFrameScale(3840, 2160)
  assert.ok(fourKMaxFrameScale > 4.5,
    '4K cover frames can grow well beyond the former 1.8x ceiling')
  assert.ok(estimateVisibleSourceWidth(3840, fourKScale) * fourKMaxFrameScale / 3840 * 100 <= 92.1,
    'maximum cover frame stays inside the safe preview boundary')

  const syntheticWidth = 40
  const syntheticHeight = 24
  const synthetic = new Uint8ClampedArray(syntheticWidth * syntheticHeight * 4).fill(255)
  for (let y = 5; y < 18; y += 2) for (let x = 23; x < 37; x += 2) {
    const offset = (y * syntheticWidth + x) * 4
    synthetic[offset] = synthetic[offset + 1] = synthetic[offset + 2] = 28
  }
  const detected = locateProjectCoverContent(synthetic, syntheticWidth, syntheticHeight)
  assert.ok(detected.x > 51, 'content locator moves a blank center toward the information-dense region')

  const toolbarWidth = 80
  const toolbarHeight = 44
  const toolbarFixture = new Uint8ClampedArray(toolbarWidth * toolbarHeight * 4).fill(255)
  const setDark = (x: number, y: number) => {
    const offset = (y * toolbarWidth + x) * 4
    toolbarFixture[offset] = toolbarFixture[offset + 1] = toolbarFixture[offset + 2] = 24
  }
  for (let y = 12; y <= 30; y += 6) for (let x = 18; x <= 42; x += 1) setDark(x, y)
  for (let y = 8; y <= 34; y += 7) for (let yy = y; yy < y + 3; yy += 1) for (let x = 62; x <= 65; x += 1) setDark(x, yy)
  const toolbarDetected = locateProjectCoverContent(toolbarFixture, toolbarWidth, toolbarHeight)
  assert.ok(toolbarDetected.x < 56, 'content locator prefers distributed text over a narrow high-contrast toolbar')

  const edgeChromeFixture = new Uint8ClampedArray(toolbarWidth * toolbarHeight * 4).fill(255)
  for (let y = 1; y <= 4; y += 1) for (let x = 3; x <= 76; x += 2) {
    const offset = (y * toolbarWidth + x) * 4
    edgeChromeFixture[offset] = edgeChromeFixture[offset + 1] = edgeChromeFixture[offset + 2] = 18
  }
  for (let y = 15; y <= 31; y += 5) for (let x = 26; x <= 49; x += 2) {
    const offset = (y * toolbarWidth + x) * 4
    edgeChromeFixture[offset] = edgeChromeFixture[offset + 1] = edgeChromeFixture[offset + 2] = 36
  }
  const edgeChromeDetected = locateProjectCoverContent(edgeChromeFixture, toolbarWidth, toolbarHeight)
  assert.ok(edgeChromeDetected.y > 24, 'content locator ignores dense browser chrome at the frame edge')

  const stableFixture = new Uint8ClampedArray(toolbarWidth * toolbarHeight * 4).fill(255)
  for (let y = 14; y <= 30; y += 5) for (let x = 31; x <= 49; x += 2) {
    const offset = (y * toolbarWidth + x) * 4
    stableFixture[offset] = stableFixture[offset + 1] = stableFixture[offset + 2] = 34
  }
  for (let y = 9; y <= 34; y += 4) for (let x = 60; x <= 66; x += 1) {
    const offset = (y * toolbarWidth + x) * 4
    stableFixture[offset] = stableFixture[offset + 1] = stableFixture[offset + 2] = 20
  }
  const stableDetected = locateProjectCoverContent(stableFixture, toolbarWidth, toolbarHeight)
  assert.ok(stableDetected.x < 58, 'a usable center regularizes isolated high-contrast landmarks')

  const illustrationFixture = new Uint8ClampedArray(toolbarWidth * toolbarHeight * 4).fill(248)
  for (let y = 12; y <= 31; y += 4) for (let x = 20; x <= 45; x += 2) {
    const offset = (y * toolbarWidth + x) * 4
    illustrationFixture[offset] = illustrationFixture[offset + 1] = illustrationFixture[offset + 2] = 190
  }
  for (let y = 10; y <= 34; y += 1) for (let x = 57; x <= 67; x += 1) {
    const offset = (y * toolbarWidth + x) * 4
    illustrationFixture[offset] = illustrationFixture[offset + 1] = illustrationFixture[offset + 2] = 18
  }
  const illustrationDetected = locateProjectCoverContent(illustrationFixture, toolbarWidth, toolbarHeight, { x: 53, y: 55 })
  assert.ok(illustrationDetected.x < 56, 'fine interface detail outranks one large dark illustration landmark')

  assert.deepEqual(
    resolveProjectCoverInteractionFocus({ cursorData: [{ cx: .55, cy: .69 }] }),
    { x: 53.25, y: 66.7 },
    'the first valid recording interaction guides the cover while staying inside the title-safe area',
  )
  assert.equal(resolveProjectCoverInteractionFocus({ cursorData: [] }), undefined,
    'projects without pointer telemetry fall back to image content location')

  await fs.appendFile(mediaPath, '-changed')
  const changed = await resolveProjectCoverCandidate(project, coversPath)
  assert.ok(changed)
  assert.notEqual(changed.sourceSignature, first.sourceSignature, 'changed source invalidates its cover')

  const handlers = await fs.readFile(path.join(process.cwd(), 'electron/ipc/handlers.ts'), 'utf8')
  const saveProjectBlock = handlers.match(/ipcMain\.handle\('save-project'[\s\S]*?\n  \}\);/)?.[0] || ''
  assert.doesNotMatch(saveProjectBlock, /generateProjectCover|scheduleProjectCover/, 'autosave never invokes FFmpeg cover generation')
  assert.match(handlers, /project-list-recent[\s\S]*?scheduleProjectCover/, 'missing covers are backfilled from the Projects page')
  assert.match(handlers, /project-list-recent[\s\S]*?thumbnailFocus:[\s\S]*?resolveProjectCoverInteractionFocus\(project\)/,
    'Projects exposes interaction-guided cover focus without mutating the saved project')
  assert.match(handlers, /entry\.thumbnailMode === 'custom'[\s\S]*?thumbnailFocus:/,
    'custom cover focus persists while derived automatic focus remains transient')
  assert.match(handlers, /project-set-cover[\s\S]*?generateProjectCoverAtTime/,
    'custom cover selection captures the requested source frame')
  assert.match(handlers, /project-set-cover[\s\S]*?frameScale[\s\S]*?thumbnailFrameScale:\s*frameScale/,
    'custom cover selection persists its bounded frame size')
  assert.match(handlers, /project-set-cover[\s\S]*?getProjectCoverMaxFrameScale\(candidate\.sourceWidth, candidate\.sourceHeight\)/,
    'custom cover persistence shares the source-aware frame boundary')
  assert.match(handlers, /project-reset-cover[\s\S]*?scheduleProjectCover/,
    'custom covers can return to automatic frame selection and positioning')

  const preload = await fs.readFile(path.join(process.cwd(), 'electron/preload.ts'), 'utf8')
  const home = await fs.readFile(path.join(process.cwd(), 'src/components/projects/ProjectHome.tsx'), 'utf8')
  const coverEditor = await fs.readFile(path.join(process.cwd(), 'src/components/projects/ProjectCoverEditor.tsx'), 'utf8')
  const homeStyles = await fs.readFile(path.join(process.cwd(), 'src/components/projects/ProjectHome.module.css'), 'utf8')
  assert.match(preload, /onProjectCoversUpdated/, 'main process exposes one cover-ready event')
  assert.match(preload, /getProjectCoverEditor[\s\S]*?setProjectCover[\s\S]*?resetProjectCover/,
    'renderer receives the bounded custom cover API')
  assert.match(home, /onProjectCoversUpdated/, 'Projects page refreshes when a cover is ready')
  assert.match(home, /Choose cover…/, 'card actions expose the custom cover editor')
  assert.match(coverEditor, /chooseFocus[\s\S]*?type="range"[\s\S]*?Save cover/,
    'cover editor selects both a source frame and a focal point')
  assert.match(coverEditor, /onPointerDown[\s\S]*?setPointerCapture[\s\S]*?onPointerMove[\s\S]*?coverEditorCrop/,
    'cover editor exposes a directly draggable crop box')
  assert.match(coverEditor, /beginCropResize[\s\S]*?Resize cover from top left[\s\S]*?Resize cover from bottom right/,
    'cover editor exposes direct corner handles for enlarging and shrinking the crop box')
  assert.match(coverEditor, /getProjectCoverMaxFrameScale\(info\.sourceWidth, info\.sourceHeight\)/,
    'cover editor expands to the source-aware preview boundary instead of a fixed 1.8x ceiling')
  assert.match(coverEditor, /updateCropDrag[\s\S]*?stopPropagation\(\)/,
    'crop resize movement cannot bubble into preview repositioning')
  assert.doesNotMatch(coverEditor, /Cover frame size|coverEditorSize/,
    'cover editor does not add a separate size slider')
  assert.match(coverEditor, /Use automatic/, 'cover editor keeps automatic selection available')
  assert.match(home, /project\.thumbnailFocus\s*\|\|\s*locateProjectCoverImage/,
    'recorded interaction focus takes authority over image-only saliency')
  assert.match(home, /const focus = project\.thumbnailFocus \|\| detectedFocus/,
    'saved custom cover focus takes authority over stale detected card focus')
  assert.match(home, /getProjectCoverDetailScale\(project\.thumbnailSourceWidth\)\s*\/\s*Math\.max\(\.65,\s*project\.thumbnailFrameScale/,
    'saved frame size controls the rendered project-cover magnification')
  assert.match(homeStyles, /\.coverScene[\s\S]*?transform-origin:\s*50% 50%/, 'oblique projection stays centered on the located content')
  assert.match(homeStyles, /\.coverEditorCrop[\s\S]*?box-shadow:[^;]*9999px/,
    'crop editor clearly masks the area outside the selected frame')
  assert.match(homeStyles, /\.coverEditorHandleNW[\s\S]*?nwse-resize[\s\S]*?\.coverEditorHandleSE/,
    'crop box corner handles advertise direct resize interaction')
  assert.match(homeStyles, /\.coverEditorDialog[\s\S]*?font-synthesis:\s*none[\s\S]*?text-shadow:\s*none/,
    'cover editor uses the loaded font weight without synthetic or shadowed text')
  assert.match(homeStyles, /::-webkit-slider-runnable-track[\s\S]*?::-webkit-slider-thumb/,
    'cover frame timeline has a visible track and draggable thumb')
  assert.match(homeStyles, /\.coverLensFocus[\s\S]*?filter:\s*none/, 'the readable center is not softened by a second raster filter')
  assert.doesNotMatch(home, /coverLensBlur/, 'the clear source image is rendered only once')
  assert.doesNotMatch(home, /coverDepth(?:Blur|Soft|Medium|Strong)/, 'card never overlays synthetic blur bands')
  assert.doesNotMatch(homeStyles, /\.coverDepth(?:Blur|Soft|Medium|Strong)/, 'stylesheet contains no synthetic blur bands')
  assert.match(homeStyles, /\.coverScene[\s\S]*?matrix\(\.978148,\s*-\.207912,\s*\.573576,\s*\.819152,\s*0,\s*0\)/,
    'cover plane uses equal-length shallow dimetric axes instead of rotation or a steep ground-plane projection')
  assert.doesNotMatch(homeStyles, /\.coverStage[\s\S]*?perspective:/, 'cover angle remains isometric without near-far perspective distortion')
  assert.doesNotMatch(home, /data-camera|getCameraDirection/, 'every project card shares one camera geometry')
  assert.doesNotMatch(homeStyles, /data-camera/, 'stylesheet has no per-card camera variants')
  assert.match(homeStyles, /\.duration\s*\{[\s\S]*?z-index:\s*4;/, 'duration stays sharp above the depth blur')
  assert.match(homeStyles, /\.meta\s*\{[\s\S]*?z-index:\s*4;/, 'project metadata stays sharp above the depth blur')
  console.log('project cover contract: PASS')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
