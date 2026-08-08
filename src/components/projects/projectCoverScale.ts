const TARGET_VISIBLE_SOURCE_WIDTH_PX = 420
const COVER_SCENE_WIDTH_FACTOR = 1.48 * 1.08
const DEFAULT_SOURCE_WIDTH_PX = 3200
const MIN_DETAIL_SCALE = 1.5
const MAX_DETAIL_SCALE = 6.2

export function getProjectCoverDetailScale(sourceWidth?: number): number {
  const normalizedWidth = Number.isFinite(sourceWidth) && Number(sourceWidth) > 0
    ? Number(sourceWidth)
    : DEFAULT_SOURCE_WIDTH_PX
  const scale = normalizedWidth / (TARGET_VISIBLE_SOURCE_WIDTH_PX * COVER_SCENE_WIDTH_FACTOR)
  return Number(Math.min(MAX_DETAIL_SCALE, Math.max(MIN_DETAIL_SCALE, scale)).toFixed(3))
}

export function estimateVisibleSourceWidth(sourceWidth: number, detailScale: number): number {
  return sourceWidth / (COVER_SCENE_WIDTH_FACTOR * detailScale)
}

export function getProjectCoverImagePlacement(detailScale: number, focus: { x: number; y: number }) {
  return {
    sizePercent: detailScale * 100,
    leftPercent: 50 - focus.x / 100 * detailScale * 100,
    topPercent: 50 - focus.y / 100 * detailScale * 100,
  }
}
