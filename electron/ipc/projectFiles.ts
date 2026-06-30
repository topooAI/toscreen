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

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
