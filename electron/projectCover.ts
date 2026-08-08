import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

import { hydrateCurrentProjectMedia } from './projectLibrary'

const ffmpegPath = ffmpegInstaller.path.replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)

export interface ProjectCoverCandidate {
  sourcePath: string
  sourceSignature: string
  outputPath: string
}

const activeCoverJobs = new Map<string, Promise<string | null>>()

export async function resolveProjectCoverCandidate(
  project: unknown,
  coverDirectory: string,
): Promise<ProjectCoverCandidate | null> {
  const media = hydrateCurrentProjectMedia(project)
  const sourcePath = media.videoPath || media.proxyPath
  if (!sourcePath) return null

  try {
    const stat = await fs.stat(sourcePath)
    if (!stat.isFile() || stat.size === 0) return null
    const sourceSignature = crypto
      .createHash('sha256')
      .update(`${sourcePath}\0${stat.size}\0${stat.mtimeMs}`)
      .digest('hex')
    return {
      sourcePath,
      sourceSignature,
      outputPath: path.join(coverDirectory, `${sourceSignature}.jpg`),
    }
  } catch {
    return null
  }
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
      .videoFilters(['thumbnail=60', 'scale=960:-2'])
      .outputOptions(['-frames:v 1', '-q:v 3', '-an', '-y'])
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
