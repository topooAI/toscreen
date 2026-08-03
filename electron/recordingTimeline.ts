export type RecordingSegment<TEvent extends { absoluteTime: number }> = {
  events: TEvent[]
  videoStartTime: number
  durationMs: number
}

export function mergeSegmentEvents<TEvent extends { absoluteTime: number; nativeTimeMs?: number }>(segments: RecordingSegment<TEvent>[], timelineStart: number): Array<TEvent & { nativeTimeMs: undefined }> {
  let timelineOffset = 0
  return segments.flatMap(segment => {
    const mapped = segment.events
      .filter(event => event.absoluteTime >= segment.videoStartTime && event.absoluteTime <= segment.videoStartTime + segment.durationMs)
      .map(event => ({ ...event, nativeTimeMs: undefined, absoluteTime: timelineStart + timelineOffset + event.absoluteTime - segment.videoStartTime }))
    timelineOffset += segment.durationMs
    return mapped
  })
}

export function totalSegmentDuration(segments: Array<{ durationMs: number }>): number {
  return segments.reduce((sum, segment) => sum + Math.max(0, segment.durationMs), 0)
}
