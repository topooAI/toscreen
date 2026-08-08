import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_EXTENSION = '.toscreen'
export const PACKAGE_EXTENSION = '.toscreenpkg'
export const PRESET_EXTENSION = '.toscreenpreset'
export const LIBRARY_VERSION = 1

export type ProjectDocumentAction =
  | { type: 'new' }
  | { type: 'open' | 'save-as'; projectPath: string }

export function transitionProjectDocument(currentProjectPath: string | null, action: ProjectDocumentAction): string | null {
  if (action.type === 'new') return currentProjectPath === null ? currentProjectPath : null
  return action.projectPath
}

export interface RecentProjectEntry {
  id: string
  name: string
  projectPath: string
  thumbnailPath?: string
  thumbnailSourceSignature?: string
  thumbnailSourceWidth?: number
  thumbnailSourceHeight?: number
  thumbnailFocus?: { x: number; y: number }
  updatedAt: string
  durationMs: number
  assetStatus: 'ready' | 'missing' | 'missing-project' | 'corrupt' | 'recovered'
  missingAssets: string[]
}

export function resolveProjectCoverInteractionFocus(project: any): { x: number; y: number } | undefined {
  const event = Array.isArray(project?.cursorData)
    ? project.cursorData.find((candidate: any) => {
        const width = Number(candidate?.videoInfo?.width)
        const height = Number(candidate?.videoInfo?.height)
        const x = Number.isFinite(Number(candidate?.cx)) ? Number(candidate.cx) : Number(candidate?.x) / width
        const y = Number.isFinite(Number(candidate?.cy)) ? Number(candidate.cy) : Number(candidate?.y) / height
        return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
      })
    : undefined
  if (!event) return undefined
  const width = Number(event?.videoInfo?.width)
  const height = Number(event?.videoInfo?.height)
  const normalizedX = Number.isFinite(Number(event?.cx)) ? Number(event.cx) : Number(event.x) / width
  const normalizedY = Number.isFinite(Number(event?.cy)) ? Number(event.cy) : Number(event.y) / height
  const horizontalBlend = .65
  const verticalBlend = .9
  return {
    x: Number(Math.min(62, Math.max(38, 50 + (normalizedX * 100 - 50) * horizontalBlend)).toFixed(2)),
    y: Number(Math.min(70, Math.max(38, 46 + (normalizedY * 100 - 46) * verticalBlend)).toFixed(2)),
  }
}

export interface PortableAsset {
  originalPath: string
  relativePath: string
  checksum: string
  data: string
}

export interface PortableProjectPackage {
  format: 'toscreen-project-package'
  version: number
  createdAt: string
  projectFile: { relativePath: string; checksum: string; data: string }
  assets: PortableAsset[]
}

export interface ToScreenPreset {
  format: 'toscreen-preset'
  version: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  style: Record<string, unknown>
}

export interface HydratedProjectMedia {
  videoPath: string | null
  proxyPath: string | null
  audioPath: string | null
  cameraPath: string | null
  microphonePath: string | null
}

export function hydrateCurrentProjectMedia(project: any): HydratedProjectMedia {
  const model = project?.projectModel || project
  const assets = Array.isArray(model?.assets) ? model.assets : []
  const assetPath = (asset: any): string | null => {
    const value = asset?.filePath || asset?.sourceUrl
    if (typeof value !== 'string' || !value) return null
    if (!value.startsWith('file://')) return value
    try { return fileURLToPath(value) } catch { return null }
  }
  const byRole = (role: string) => assets.find((asset: any) => asset?.metadata?.role === role)
  const screen = assets.find((asset: any) => asset?.type === 'screen-recording')
  const proxy = byRole('preview-proxy')
  const systemAudio = byRole('system-audio') || byRole('companion-audio')
  const microphone = byRole('microphone')
  const camera = byRole('presenter-camera')
  return {
    videoPath: assetPath(screen),
    proxyPath: assetPath(proxy),
    audioPath: assetPath(systemAudio),
    cameraPath: assetPath(camera),
    microphonePath: assetPath(microphone),
  }
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await fs.copyFile(filePath, `${filePath}.bak`).catch(error => { if (getCode(error) !== 'ENOENT') throw error })
  await fs.rename(tempPath, filePath)
}

export async function readJsonWithBackup(filePath: string): Promise<{ value: any; recovered: boolean }> {
  try { return { value: JSON.parse(await fs.readFile(filePath, 'utf8')), recovered: false } }
  catch (primaryError) {
    if (getCode(primaryError) === 'ENOENT') throw primaryError
    const value = JSON.parse(await fs.readFile(`${filePath}.bak`, 'utf8'))
    await replaceJsonWithoutBackup(filePath, value)
    return { value, recovered: true }
  }
}

async function replaceJsonWithoutBackup(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.recovery.tmp`
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
  await fs.rename(tempPath, filePath)
}

export function checksum(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

export async function readRecentIndex(indexPath: string): Promise<RecentProjectEntry[]> {
  try {
    const parsed = (await readJsonWithBackup(indexPath)).value
    return Array.isArray(parsed?.projects) ? parsed.projects : []
  } catch (error) {
    if (getCode(error) === 'ENOENT') return []
    const corruptPath = `${indexPath}.corrupt-${Date.now()}`
    await fs.rename(indexPath, corruptPath).catch(() => undefined)
    return []
  }
}

export async function writeRecentIndex(indexPath: string, projects: RecentProjectEntry[]): Promise<void> {
  await atomicWriteJson(indexPath, { version: LIBRARY_VERSION, projects })
}

export function collectProjectAssetPaths(project: unknown): string[] {
  const results = new Set<string>()
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (/path$/i.test(key) || /sourceUrl$/i.test(key) || /wallpaper$/i.test(key)) {
        if (/^(toscreen|https?|blob|data):/i.test(value)) return
        if (/^\/(wallpapers|assets|icons)\//i.test(value)) return
        let normalized = value
        if (value.startsWith('file://')) {
          try { normalized = fileURLToPath(value) } catch { return }
        }
        if (path.isAbsolute(normalized)) results.add(normalized)
      }
      return
    }
    if (Array.isArray(value)) value.forEach(item => visit(item, key))
    else if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) => visit(child, childKey))
    }
  }
  visit(project)
  return [...results]
}

export async function inspectProjectAssets(project: unknown): Promise<{ missing: string[]; ready: string[] }> {
  const paths = collectProjectAssetPaths(project)
  const states = await Promise.all(paths.map(async assetPath => ({
    assetPath,
    exists: await fs.access(assetPath).then(() => true).catch(() => false),
  })))
  return {
    missing: states.filter(item => !item.exists).map(item => item.assetPath),
    ready: states.filter(item => item.exists).map(item => item.assetPath),
  }
}

export async function createPortablePackage(projectPath: string, outputPath: string): Promise<PortableProjectPackage> {
  const projectBytes = await fs.readFile(projectPath)
  const project = JSON.parse(projectBytes.toString('utf8'))
  const assetPaths = collectProjectAssetPaths(project)
  const assets: PortableAsset[] = []
  for (const [index, assetPath] of assetPaths.entries()) {
    const bytes = await fs.readFile(assetPath)
    const relativePath = path.join('assets', `${String(index + 1).padStart(3, '0')}-${path.basename(assetPath)}`)
    assets.push({ originalPath: assetPath, relativePath, checksum: checksum(bytes), data: bytes.toString('base64') })
  }
  const pkg: PortableProjectPackage = {
    format: 'toscreen-project-package',
    version: LIBRARY_VERSION,
    createdAt: new Date().toISOString(),
    projectFile: { relativePath: `project${PROJECT_EXTENSION}`, checksum: checksum(projectBytes), data: projectBytes.toString('base64') },
    assets,
  }
  await atomicWriteJson(outputPath, pkg)
  return pkg
}

export async function importPortablePackage(packagePath: string, destinationDir: string): Promise<{ projectPath: string; project: unknown; missing: string[]; corrupt: string[] }> {
  const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8')) as PortableProjectPackage
  if (pkg.format !== 'toscreen-project-package' || pkg.version !== LIBRARY_VERSION) throw new Error('Unsupported ToScreen project package version.')
  assertSafeRelativePath(pkg.projectFile.relativePath)
  pkg.assets.forEach(asset => assertSafeRelativePath(asset.relativePath))
  const projectBytes = Buffer.from(pkg.projectFile.data, 'base64')
  const corrupt: string[] = []
  if (checksum(projectBytes) !== pkg.projectFile.checksum) corrupt.push(pkg.projectFile.relativePath)
  const decodedAssets = pkg.assets.map(asset => ({ asset, bytes: Buffer.from(asset.data, 'base64') }))
  decodedAssets.forEach(({ asset, bytes }) => { if (checksum(bytes) !== asset.checksum) corrupt.push(asset.relativePath) })
  if (corrupt.length) throw new Error(`Package checksum failed: ${corrupt.join(', ')}`)
  await fs.mkdir(destinationDir, { recursive: true })
  const stage = await fs.mkdtemp(path.join(destinationDir, '.toscreen-import-'))
  const finalDir = path.join(destinationDir, `ToScreen Project ${Date.now()}`)
  try {
    const replacements = new Map<string, string>()
    for (const { asset, bytes } of decodedAssets) {
      const finalAssetPath = path.join(finalDir, asset.relativePath)
      const stageAssetPath = path.join(stage, asset.relativePath)
      await fs.mkdir(path.dirname(stageAssetPath), { recursive: true })
      await fs.writeFile(stageAssetPath, bytes)
      replacements.set(asset.originalPath, finalAssetPath)
    }
    let projectText = projectBytes.toString('utf8')
    for (const [original, replacement] of replacements) projectText = projectText.split(original).join(replacement)
    const project = JSON.parse(projectText)
    await atomicWriteJson(path.join(stage, pkg.projectFile.relativePath), project)
    await fs.rename(stage, finalDir)
    const projectPath = path.join(finalDir, pkg.projectFile.relativePath)
    const status = await inspectProjectAssets(project)
    return { projectPath, project, missing: status.missing, corrupt }
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true })
    throw error
  }
}

export function createPreset(name: string, project: Record<string, unknown>, existing?: ToScreenPreset): ToScreenPreset {
  const now = new Date().toISOString()
  const legacy = isRecord(project.legacyState) ? project.legacyState : {}
  const clips = Array.isArray(project.clips) ? project.clips : []
  const cursorClip = clips.find((clip: any) => clip?.type === 'cursor') as any
  return {
    format: 'toscreen-preset', version: LIBRARY_VERSION,
    id: existing?.id || crypto.randomUUID(), name: name.trim(),
    createdAt: existing?.createdAt || now, updatedAt: now,
    style: {
      canvas: clone(project.canvas),
      exportSettings: clone(project.exportSettings),
      focusDefaults: clone(legacy.focusDefaults),
      cursor: cursorClip?.props ? clone(cursorClip.props) : pick(legacy, ['cursorSize', 'cursorSmoothing', 'showVectorCursor', 'cursorStyle', 'cursorCustomImages', 'cursorOffset']),
      click: clone(legacy.clickStyle),
      presentation: clone(legacy.presentationStyle),
      captions: clone(legacy.captionStyle),
      layout: clone(legacy.layout),
    },
  }
}

export function applyPreset(project: Record<string, unknown>, preset: ToScreenPreset): Record<string, unknown> {
  validatePreset(preset)
  const style = preset.style
  const legacy = isRecord(project.legacyState) ? project.legacyState : {}
  const cursor = isRecord(style.cursor) ? style.cursor : {}
  const clips = Array.isArray(project.clips) ? project.clips.map((clip: any) => (
    clip?.type === 'cursor' ? { ...clip, props: { ...clip.props, ...clone(cursor) } } : clip
  )) : project.clips
  return {
    ...project,
    clips,
    canvas: clone(style.canvas) ?? project.canvas,
    exportSettings: clone(style.exportSettings) ?? project.exportSettings,
    legacyState: {
      ...legacy,
      ...cursor,
      focusDefaults: clone(style.focusDefaults), clickStyle: clone(style.click),
      presentationStyle: clone(style.presentation), captionStyle: clone(style.captions), layout: clone(style.layout),
    },
  }
}

export function validatePreset(value: unknown): asserts value is ToScreenPreset {
  if (!isRecord(value) || value.format !== 'toscreen-preset' || value.version !== LIBRARY_VERSION || typeof value.name !== 'string' || !isRecord(value.style)) {
    throw new Error('Invalid or unsupported ToScreen preset.')
  }
}

function pick(value: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter(key => key in value).map(key => [key, clone(value[key])]))
}
function clone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function getCode(error: unknown): string | undefined { return isRecord(error) && typeof error.code === 'string' ? error.code : undefined }
function assertSafeRelativePath(relativePath: string): void {
  if (!relativePath || path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes('..')) throw new Error(`Unsafe package path: ${relativePath}`)
  const normalized = path.normalize(relativePath)
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) throw new Error(`Unsafe package path: ${relativePath}`)
}
