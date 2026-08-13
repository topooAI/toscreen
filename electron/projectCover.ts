import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import { hydrateCurrentProjectMedia } from './projectLibrary'

const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)
const COVER_RECIPE_VERSION = 'projected-clean-1400-v5-exact-matrix'
export const PROJECT_COVER_WIDTH_PX = 1400
const PROJECT_COVER_HEIGHT_PX = 788

export interface ProjectCoverCandidate {
  sourcePath: string
  sourceSignature: string
  outputPath: string
  sourceWidth?: number
  sourceHeight?: number
}

export interface ProjectCoverFraming {
  frameScale?: number
  focus?: { x: number; y: number }
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

export function generateProjectCover(candidate: ProjectCoverCandidate, framing?: ProjectCoverFraming): Promise<string | null> {
  const existing = activeCoverJobs.get(candidate.outputPath)
  if (existing) return existing

  const promise = generateProjectCoverFile(candidate, undefined, framing)
  activeCoverJobs.set(candidate.outputPath, promise)
  void promise.finally(() => {
    if (activeCoverJobs.get(candidate.outputPath) === promise) activeCoverJobs.delete(candidate.outputPath)
  })
  return promise
}

export function generateProjectCoverAtTime(
  candidate: ProjectCoverCandidate,
  timeMs: number,
  framing?: ProjectCoverFraming,
): Promise<string | null> {
  const normalizedTimeMs = Math.max(0, Math.round(timeMs))
  const normalizedFrameScale = Number(Math.max(.65, framing?.frameScale || 1).toFixed(2))
  const normalizedFocusX = Number(Math.min(95, Math.max(5, framing?.focus?.x || 50)).toFixed(2))
  const normalizedFocusY = Number(Math.min(95, Math.max(5, framing?.focus?.y || 46)).toFixed(2))
  const outputPath = path.join(
    path.dirname(candidate.outputPath),
    `${candidate.sourceSignature}-manual-${normalizedTimeMs}-${normalizedFrameScale}-${normalizedFocusX}-${normalizedFocusY}.jpg`,
  )
  const customCandidate = { ...candidate, outputPath }
  const existing = activeCoverJobs.get(outputPath)
  if (existing) return existing

  const promise = generateProjectCoverFile(customCandidate, normalizedTimeMs, framing)
  activeCoverJobs.set(outputPath, promise)
  void promise.finally(() => {
    if (activeCoverJobs.get(outputPath) === promise) activeCoverJobs.delete(outputPath)
  })
  return promise
}

async function generateProjectCoverFile(
  candidate: ProjectCoverCandidate,
  timeMs?: number,
  framing?: ProjectCoverFraming,
): Promise<string | null> {
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

    const command = ffmpeg(candidate.sourcePath)
    if (timeMs !== undefined) command.seekInput(timeMs / 1000)
    command
      .complexFilter(buildProjectCoverFilters(candidate, timeMs, framing), 'final')
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

function buildProjectCoverFilters(
  candidate: ProjectCoverCandidate,
  timeMs?: number,
  framing?: ProjectCoverFraming,
): string[] {
  const selectFrame = timeMs === undefined ? 'thumbnail=60,' : ''
  const sourceWidth = Number.isFinite(candidate.sourceWidth) && Number(candidate.sourceWidth) > 0
    ? Number(candidate.sourceWidth)
    : 3200
  const baseDetailScale = Math.min(6.2, Math.max(1.5, sourceWidth / (760 * 1.48 * 1.18)))
  const detailScale = baseDetailScale / Math.max(.65, framing?.frameScale || 1)
  const focusX = Math.min(95, Math.max(5, framing?.focus?.x || 50)) / 100
  const focusY = Math.min(95, Math.max(5, framing?.focus?.y || 46)) / 100
  // Reproduce the accepted DOM camera chain as a clean projected cover:
  // coverScene inset -44% -34%, coverPlane inset -8%, saved image placement,
  // then matrix(.978148, -.207912, .573576, .819152) scale(1.18).
  const sceneWidth = Math.round(PROJECT_COVER_WIDTH_PX * 1.68)
  const sceneHeight = Math.round(PROJECT_COVER_HEIGHT_PX * 1.88)
  const planeWidth = Math.round(sceneWidth * 1.16)
  const planeHeight = Math.round(sceneHeight * 1.16)
  const imageWidth = Math.max(2, Math.round(planeWidth * detailScale))
  const imageHeight = Math.max(2, Math.round(planeHeight * detailScale))
  const imageLeft = Math.round((.5 - focusX * detailScale) * planeWidth)
  const imageTop = Math.round((.5 - focusY * detailScale) * planeHeight)
  const planeCenterX = planeWidth / 2
  const planeCenterY = planeHeight / 2
  const sourceX = `0.754147*(X-${planeCenterX})-0.528059*(Y-${planeCenterY})+${planeCenterX}`
  const sourceY = `0.191413*(X-${planeCenterX})+0.900526*(Y-${planeCenterY})+${planeCenterY}`
  const sourcePoint = `${sourceX}\\,${sourceY}`
  return [
    `[0:v]${selectFrame}scale=${imageWidth}:${imageHeight}:force_original_aspect_ratio=increase,crop=${imageWidth}:${imageHeight}[framed]`,
    `color=c=#eeeeec:s=${planeWidth}x${planeHeight}[planeBg]`,
    `[planeBg][framed]overlay=${imageLeft}:${imageTop}[plane]`,
    `[plane]format=gbrp,geq=r='r(${sourcePoint})':g='g(${sourcePoint})':b='b(${sourcePoint})',crop=${PROJECT_COVER_WIDTH_PX}:${PROJECT_COVER_HEIGHT_PX}[final]`,
  ]
}
