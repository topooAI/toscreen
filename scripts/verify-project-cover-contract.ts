import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { resolveProjectCoverCandidate } from '../electron/projectCover'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toscreen-project-cover-'))
try {
  const mediaPath = path.join(root, 'recording.mov')
  const coversPath = path.join(root, 'covers')
  await fs.writeFile(mediaPath, 'video-fixture')
  const project = { projectModel: { assets: [{ type: 'screen-recording', filePath: mediaPath }] } }
  const first = await resolveProjectCoverCandidate(project, coversPath)
  const second = await resolveProjectCoverCandidate(project, coversPath)
  assert.ok(first, 'screen recording resolves a cover candidate')
  assert.deepEqual(second, first, 'unchanged source resolves the same cached cover')
  assert.equal(path.dirname(first.outputPath), coversPath, 'covers stay in the project-library cache')

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
