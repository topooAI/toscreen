import path from 'node:path'
import { createRequire } from 'node:module'
import { RECORDINGS_DIR } from './main'

const require = createRequire(import.meta.url)

// Dynamically import node-mac-recorder to support graceful degradation on non-macOS platforms
let MacRecorder: any = null
let recorderInstance: any = null
let nativeBinding: any = null

try {
  MacRecorder = require('node-mac-recorder')
  try {
    const recorderEntry = require.resolve('node-mac-recorder')
    nativeBinding = require(path.join(path.dirname(recorderEntry), 'build', 'Release', 'mac_recorder.node'))
  } catch (bindingError) {
    console.warn('[NativeRecorder] Video start clock is unavailable:', (bindingError as Error).message)
  }
} catch (e) {
  console.warn('[NativeRecorder] node-mac-recorder not available on this platform:', (e as Error).message)
}

let isRecording = false
let currentOutputPath: string | null = null
let currentVideoStartTime: number | null = null

async function readVideoStartTime(
  minimumStartTime: number,
  timeoutMs = 2500,
): Promise<number | null> {
  if (!nativeBinding?.getVideoStartTimestamp) return null

  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const timestamp = Number(nativeBinding.getVideoStartTimestamp())
    // ScreenCaptureKit resets asynchronously. During that window the native
    // binding can still expose the previous session's first-frame timestamp.
    if (Number.isFinite(timestamp) && timestamp >= minimumStartTime) return timestamp
    await new Promise(resolve => setTimeout(resolve, 16))
  }

  return null
}

/**
 * Check if native ScreenCaptureKit recording is available on this platform.
 * Requires macOS 12.3+ and node-mac-recorder to be installed.
 */
export function isNativeRecordingAvailable(): boolean {
  if (!MacRecorder) return false
  if (process.platform !== 'darwin') return false
  return true
}

/**
 * Start a native screen recording using ScreenCaptureKit.
 * The system cursor is excluded from the video stream at the OS rendering layer.
 */
export async function startNativeRecording(options?: {
  showCursor?: boolean
  fps?: number
  displayId?: number
  windowId?: number
  captureArea?: { x: number; y: number; width: number; height: number }
  includeMicrophone?: boolean
  includeSystemAudio?: boolean
  audioDeviceId?: string
}): Promise<{ success: boolean; outputPath?: string; videoStartTime?: number; error?: string }> {
  if (!MacRecorder) {
    return { success: false, error: 'node-mac-recorder is not available on this platform' }
  }

  if (isRecording) {
    return { success: false, error: 'A recording is already in progress' }
  }

  try {
    const timestamp = Date.now()
    const fileName = `recording-${timestamp}.mov`
    currentOutputPath = path.join(RECORDINGS_DIR, fileName)

    // Create a fresh recorder instance for each session
    recorderInstance = new MacRecorder()

    await recorderInstance.startRecording(currentOutputPath, {
      captureCursor: options?.showCursor === undefined ? false : options.showCursor, // node-mac-recorder 期望 captureCursor
      frameRate: options?.fps ?? 60,
      displayId: options?.displayId ?? null,
      windowId: options?.windowId ?? null,
      captureArea: options?.captureArea ?? null,
      includeMicrophone: options?.includeMicrophone ?? false,
      includeSystemAudio: options?.includeSystemAudio ?? false,
      audioDeviceId: options?.audioDeviceId ?? null,
    })

    const detectedVideoStartTime = await readVideoStartTime(timestamp)
    // A first encoded frame cannot predate the call that started this session.
    // Some macOS host-clock conversions report a small negative offset; the
    // filename/session timestamp is the authoritative lower bound shared by
    // node-mac-recorder's cursor sidecar.
    currentVideoStartTime = detectedVideoStartTime && detectedVideoStartTime >= timestamp
      ? detectedVideoStartTime
      : timestamp
    isRecording = true

    console.log(`[NativeRecorder] Recording started → ${currentOutputPath}`, {
      captureCursor: options?.showCursor ?? false,
      fps: options?.fps ?? 60,
      displayId: options?.displayId ?? null,
      windowId: options?.windowId ?? null,
      captureArea: options?.captureArea ?? null,
      includeMicrophone: options?.includeMicrophone ?? false,
      includeSystemAudio: options?.includeSystemAudio ?? false,
      videoStartTime: currentVideoStartTime,
    })

    return {
      success: true,
      outputPath: currentOutputPath,
      videoStartTime: currentVideoStartTime || undefined,
    }
  } catch (error) {
    console.error('[NativeRecorder] Failed to start recording:', error)
    isRecording = false
    currentOutputPath = null
    currentVideoStartTime = null
    return { success: false, error: String(error) }
  }
}

export async function pauseNativeRecording(): Promise<{ success: boolean; error?: string }> {
  if (!recorderInstance || !isRecording) return { success: false, error: 'No active recording to pause' }
  if (typeof recorderInstance.pauseRecording !== 'function') {
    return { success: false, error: 'Native pause is not supported by the installed recorder runtime' }
  }
  try {
    await recorderInstance.pauseRecording()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function resumeNativeRecording(): Promise<{ success: boolean; error?: string }> {
  if (!recorderInstance || !isRecording) return { success: false, error: 'No active recording to resume' }
  if (typeof recorderInstance.resumeRecording !== 'function') {
    return { success: false, error: 'Native resume is not supported by the installed recorder runtime' }
  }
  try {
    await recorderInstance.resumeRecording()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Stop the current native recording session.
 * Returns the output file path for downstream processing.
 */
export async function stopNativeRecording(): Promise<{
  success: boolean
  outputPath?: string
  audioOutputPath?: string
  videoStartTime?: number
  error?: string
}> {
  if (!recorderInstance || !isRecording) {
    return { success: false, error: 'No active recording to stop' }
  }

  try {
    const result = await recorderInstance.stopRecording()
    // CRITICAL: node-mac-recorder internally aligns filenames using sessionTimestamp, 
    // so we MUST use result.outputPath if returned, falling back to currentOutputPath.
    const outputPath = result?.outputPath || currentOutputPath

    console.log('[NativeRecorder] Recording stopped:', {
      outputPath,
      result,
    })

    isRecording = false
    currentOutputPath = null
    recorderInstance = null
    const videoStartTime = currentVideoStartTime
    currentVideoStartTime = null

    return { 
      success: true, 
      outputPath: outputPath || undefined,
      audioOutputPath: result?.audioOutputPath || undefined,
      videoStartTime: videoStartTime || undefined,
    }
  } catch (error) {
    console.error('[NativeRecorder] Failed to stop recording:', error)
    isRecording = false
    currentOutputPath = null
    recorderInstance = null
    currentVideoStartTime = null
    return { success: false, error: String(error) }
  }
}

/**
 * Get the current recording state.
 */
export function getNativeRecordingState(): {
  isRecording: boolean
  outputPath: string | null
} {
  return { isRecording, outputPath: currentOutputPath }
}
