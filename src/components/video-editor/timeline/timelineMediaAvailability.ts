export function restoredSourceDurationSeconds(projectModel: any): number {
  const screenClip = Array.isArray(projectModel?.clips)
    ? projectModel.clips.find((clip: { type?: string }) => clip.type === 'screen-recording')
    : undefined
  if (!screenClip) return 0
  const startMs = Number(screenClip.sourceStartMs ?? 0)
  const endMs = Number(screenClip.sourceEndMs ?? screenClip.endMs ?? 0)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0
  return Math.max(0, endMs - startMs) / 1000
}

export function timelineMediaIsAvailable(videoPath: string | undefined, videoDurationSeconds: number): boolean {
  return Boolean(videoPath && Number.isFinite(videoDurationSeconds) && videoDurationSeconds > 0)
}

export function resolveSourceDurationSeconds(currentSeconds: number, metadataSeconds: number): number {
  if (Number.isFinite(metadataSeconds) && metadataSeconds > 0) return metadataSeconds
  return Number.isFinite(currentSeconds) && currentSeconds > 0 ? currentSeconds : 0
}
