import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import { hydrateCurrentProjectMedia } from './projectLibrary'

const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)
const COVER_RECIPE_VERSION = 'detail-native-3840-v2'
export const PROJECT_COVER_WIDTH_PX = 3840

export interface ProjectCoverCandidate {
  sourcePath: string
  sourceSignature: string
  outputPath: string
  sourceWidth?: number
  sourceHeight?: number
}

const activeCoverJobs = new Map<string, Promise<string | null>>()

export async function resolveProjectCoverCandidate(
  project: unknown,
  coverDirectory: string,
): Promise<ProjectCoverCandidate | null> {
  const media = hydrateCurrentProjectMedia(project)
  const sourcePath = media.videoPath || media.proxyPath
  if (!sourcePath) return null
  const sourceSize = resolveProjectCoverSourceSize(project)

  try {
    const stat = await fs.stat(sourcePath)
    if (!stat.isFile() || stat.size === 0) return null
    const sourceSignature = crypto
      .createHash('sha256')
      .update(`${COVER_RECIPE_VERSION}\0${sourcePath}\0${stat.size}\0${stat.mtimeMs}`)
      .digest('hex')
    return {
      sourcePath,
      sourceSignature,
      outputPath: path.join(coverDirectory, `${sourceSignature}.jpg`),
      sourceWidth: sourceSize?.width,
      sourceHeight: sourceSize?.height,
    }
  } catch {
    return null
  }
}

export function resolveProjectCoverSourceSize(project: unknown): { width: number; height: number } | null {
  const root = project as any
  const model = root?.projectModel || root
  const cursorCollections = [root?.cursorData, model?.cursorData, model?.legacyState?.cursorData]
  for (const collection of cursorCollections) {
    if (!Array.isArray(collection)) continue
    for (const point of collection) {
      for (const info of [point?.videoInfo, point?.displayInfo]) {
        const width = Number(info?.width)
        const height = Number(info?.height)
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) return { width, height }
      }
    }
  }

  const screenAsset = Array.isArray(model?.assets)
    ? model.assets.find((asset: any) => asset?.type === 'screen-recording')
    : null
  const metadata = screenAsset?.metadata || {}
  for (const [widthKey, heightKey] of [
    ['sourceWidth', 'sourceHeight'],
    ['videoWidth', 'videoHeight'],
    ['displayWidth', 'displayHeight'],
    ['width', 'height'],
  ] as const) {
    const width = Number(metadata[widthKey])
    const height = Number(metadata[heightKey])
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) return { width, height }
  }
  return null
}

export async function projectCoverExists(candidate: ProjectCoverCandidate): Promise<boolean> {
  return fs.access(candidate.outputPath).then(() => true).catch(() => false)
}

export function generateProjectCover(candidate: ProjectCoverCandidate): Promise<string | null> {
  const existing = activeCoverJobs.get(candidate.outputPath)
  if (existing) return existing

  const promise = generateProjectCoverFile(candidate)
  activeCoverJobs.set(candidate.outputPath, promise)
  void promise.finally(() => {
    if (activeCoverJobs.get(candidate.outputPath) === promise) activeCoverJobs.delete(candidate.outputPath)
  })
  return promise
}

async function generateProjectCoverFile(candidate: ProjectCoverCandidate): Promise<string | null> {
  if (await projectCoverExists(candidate)) return candidate.outputPath
  await fs.mkdir(path.dirname(candidate.outputPath), { recursive: true })
  const temporaryPath = path.join(
    path.dirname(candidate.outputPath),
    `${path.basename(candidate.outputPath, '.jpg')}.${process.pid}.${crypto.randomUUID()}.building.jpg`,
  )

  return new Promise(resolve => {
    let settled = false
    const finish = async (result: string | null) => {
      if (settled) return
      settled = true
      if (!result) await fs.unlink(temporaryPath).catch(() => undefined)
      resolve(result)
    }

    ffmpeg(candidate.sourcePath)
      // Pick a representative frame from the opening seconds instead of a
      // frequently black first frame, then cache a lightweight dashboard image.
      .videoFilters(['thumbnail=60', `scale='min(${PROJECT_COVER_WIDTH_PX},iw)':-2`])
      .outputOptions(['-frames:v 1', '-q:v 2', '-an', '-y'])
      .on('end', async () => {
        try {
          await fs.rename(temporaryPath, candidate.outputPath)
          await finish(candidate.outputPath)
        } catch {
          await finish(null)
        }
      })
      .on('error', () => { void finish(null) })
      .save(temporaryPath)
  })
}
