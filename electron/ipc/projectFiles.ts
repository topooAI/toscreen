import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function normalizeMediaPath(mediaPath: string): string {
  const trimmedPath = mediaPath.trim()
  if (!trimmedPath) return trimmedPath

  if (trimmedPath.startsWith('file://')) {
    try {
      return fileURLToPath(trimmedPath)
    } catch {
      return decodePath(trimmedPath.replace(/^file:\/\/\//, '/').replace(/^file:\/\//, ''))
    }
  }

  return decodePath(trimmedPath)
}

export function projectPathForMediaPath(mediaPath: string): string {
  const normalizedPath = normalizeMediaPath(mediaPath)
  const parsed = path.parse(normalizedPath)
  const projectBaseName = parsed.name.endsWith('-proxy')
    ? parsed.name.slice(0, -'-proxy'.length)
    : parsed.name

  return path.join(parsed.dir, `${projectBaseName}.project.json`)
}

export function projectPathCandidatesForMediaPath(mediaPath: string): string[] {
  const normalizedPath = normalizeMediaPath(mediaPath)
  const parsed = path.parse(normalizedPath)
  const canonicalProjectPath = projectPathForMediaPath(normalizedPath)
  const exactProjectPath = path.join(parsed.dir, `${parsed.name}.project.json`)

  return Array.from(new Set([canonicalProjectPath, exactProjectPath]))
}

export function companionAudioPathCandidatesForMediaPath(mediaPath: string): string[] {
  const normalizedPath = normalizeMediaPath(mediaPath)
  const parsed = path.parse(normalizedPath)
  const baseName = parsed.name.endsWith('-proxy')
    ? parsed.name.slice(0, -'-proxy'.length)
    : parsed.name
  const timestamp = baseName.match(/^recording-(.+)$/)?.[1]
  const audioExtensions = ['.mov', '.m4a', '.wav', '.aac']
  const candidateBases = [
    `${baseName}-audio`,
    `${baseName}.audio`,
    timestamp ? `temp_audio_${timestamp}` : undefined,
    timestamp ? `temp_audio-${timestamp}` : undefined,
  ].filter((value): value is string => Boolean(value))

  return Array.from(new Set(
    candidateBases.flatMap((candidateBase) => (
      audioExtensions.map((extension) => path.join(parsed.dir, `${candidateBase}${extension}`))
    )),
  ))
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
