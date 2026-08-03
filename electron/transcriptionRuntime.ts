import fs from 'node:fs/promises'
import path from 'node:path'

export const MIX_PREFIX = 'toscreen-transcription-mix-'
export function transcriptionHelperPath(resourcesRoot: string, appRoot: string, packaged: boolean) {
  const root = packaged ? resourcesRoot : path.join(appRoot, 'public')
  return path.join(root, 'transcriber', 'ToScreenTranscriber.app', 'Contents', 'MacOS', 'ToScreenTranscriber')
}
export function transcriptionMixPath(tempRoot: string, nonce = Date.now()) { return path.join(tempRoot, `${MIX_PREFIX}${nonce}.wav`) }
export async function cleanupTranscriptionMix(filePath?: string | null) {
  if (!filePath || !path.basename(filePath).startsWith(MIX_PREFIX)) return false
  try { await fs.unlink(filePath); return true } catch (error: any) { if (error?.code === 'ENOENT') return false; throw error }
}
