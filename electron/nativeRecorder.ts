import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { RECORDINGS_DIR } from './main'

const require = createRequire(import.meta.url)
let MacRecorder: any = null
let nativeBinding: any = null
try {
  MacRecorder = require('node-mac-recorder')
  const recorderEntry = require.resolve('node-mac-recorder')
  try { nativeBinding = require(path.join(path.dirname(recorderEntry), 'build', 'Release', 'mac_recorder.node')) } catch { /* optional clock */ }
} catch (error) { console.warn('[NativeRecorder] unavailable:', (error as Error).message) }

type Bounds = { x: number; y: number; width: number; height: number }
type NativeOptions = {
  showCursor?: boolean; fps?: number; displayId?: number; windowId?: number; captureArea?: Bounds
  includeMicrophone?: boolean; includeSystemAudio?: boolean; audioDeviceId?: string
  captureCamera?: boolean; cameraDeviceId?: string
}
type Segment = { outputPath: string; audioOutputPath?: string; cameraOutputPath?: string; videoStartTime: number; durationMs: number }

let recorderInstance: any = null
let isRecording = false
let isPaused = false
let finalOutputPath: string | null = null
let segmentStartedAt = 0
let segmentVideoStartTime = 0
let activeSegmentPath: string | null = null
let sessionOptions: NativeOptions | null = null
let segments: Segment[] = []

export function isNativeRecordingAvailable(): boolean { return Boolean(MacRecorder) && process.platform === 'darwin' }

async function readVideoStartTime(minimum: number, timeoutMs = 2500): Promise<number | null> {
  if (!nativeBinding?.getVideoStartTimestamp) return null
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const value = Number(nativeBinding.getVideoStartTimestamp())
    if (Number.isFinite(value) && value >= minimum) return value
    await new Promise(resolve => setTimeout(resolve, 16))
  }
  return null
}

async function startSegment(): Promise<{ success: boolean; videoStartTime?: number; error?: string }> {
  if (!MacRecorder || !finalOutputPath || !sessionOptions) return { success: false, error: 'Recording session is not configured' }
  const segmentPath = path.join(RECORDINGS_DIR, `${path.parse(finalOutputPath).name}.segment-${segments.length}.mov`)
  activeSegmentPath = segmentPath
  recorderInstance = new MacRecorder()
  segmentStartedAt = Date.now()
  try {
    await recorderInstance.startRecording(segmentPath, {
      captureCursor: sessionOptions.showCursor ?? false,
      frameRate: sessionOptions.fps ?? 60,
      displayId: sessionOptions.displayId ?? null,
      windowId: sessionOptions.windowId ?? null,
      captureArea: sessionOptions.captureArea ?? null,
      includeMicrophone: sessionOptions.includeMicrophone ?? false,
      includeSystemAudio: sessionOptions.includeSystemAudio ?? false,
      audioDeviceId: sessionOptions.audioDeviceId ?? null,
      captureCamera: sessionOptions.captureCamera ?? false,
      cameraDeviceId: sessionOptions.cameraDeviceId ?? null,
    })
    const videoStartTime = await readVideoStartTime(segmentStartedAt) || segmentStartedAt
    segmentVideoStartTime = videoStartTime
    isRecording = true
    isPaused = false
    return { success: true, videoStartTime }
  } catch (error) {
    recorderInstance = null
    return { success: false, error: String(error) }
  }
}

async function finishSegment(): Promise<Segment> {
  const captureEndedAt = Date.now()
  const result = await recorderInstance.stopRecording()
  const outputPath = result.outputPath || activeSegmentPath
  if (!outputPath) throw new Error('Native recorder did not return a segment output path')
  const segment: Segment = {
    outputPath,
    audioOutputPath: result.audioOutputPath || undefined,
    cameraOutputPath: result.cameraOutputPath || undefined,
    videoStartTime: segmentVideoStartTime || segmentStartedAt,
    durationMs: Math.max(1, captureEndedAt - (segmentVideoStartTime || segmentStartedAt)),
  }
  segments.push(segment)
  recorderInstance = null
  activeSegmentPath = null
  isRecording = false
  return segment
}

export async function startNativeRecording(options: NativeOptions = {}): Promise<{ success: boolean; outputPath?: string; videoStartTime?: number; error?: string }> {
  if (!isNativeRecordingAvailable()) return { success: false, error: 'node-mac-recorder is not available on this platform' }
  if (isRecording || isPaused) return { success: false, error: 'A recording is already in progress' }
  const timestamp = Date.now()
  finalOutputPath = path.join(RECORDINGS_DIR, `recording-${timestamp}.mov`)
  sessionOptions = options
  segments = []
  const result = await startSegment()
  return { ...result, outputPath: result.success ? finalOutputPath : undefined }
}

export async function pauseNativeRecording(): Promise<{ success: boolean; segment?: Segment; error?: string }> {
  if (!recorderInstance || !isRecording) return { success: false, error: 'No active recording to pause' }
  try { const segment = await finishSegment(); isPaused = true; return { success: true, segment } }
  catch (error) { return { success: false, error: String(error) } }
}

export async function resumeNativeRecording(): Promise<{ success: boolean; videoStartTime?: number; error?: string }> {
  if (!isPaused) return { success: false, error: 'Recording is not paused' }
  return startSegment()
}

async function concatFiles(inputs: string[], output: string): Promise<string | undefined> {
  const existing: string[] = []
  for (const input of inputs) { try { await fs.access(input); existing.push(input) } catch { /* absent optional stem */ } }
  if (!existing.length) return undefined
  if (existing.length === 1) { await fs.rename(existing[0], output); return output }
  const listPath = `${output}.concat.txt`
  await fs.writeFile(listPath, existing.map(item => `file '${item.split("'").join("'\\''")}'`).join('\n'))
  const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path as string
  await new Promise<void>((resolve, reject) => {
    const process = spawn(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', output], { stdio: 'ignore' })
    process.once('error', reject); process.once('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg concat exited ${code}`)))
  })
  await fs.unlink(listPath).catch(() => undefined)
  await Promise.all(existing.map(item => fs.unlink(item).catch(() => undefined)))
  return output
}

export async function stopNativeRecording(): Promise<{ success: boolean; outputPath?: string; audioOutputPath?: string; cameraOutputPath?: string; videoStartTime?: number; segmentDurationsMs?: number[]; segmentStartTimes?: number[]; error?: string }> {
  if (!finalOutputPath || (!isRecording && !isPaused)) return { success: false, error: 'No active recording to stop' }
  try {
    if (isRecording) await finishSegment()
    const parsed = path.parse(finalOutputPath)
    const audioOutputPath = await concatFiles(segments.flatMap(item => item.audioOutputPath ? [item.audioOutputPath] : []), path.join(parsed.dir, `${parsed.name}-system-audio.webm`))
    const cameraOutputPath = await concatFiles(segments.flatMap(item => item.cameraOutputPath ? [item.cameraOutputPath] : []), path.join(parsed.dir, `${parsed.name}-camera.mov`))
    await concatFiles(segments.map(item => item.outputPath), finalOutputPath)
    const result = { success: true, outputPath: finalOutputPath, audioOutputPath, cameraOutputPath, videoStartTime: segments[0]?.videoStartTime, segmentDurationsMs: segments.map(item => item.durationMs), segmentStartTimes: segments.map(item => item.videoStartTime) }
    isRecording = false; isPaused = false; finalOutputPath = null; sessionOptions = null; segments = []
    return result
  } catch (error) { return { success: false, error: String(error) } }
}

export function getNativeRecordingState() { return { isRecording, isPaused, outputPath: finalOutputPath, segmentCount: segments.length + (isRecording ? 1 : 0) } }
