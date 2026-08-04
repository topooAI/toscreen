import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  applyPreset, atomicWriteJson, collectProjectAssetPaths, createPortablePackage, createPreset, hydrateCurrentProjectMedia, importPortablePackage, readJsonWithBackup,
  transitionProjectDocument,
} from '../electron/projectLibrary'
import { createProjectFromLegacyEditorState, restoreLegacyEditorStateFromProjectModel } from '../src/components/video-editor/project/legacyAdapter'
import { resolveSourceDurationSeconds, restoredSourceDurationSeconds, timelineMediaIsAvailable } from '../src/components/video-editor/timeline/timelineMediaAvailability'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toscreen-projects-'))
try {
  const restoredPreviewProject = { clips: [{ id: 'screen', type: 'screen-recording', sourceStartMs: 500, sourceEndMs: 12_500 }] }
  const restoredDuration = restoredSourceDurationSeconds(restoredPreviewProject)
  assert.equal(restoredDuration, 12)
  assert.equal(timelineMediaIsAvailable('file:///project/media.mov', restoredDuration), true, 'A restored Preview source must make its Timeline available before media metadata fires')
  assert.equal(timelineMediaIsAvailable(undefined, restoredDuration), false, 'Persisted duration without hydrated media must not hide the missing-video state')
  assert.equal(timelineMediaIsAvailable('file:///project/media.mov', 0), false, 'A path without a valid duration is not a usable Timeline source')
  assert.equal(resolveSourceDurationSeconds(restoredDuration, 0), restoredDuration, 'transient zero metadata must not erase a restored source duration')
  assert.equal(resolveSourceDurationSeconds(restoredDuration, Number.NaN), restoredDuration, 'NaN metadata must not erase a restored source duration')
  assert.equal(resolveSourceDurationSeconds(restoredDuration, Number.POSITIVE_INFINITY), restoredDuration, 'stream-style infinite metadata must not erase a restored source duration')
  assert.equal(resolveSourceDurationSeconds(restoredDuration, 14.25), 14.25, 'valid media metadata remains authoritative')
  const handlersSource = await fs.readFile(path.join(process.cwd(), 'electron/ipc/handlers.ts'), 'utf8')
  assert.match(handlersSource, /project-open[\s\S]*?const media = hydrateMedia\(project\)/, 'Recent open hydrates all current media')
  assert.match(handlersSource, /project-import-package[\s\S]*?const media = hydrateMedia\(imported\.project\)/, 'package import hydrates package-local media before Editor')
  assert.match(handlersSource, /currentProjectPath \? \[currentProjectPath\]/, 'Editor load prioritizes explicitly opened/imported project')
  assert.match(handlersSource, /project-new[\s\S]*?clearCurrentProjectMedia\(\)/, 'New Project clears stale global media')
  const media = path.join(root, 'recording.webm'); await fs.writeFile(media, 'video-data')
  const proxy = path.join(root, 'recording-proxy.mp4'); await fs.writeFile(proxy, 'proxy-data')
  const systemAudio = path.join(root, 'system.webm'); await fs.writeFile(systemAudio, 'system-data')
  const microphone = path.join(root, 'microphone.webm'); await fs.writeFile(microphone, 'microphone-data')
  const camera = path.join(root, 'camera.mov'); await fs.writeFile(camera, 'camera-data')
  const runtimeMediaPath = process.env.TOSCREEN_RUNTIME_MEDIA_PATH
  if (runtimeMediaPath) {
    await fs.copyFile(runtimeMediaPath, media)
    await fs.copyFile(runtimeMediaPath, proxy)
    await fs.copyFile(runtimeMediaPath, systemAudio)
    await fs.copyFile(runtimeMediaPath, microphone)
    await fs.copyFile(runtimeMediaPath, camera)
  }
  const projectPath = path.join(root, 'Demo.toscreen')
  const model = createProjectFromLegacyEditorState({
    projectId: 'p1', projectName: 'Demo', videoPath: proxy, originalVideoPath: media, companionAudioPath: systemAudio, cameraPath: camera,
    durationSeconds: 7, projectDurationSeconds: 7, zoomRegions: [], trimRegions: [], annotationRegions: [], cursorData: [], cursorSize: 2, cursorSmoothing: true,
    showVectorCursor: true, cursorOffset: 0, cropRegion: { x: 0, y: 0, width: 1, height: 1 }, wallpaper: '/wallpapers/wallpaper1.jpg', shadowIntensity: 0,
    showBlur: false, motionBlurEnabled: false, borderRadius: 0, padding: 12, aspectRatio: '16:9', exportQuality: 'good',
    audioRegions: [
      { id: 'system', startMs: 0, endMs: 7000, sourceUrl: `file://${systemAudio}`, path: systemAudio, volume: 1, role: 'system-audio' },
      { id: 'mic', startMs: 0, endMs: 7000, sourceUrl: `file://${microphone}`, path: microphone, volume: 0.8, role: 'microphone' },
    ],
  })
  const realRecentSidecarShape = structuredClone(model)
  realRecentSidecarShape.editingDocument = { clips: [], speedSections: [] }
  const lateRestored = restoreLegacyEditorStateFromProjectModel(realRecentSidecarShape)
  assert.deepEqual(lateRestored.editingDocument.clips, [{ id: 'main-clip-1', sourceStartMs: 0, sourceEndMs: 7000 }], 'late restore of an unversioned empty legacy editing document must rebuild the Main Track from the valid screen source clip')
  realRecentSidecarShape.editingDocument = { schemaVersion: 1, clips: [], speedSections: [] }
  assert.deepEqual(restoreLegacyEditorStateFromProjectModel(realRecentSidecarShape).editingDocument.clips, [], 'a versioned empty editing document is an authoritative user deletion')
  const project = { projectModel: model, wallpaper: '/wallpapers/wallpaper1.jpg', music: 'toscreen://music/builtin.mp3' }
  await atomicWriteJson(projectPath, project)
  assert.deepEqual(new Set(collectProjectAssetPaths(project)), new Set([media, proxy, systemAudio, microphone, camera]), 'all user media and no built-ins are portable')
  assert.deepEqual(hydrateCurrentProjectMedia(project), { videoPath: media, proxyPath: proxy, audioPath: systemAudio, cameraPath: camera, microphonePath: microphone })
  await atomicWriteJson(projectPath, { ...project, projectModel: { ...model, name: 'Demo v2' } })
  await fs.writeFile(projectPath, '{broken')
  assert.equal((await readJsonWithBackup(projectPath)).value.projectModel.name, 'Demo', 'first corruption restores valid backup')
  await fs.writeFile(projectPath, '{broken-again')
  assert.equal((await readJsonWithBackup(projectPath)).value.projectModel.name, 'Demo', 'recovery does not overwrite backup with corrupt primary')
  assert.equal(transitionProjectDocument('/old.toscreen', { type: 'new' }), null, 'New Project resets previous save target')
  assert.equal(transitionProjectDocument(null, { type: 'save-as', projectPath }), projectPath)
  assert.equal(transitionProjectDocument(projectPath, { type: 'open', projectPath: '/next.toscreen' }), '/next.toscreen')

  const packagePath = path.join(root, 'Demo.toscreenpkg'); await createPortablePackage(projectPath, packagePath)
  const destination = path.join(root, 'imported'); const imported = await importPortablePackage(packagePath, destination)
  if (!runtimeMediaPath) assert.equal((await fs.readFile((imported.project as any).projectModel.assets[0].filePath, 'utf8')), 'video-data')
  assert.ok((imported.project as any).projectModel.assets[0].filePath.startsWith(destination), 'import rewrites absolute media path')
  const importedMedia = hydrateCurrentProjectMedia(imported.project)
  for (const restoredPath of Object.values(importedMedia)) assert.ok(restoredPath?.startsWith(destination), 'import hydrates package-local media')

  const unsafe = JSON.parse(await fs.readFile(packagePath, 'utf8')); unsafe.assets[0].relativePath = '../escape.webm'
  const unsafePath = path.join(root, 'unsafe.toscreenpkg'); await atomicWriteJson(unsafePath, unsafe)
  await assert.rejects(importPortablePackage(unsafePath, path.join(root, 'unsafe-import')), /Unsafe package path/)
  const corrupt = JSON.parse(await fs.readFile(packagePath, 'utf8')); corrupt.assets[0].data = Buffer.from('tampered').toString('base64')
  const corruptPath = path.join(root, 'corrupt.toscreenpkg'); await atomicWriteJson(corruptPath, corrupt)
  const corruptDest = path.join(root, 'corrupt-import'); await assert.rejects(importPortablePackage(corruptPath, corruptDest), /checksum failed/)
  assert.deepEqual(await fs.readdir(corruptDest).catch(() => []), [], 'checksum failure leaves no imported project')

  for (const unsafeRelativePath of ['/absolute.webm', 'C:\\media\\recording.webm', '\\\\server\\share\\recording.webm', 'assets\\..\\escape.webm']) {
    const unsafeVariant = JSON.parse(await fs.readFile(packagePath, 'utf8')); unsafeVariant.assets[0].relativePath = unsafeRelativePath
    const variantPath = path.join(root, `unsafe-${Buffer.from(unsafeRelativePath).toString('hex')}.toscreenpkg`); await atomicWriteJson(variantPath, unsafeVariant)
    await assert.rejects(importPortablePackage(variantPath, path.join(root, 'unsafe-variants')), /Unsafe package path/)
  }

  const preset = createPreset('Clean', model)
  const changed = applyPreset({ ...model, canvas: { ...model.canvas, padding: 99 } }, preset) as any
  assert.deepEqual(changed.clips, model.clips); assert.deepEqual(changed.editingDocument, model.editingDocument)
  assert.equal(changed.canvas.padding, 12); assert.equal(changed.clips.find((clip: any) => clip.type === 'cursor').props.size, 2)
  console.log('projects/presets contract: PASS')
  if (process.env.TOSCREEN_KEEP_FIXTURE === '1') console.log(`runtime fixture: ${packagePath}`)
} finally { if (process.env.TOSCREEN_KEEP_FIXTURE !== '1') await fs.rm(root, { recursive: true, force: true }) }
