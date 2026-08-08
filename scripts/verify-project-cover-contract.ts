import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { PROJECT_COVER_WIDTH_PX, resolveProjectCoverCandidate } from '../electron/projectCover'
import { locateProjectCoverContent } from '../src/components/projects/projectCoverFocus'
import { estimateVisibleSourceWidth, getProjectCoverDetailScale } from '../src/components/projects/projectCoverScale'

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
  assert.ok(fourKScale > 5.5 && threeKScale > 4.3, 'project covers magnify into a readable local detail range')
  assert.ok(estimateVisibleSourceWidth(PROJECT_COVER_WIDTH_PX, fourKScale) >= 400,
    '4K cover crops remain downsampled instead of being stretched across the card')
  assert.ok(Math.abs(estimateVisibleSourceWidth(3840, fourKScale) - estimateVisibleSourceWidth(3000, threeKScale)) < 2,
    '3K and 4K recordings retain the same readable source-detail span')

  const syntheticWidth = 40
  const syntheticHeight = 24
  const synthetic = new Uint8ClampedArray(syntheticWidth * syntheticHeight * 4).fill(255)
  for (let y = 5; y < 18; y += 2) for (let x = 23; x < 37; x += 2) {
    const offset = (y * syntheticWidth + x) * 4
    synthetic[offset] = synthetic[offset + 1] = synthetic[offset + 2] = 28
  }
  const detected = locateProjectCoverContent(synthetic, syntheticWidth, syntheticHeight)
  assert.ok(detected.x > 55, 'content locator avoids a blank center and selects the information-dense region')

  await fs.appendFile(mediaPath, '-changed')
  const changed = await resolveProjectCoverCandidate(project, coversPath)
  assert.ok(changed)
  assert.notEqual(changed.sourceSignature, first.sourceSignature, 'changed source invalidates its cover')

  const handlers = await fs.readFile(path.join(process.cwd(), 'electron/ipc/handlers.ts'), 'utf8')
  const saveProjectBlock = handlers.match(/ipcMain\.handle\('save-project'[\s\S]*?\n  \}\);/)?.[0] || ''
  assert.doesNotMatch(saveProjectBlock, /generateProjectCover|scheduleProjectCover/, 'autosave never invokes FFmpeg cover generation')
  assert.match(handlers, /project-list-recent[\s\S]*?scheduleProjectCover/, 'missing covers are backfilled from the Projects page')

  const preload = await fs.readFile(path.join(process.cwd(), 'electron/preload.ts'), 'utf8')
  const home = await fs.readFile(path.join(process.cwd(), 'src/components/projects/ProjectHome.tsx'), 'utf8')
  const homeStyles = await fs.readFile(path.join(process.cwd(), 'src/components/projects/ProjectHome.module.css'), 'utf8')
  assert.match(preload, /onProjectCoversUpdated/, 'main process exposes one cover-ready event')
  assert.match(home, /onProjectCoversUpdated/, 'Projects page refreshes when a cover is ready')
  assert.match(homeStyles, /\.coverScene[\s\S]*?transform-origin:\s*50% 50%/, 'isometric projection keeps the located content pinned to the card center')
  assert.match(homeStyles, /\.coverLensFocus[\s\S]*?filter:\s*none/, 'the readable center is not softened by a second raster filter')
  assert.doesNotMatch(home, /coverLensBlur/, 'the clear source image is rendered only once')
  assert.match(home, /coverDepthSoft[\s\S]*coverDepthMedium[\s\S]*coverDepthStrong/, 'card uses projection-independent graduated depth layers')
  assert.match(homeStyles, /\.coverDepthSoft::before,[\s\S]*?height:\s*36%[\s\S]*?blur\(\.7px\)/, 'soft depth layer begins the card-space focus falloff')
  assert.match(homeStyles, /\.coverDepthMedium::before,[\s\S]*?height:\s*27%[\s\S]*?blur\(1\.5px\)/, 'medium depth layer continues the focus falloff')
  assert.match(homeStyles, /\.coverDepthStrong::before,[\s\S]*?height:\s*17%[\s\S]*?blur\(2\.8px\)/, 'strong depth layer is restricted to the outer edge')
  assert.match(homeStyles, /\.duration\s*\{[\s\S]*?z-index:\s*4;/, 'duration stays sharp above the depth blur')
  assert.match(homeStyles, /\.meta\s*\{[\s\S]*?z-index:\s*4;/, 'project metadata stays sharp above the depth blur')
  console.log('project cover contract: PASS')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
