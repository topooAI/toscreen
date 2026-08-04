import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  cleanupTranscriptionIpc,
  cleanupTranscriptionMix,
  transcriptionHelperAppPath,
  transcriptionIpcPaths,
  transcriptionMixPath,
} from './transcriptionRuntime'

const require = createRequire(import.meta.url)

let active: ChildProcessWithoutNullStreams | null = null
let activeTemporaryMix: string | null = null
let activeCancellationPath: string | null = null

type TranscriptionEvent = {
  type: 'progress' | 'result' | 'error' | 'cancelled'
  value?: number
  message?: string
  segments?: Array<{ startMs: number; endMs: number; text: string }>
}

export function registerTranscriptionHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('transcription-open-dictation-settings', async () => {
    if (process.platform !== 'darwin') return false
    // This deep link opens Keyboard settings on current macOS releases. Older
    // releases safely fall back to the nearest Keyboard preference pane.
    try {
      await shell.openExternal('x-apple.systempreferences:com.apple.Keyboard-Settings.extension?Dictation')
    } catch {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.keyboard?Dictation')
    }
    return true
  })

  ipcMain.handle('transcription-start', async (_, input: { paths: string[]; language: string }) => {
    try {
      if (active) return { success: false, error: 'A transcription is already running' }
      if (process.platform !== 'darwin') return { success: false, error: 'Local transcription is currently available on macOS' }

      const helperApp = transcriptionHelperAppPath(process.resourcesPath, app.getAppPath(), app.isPackaged)
      let audioPath = input.paths[0]
      let temporaryMix: string | null = null
      if (!audioPath) return { success: false, error: 'No audible local source selected' }

      if (input.paths.length > 1) {
        audioPath = transcriptionMixPath(app.getPath('temp'))
        temporaryMix = audioPath
        activeTemporaryMix = audioPath
        const ffmpeg = require('@ffmpeg-installer/ffmpeg').path as string
        await new Promise<void>((resolve, reject) => {
          const args = input.paths.flatMap(item => ['-i', item])
          args.push('-filter_complex', `amix=inputs=${input.paths.length}:duration=longest:normalize=0`, '-y', audioPath)
          const mixer = spawn(ffmpeg, args)
          active = mixer
          mixer.on('exit', code => {
            active = null
            code === 0 ? resolve() : reject(new Error(`Audio mix exited ${code}`))
          })
          mixer.on('error', error => {
            active = null
            reject(error)
          })
        })
      }

      const { resultPath, cancellationPath } = transcriptionIpcPaths(app.getPath('temp'))
      await fs.writeFile(resultPath, '')
      await fs.rm(cancellationPath, { force: true })
      activeCancellationPath = cancellationPath

      return await new Promise(resolve => {
        let settled = false
        let consumedLength = 0
        let bufferedLine = ''

        const finish = async (result: Record<string, unknown>) => {
          if (settled) return
          settled = true
          clearInterval(pollTimer)
          const child = active
          active = null
          activeCancellationPath = null
          activeTemporaryMix = null
          if (child && !child.killed) child.kill('SIGTERM')
          await Promise.all([
            cleanupTranscriptionIpc(resultPath, cancellationPath),
            cleanupTranscriptionMix(temporaryMix),
          ])
          resolve(result)
        }

        const handleEvent = (event: TranscriptionEvent) => {
          getMainWindow()?.webContents.send('transcription-progress', event)
          if (event.type === 'result') void finish({ success: true, segments: event.segments ?? [] })
          else if (event.type === 'cancelled') void finish({ success: false, cancelled: true, error: event.message ?? 'Transcription cancelled' })
          else if (event.type === 'error') void finish({ success: false, error: event.message ?? 'Transcription failed' })
        }

        const readEvents = async () => {
          if (settled) return
          const text = await fs.readFile(resultPath, 'utf8').catch(() => '')
          if (text.length <= consumedLength) return
          bufferedLine += text.slice(consumedLength)
          consumedLength = text.length
          const lines = bufferedLine.split('\n')
          bufferedLine = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try { handleEvent(JSON.parse(line) as TranscriptionEvent) } catch { /* wait for the next complete line */ }
          }
        }

        const pollTimer = setInterval(() => { void readEvents() }, 100)
        active = spawn('/usr/bin/open', [
          '-n',
          '-W',
          helperApp,
          '--args',
          audioPath,
          input.language,
          resultPath,
          cancellationPath,
        ])
        active.on('error', error => { void finish({ success: false, error: error.message }) })
        active.on('exit', code => {
          void readEvents().then(() => {
            if (!settled) void finish({ success: false, cancelled: code === null, error: `Transcriber exited ${code}` })
          })
        })
      })
    } catch (error) {
      active = null
      const mix = activeTemporaryMix
      const cancellationPath = activeCancellationPath
      activeTemporaryMix = null
      activeCancellationPath = null
      await Promise.all([cleanupTranscriptionMix(mix), cleanupTranscriptionIpc(cancellationPath)])
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('transcription-cancel', async () => {
    if (!active) return false
    if (activeCancellationPath) await fs.writeFile(activeCancellationPath, 'cancel')
    else active.kill('SIGTERM')
    return true
  })
}
