import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { cleanupTranscriptionMix, transcriptionHelperPath, transcriptionMixPath } from './transcriptionRuntime'

const require = createRequire(import.meta.url)

let active: ChildProcessWithoutNullStreams | null = null
let activeTemporaryMix: string | null = null
export function registerTranscriptionHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('transcription-start', async (_, input: { paths: string[]; language: string }) => {
    try {
    if (active) return { success: false, error: 'A transcription is already running' }
    const helper = transcriptionHelperPath(process.resourcesPath, app.getAppPath(), app.isPackaged)
    let audioPath = input.paths[0]
    let temporaryMix: string | null = null
    if (!audioPath) return { success: false, error: 'No audible local source selected' }
    if (input.paths.length > 1) {
      audioPath = transcriptionMixPath(app.getPath('temp')); temporaryMix = audioPath; activeTemporaryMix = audioPath
      const ffmpeg = require('@ffmpeg-installer/ffmpeg').path as string
      await new Promise<void>((resolve, reject) => {
        const args = input.paths.flatMap(item => ['-i', item]); args.push('-filter_complex', `amix=inputs=${input.paths.length}:duration=longest:normalize=0`, '-y', audioPath)
        const mixer = spawn(ffmpeg, args); active = mixer
        mixer.on('exit', code => { active = null; code === 0 ? resolve() : reject(new Error(`Audio mix exited ${code}`)) }); mixer.on('error', error => { active = null; reject(error) })
      })
    }
    return new Promise(resolve => {
      active = spawn(helper, [audioPath, input.language])
      let buffer = ''; let settled = false
      active.stdout.on('data', chunk => {
        buffer += chunk.toString(); const lines = buffer.split('\n'); buffer = lines.pop() || ''
        for (const line of lines) { try { const event = JSON.parse(line); getMainWindow()?.webContents.send('transcription-progress', event); if (event.type === 'result' || event.type === 'error') { settled = true; resolve(event.type === 'result' ? { success: true, segments: event.segments } : { success: false, error: event.message }) } } catch { /* compiler output */ } }
      })
      active.stderr.on('data', chunk => getMainWindow()?.webContents.send('transcription-progress', { type: 'log', message: chunk.toString() }))
      active.on('exit', code => { active = null; activeTemporaryMix = null; void cleanupTranscriptionMix(temporaryMix); if (!settled) resolve({ success: false, cancelled: code === null, error: `Transcriber exited ${code}` }) })
    })
    } catch (error) { active = null; const mix = activeTemporaryMix; activeTemporaryMix = null; await cleanupTranscriptionMix(mix); return { success: false, error: error instanceof Error ? error.message : String(error) } }
  })
  ipcMain.handle('transcription-cancel', () => { if (!active) return false; active.kill('SIGTERM'); active = null; const mix = activeTemporaryMix; activeTemporaryMix = null; void cleanupTranscriptionMix(mix); return true })
}
