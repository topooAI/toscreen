import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { PROJECT_COVER_WIDTH_PX, resolveProjectCoverCandidate } from '../electron/projectCover'
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
  assert.equal(PROJECT_COVER_WIDTH_PX, 1920, 'cached covers retain enough pixels for local detail magnification')

  const fourKScale = getProjectCoverDetailScale(3840)
  const threeKScale = getProjectCoverDetailScale(3000)
  assert.ok(fourKScale > threeKScale, 'higher-resolution recordings receive proportionally more cover magnification')
  assert.ok(fourKScale > 3.5 && threeKScale > 2.8, 'project covers magnify into a readable local detail range')
  assert.ok(Math.abs(estimateVisibleSourceWidth(3840, fourKScale) - estimateVisibleSourceWidth(3000, threeKScale)) < 2,
    '3K and 4K recordings retain the same readable source-detail span')

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
  assert.match(preload, /onProjectCoversUpdated/, 'main process exposes one cover-ready event')
  assert.match(home, /onProjectCoversUpdated/, 'Projects page refreshes when a cover is ready')
  console.log('project cover contract: PASS')
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
