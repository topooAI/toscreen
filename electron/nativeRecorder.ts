import path from 'node:path'
import { createRequire } from 'node:module'
import { RECORDINGS_DIR } from './main'

const require = createRequire(import.meta.url)

// Dynamically import node-mac-recorder to support graceful degradation on non-macOS platforms
let MacRecorder: any = null
let recorderInstance: any = null

try {
  MacRecorder = require('node-mac-recorder')
} catch (e) {
  console.warn('[NativeRecorder] node-mac-recorder not available on this platform:', (e as Error).message)
}

let isRecording = false
let currentOutputPath: string | null = null

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
}): Promise<{ success: boolean; outputPath?: string; error?: string }> {
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
      includeMicrophone: true,
      includeSystemAudio: true,
    })

    isRecording = true

    console.log(`[NativeRecorder] Recording started → ${currentOutputPath}`, {
      captureCursor: options?.showCursor ?? false,
      fps: options?.fps ?? 60,
      displayId: options?.displayId ?? null,
    })

    return { success: true, outputPath: currentOutputPath }
  } catch (error) {
    console.error('[NativeRecorder] Failed to start recording:', error)
    isRecording = false
    currentOutputPath = null
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

    return { 
      success: true, 
      outputPath: outputPath || undefined,
      audioOutputPath: result?.audioOutputPath || undefined
    }
  } catch (error) {
    console.error('[NativeRecorder] Failed to stop recording:', error)
    isRecording = false
    currentOutputPath = null
    recorderInstance = null
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
