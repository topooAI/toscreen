import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  applyPreset, atomicWriteJson, collectProjectAssetPaths, createPortablePackage, createPreset, importPortablePackage, readJsonWithBackup,
  transitionProjectDocument,
} from '../electron/projectLibrary'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toscreen-projects-'))
try {
  const media = path.join(root, 'recording.webm'); await fs.writeFile(media, 'video-data')
  const projectPath = path.join(root, 'Demo.toscreen')
  const project = { id: 'p1', name: 'Demo', canvas: { padding: 12, wallpaper: '/wallpapers/wallpaper1.jpg' }, exportSettings: { quality: 'high' }, assets: [{ filePath: media, sourceUrl: `file://${media}` }, { sourceUrl: 'toscreen://music/builtin.mp3' }], clips: [{ id: 'clip-1' }], editingDocument: { clips: [{ id: 'main-1' }], speedSections: [] }, legacyState: { cursorSize: 2 } }
  await atomicWriteJson(projectPath, project)
  assert.deepEqual(collectProjectAssetPaths(project), [media], 'only user file media is portable')
  await atomicWriteJson(projectPath, { ...project, name: 'Demo v2' })
  await fs.writeFile(projectPath, '{broken')
  assert.equal((await readJsonWithBackup(projectPath)).value.name, 'Demo', 'first corruption restores valid backup')
  await fs.writeFile(projectPath, '{broken-again')
  assert.equal((await readJsonWithBackup(projectPath)).value.name, 'Demo', 'recovery does not overwrite backup with corrupt primary')
  assert.equal(transitionProjectDocument('/old.toscreen', { type: 'new' }), null, 'New Project resets previous save target')
  assert.equal(transitionProjectDocument(null, { type: 'save-as', projectPath }), projectPath)
  assert.equal(transitionProjectDocument(projectPath, { type: 'open', projectPath: '/next.toscreen' }), '/next.toscreen')

  const packagePath = path.join(root, 'Demo.toscreenpkg'); await createPortablePackage(projectPath, packagePath)
  const destination = path.join(root, 'imported'); const imported = await importPortablePackage(packagePath, destination)
  assert.equal((await fs.readFile((imported.project as any).assets[0].filePath, 'utf8')), 'video-data')
  assert.ok((imported.project as any).assets[0].filePath.startsWith(destination), 'import rewrites absolute media path')

  const unsafe = JSON.parse(await fs.readFile(packagePath, 'utf8')); unsafe.assets[0].relativePath = '../escape.webm'
  const unsafePath = path.join(root, 'unsafe.toscreenpkg'); await atomicWriteJson(unsafePath, unsafe)
  await assert.rejects(importPortablePackage(unsafePath, path.join(root, 'unsafe-import')), /Unsafe package path/)
  const corrupt = JSON.parse(await fs.readFile(packagePath, 'utf8')); corrupt.assets[0].data = Buffer.from('tampered').toString('base64')
  const corruptPath = path.join(root, 'corrupt.toscreenpkg'); await atomicWriteJson(corruptPath, corrupt)
  const corruptDest = path.join(root, 'corrupt-import'); await assert.rejects(importPortablePackage(corruptPath, corruptDest), /checksum failed/)
  assert.deepEqual(await fs.readdir(corruptDest).catch(() => []), [], 'checksum failure leaves no imported project')

  const preset = createPreset('Clean', project)
  const changed = applyPreset({ ...project, canvas: { padding: 99 } }, preset) as any
  assert.deepEqual(changed.clips, project.clips); assert.deepEqual(changed.editingDocument, project.editingDocument)
  assert.equal(changed.canvas.padding, 12); assert.equal(changed.legacyState.cursorSize, 2)
  console.log('projects/presets contract: PASS')
} finally { await fs.rm(root, { recursive: true, force: true }) }
