export const DICTATION_DISABLED_MESSAGE = 'Siri and Dictation are disabled'

export function isDictationDisabledError(message: unknown): boolean {
  return typeof message === 'string'
    && message.toLowerCase().includes(DICTATION_DISABLED_MESSAGE.toLowerCase())
}

export function transcriptionErrorMessage(message: unknown): string {
  if (isDictationDisabledError(message)) {
    return 'macOS 的听写功能已关闭。请打开“系统设置 → 键盘 → 听写”，开启听写后返回 ToScreen 再次转录。'
  }
  return typeof message === 'string' && message.trim() ? message : 'Transcription failed'
}
