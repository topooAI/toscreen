export interface CursorTelemetryEvent {
  timestamp: number
  absoluteTime?: number
  unixTimeMs?: number
  x: number
  y: number
  cx?: number
  cy?: number
  cursorType?: string
  type?: string
  isClick?: boolean
  isPointerDown?: boolean
  videoInfo?: { width?: number; height?: number }
  displayInfo?: { width?: number; height?: number }
  [key: string]: unknown
}

export const MAX_NATIVE_CURSOR_TIMESTAMP_DRIFT_MS = 1000

export function selectNativeCursorSidecar(
  mediaTimestamp: number,
  fileNames: readonly string[],
  maxDriftMs = MAX_NATIVE_CURSOR_TIMESTAMP_DRIFT_MS,
): string | null {
  if (!Number.isFinite(mediaTimestamp)) return null

  return fileNames
    .flatMap((fileName) => {
      const match = fileName.match(/^temp_cursor_(\d{13})\.json$/)
      if (!match) return []
      const timestamp = Number(match[1])
      const driftMs = Math.abs(timestamp - mediaTimestamp)
      return Number.isFinite(timestamp) && driftMs <= maxDriftMs
        ? [{ fileName, timestamp, driftMs }]
        : []
    })
    .sort((left, right) => left.driftMs - right.driftMs || left.timestamp - right.timestamp)[0]?.fileName ?? null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function resolveCursorTimelineStart(
  nativeEvents: unknown,
  fallbackTimelineStart?: number,
): number | undefined {
  // The event-driven sidecar is written with the first encoded video frame
  // returned by ScreenCaptureKit. The native cursor sidecar can retain the
  // recorder session/filename timestamp, which is earlier than that frame.
  // Prefer the explicit media clock whenever it is available.
  const fallback = finiteNumber(fallbackTimelineStart)
  if (fallback !== null && fallback > 0) return fallback

  if (Array.isArray(nativeEvents)) {
    for (const eventValue of nativeEvents) {
      const event = eventValue as CursorTelemetryEvent
      const metadata = event?._syncMetadata as { videoStartTime?: unknown } | undefined
      const metadataStart = finiteNumber(metadata?.videoStartTime)
      if (metadataStart !== null && metadataStart > 0) return metadataStart
    }
  }
  return undefined
}

export function rebaseCursorEventsToTimeline(
  events: readonly CursorTelemetryEvent[],
  timelineStartTime?: number,
): CursorTelemetryEvent[] {
  if (!Number.isFinite(timelineStartTime)) return [...events]

  return events.flatMap((event) => {
    const absoluteTime = finiteNumber(event.absoluteTime ?? event.unixTimeMs)
    if (absoluteTime === null) return [{ ...event }]

    const timestamp = absoluteTime - Number(timelineStartTime)
    return timestamp >= 0 ? [{ ...event, timestamp }] : []
  })
}

export function normalizeNativeCursorEvents(
  events: unknown,
  timelineStartTime?: number,
): CursorTelemetryEvent[] {
  if (!Array.isArray(events)) return []

  const resolvedTimelineStart = resolveCursorTimelineStart(events, timelineStartTime)

  let pointerDown = false
  return events.flatMap((eventValue) => {
    const event = eventValue as CursorTelemetryEvent
    const unixTimeMs = finiteNumber(event?.unixTimeMs)
    const sourceTimestamp = finiteNumber(event?.timestamp)
    const timestamp = unixTimeMs !== null && Number.isFinite(resolvedTimelineStart)
      ? unixTimeMs - Number(resolvedTimelineStart)
      : sourceTimestamp
    const x = finiteNumber(event?.x)
    const y = finiteNumber(event?.y)
    const width = finiteNumber(event?.videoInfo?.width ?? event?.displayInfo?.width)
    const height = finiteNumber(event?.videoInfo?.height ?? event?.displayInfo?.height)

    if (
      timestamp === null
      || timestamp < 0
      || x === null
      || y === null
      || width === null
      || height === null
      || width <= 0
      || height <= 0
    ) {
      return []
    }

    const type = String(event.type || 'move')
    if (type === 'mousedown' || type === 'drag') pointerDown = true
    if (type === 'mouseup') pointerDown = false

    return [{
      ...event,
      timestamp,
      absoluteTime: unixTimeMs ?? undefined,
      x,
      y,
      cx: clamp01(x / width),
      cy: clamp01(y / height),
      cursorType: typeof event.cursorType === 'string' ? event.cursorType : 'default',
      isClick: type === 'click' || type === 'mousedown',
      isPointerDown: pointerDown,
    }]
  })
}

function positionAtTimestamp(
  events: readonly CursorTelemetryEvent[],
  timestamp: number,
): Pick<CursorTelemetryEvent, 'x' | 'y' | 'cx' | 'cy' | 'isPointerDown'> | null {
  if (events.length === 0) return null

  let rightIndex = events.findIndex(event => event.timestamp > timestamp)
  if (rightIndex === -1) rightIndex = events.length
  const left = events[Math.max(0, rightIndex - 1)]
  const right = events[Math.min(events.length - 1, rightIndex)]

  const leftCx = finiteNumber(left.cx)
  const leftCy = finiteNumber(left.cy)
  const rightCx = finiteNumber(right.cx)
  const rightCy = finiteNumber(right.cy)
  if (leftCx === null || leftCy === null || rightCx === null || rightCy === null) return null

  const duration = right.timestamp - left.timestamp
  const progress = duration > 0 && duration <= 120
    ? clamp01((timestamp - left.timestamp) / duration)
    : 0
  const cx = leftCx + (rightCx - leftCx) * progress
  const cy = leftCy + (rightCy - leftCy) * progress

  return {
    x: cx,
    y: cy,
    cx,
    cy,
    isPointerDown: left.isPointerDown,
  }
}

export function mergeCursorShapeTelemetry(
  preciseEvents: readonly CursorTelemetryEvent[],
  nativeEvents: readonly CursorTelemetryEvent[],
): CursorTelemetryEvent[] {
  if (preciseEvents.length === 0) return [...nativeEvents]
  if (nativeEvents.length === 0) return [...preciseEvents]

  const precise = [...preciseEvents].sort((a, b) => a.timestamp - b.timestamp)
  const native = [...nativeEvents].sort((a, b) => a.timestamp - b.timestamp)
  let nativeIndex = -1
  let activeCursorType = 'default'

  const typedPrecise = precise.map((event) => {
    while (nativeIndex + 1 < native.length && native[nativeIndex + 1].timestamp <= event.timestamp) {
      nativeIndex += 1
      activeCursorType = native[nativeIndex].cursorType || activeCursorType
    }
    return {
      ...event,
      cursorType: event.cursorType || activeCursorType,
    }
  })

  let previousCursorType: string | null = null
  const shapeTransitions = native.flatMap((event) => {
    const cursorType = event.cursorType || 'default'
    if (cursorType === previousCursorType) return []
    previousCursorType = cursorType

    const position = positionAtTimestamp(typedPrecise, event.timestamp)
    if (!position) return []

    return [{
      ...event,
      ...position,
      type: 'move',
      isClick: false,
      cursorType,
    }]
  })

  return [...typedPrecise, ...shapeTransitions].sort((a, b) => a.timestamp - b.timestamp)
}
