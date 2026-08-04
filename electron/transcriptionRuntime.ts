import fs from 'node:fs/promises'
import path from 'node:path'

export const MIX_PREFIX = 'toscreen-transcription-mix-'
export const TRANSCRIPTION_IPC_PREFIX = 'toscreen-transcription-ipc-'
export function transcriptionHelperAppPath(resourcesRoot: string, appRoot: string, packaged: boolean) {
  const root = packaged ? resourcesRoot : path.join(appRoot, 'public')
  return path.join(root, 'transcriber', 'ToScreenTranscriber.app')
}
export function transcriptionHelperPath(resourcesRoot: string, appRoot: string, packaged: boolean) {
  return path.join(transcriptionHelperAppPath(resourcesRoot, appRoot, packaged), 'Contents', 'MacOS', 'ToScreenTranscriber')
}
export function transcriptionMixPath(tempRoot: string, nonce = Date.now()) { return path.join(tempRoot, `${MIX_PREFIX}${nonce}.wav`) }
export function transcriptionIpcPaths(tempRoot: string, nonce = `${Date.now()}-${process.pid}`) {
  const base = path.join(tempRoot, `${TRANSCRIPTION_IPC_PREFIX}${nonce}`)
  return { resultPath: `${base}.jsonl`, cancellationPath: `${base}.cancel` }
}
export async function cleanupTranscriptionMix(filePath?: string | null) {
  if (!filePath || !path.basename(filePath).startsWith(MIX_PREFIX)) return false
  try { await fs.unlink(filePath); return true } catch (error: any) { if (error?.code === 'ENOENT') return false; throw error }
}
export async function cleanupTranscriptionIpc(...filePaths: Array<string | null | undefined>) {
  await Promise.all(filePaths.map(async filePath => {
    if (!filePath || !path.basename(filePath).startsWith(TRANSCRIPTION_IPC_PREFIX)) return
    try { await fs.unlink(filePath) } catch (error: any) { if (error?.code !== 'ENOENT') throw error }
  }))
}
