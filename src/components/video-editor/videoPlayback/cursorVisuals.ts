import {
  CURSOR_CUSTOMIZABLE_STATES,
  resolveCursorStyle,
  type CursorCustomImageMap,
  type CursorCustomState,
  type CursorStylePreset,
} from '../types'

export interface CursorStyleOption {
  id: CursorStylePreset
  label: string
  fill: string
  stroke: string
}

export const CURSOR_STYLE_OPTIONS: readonly CursorStyleOption[] = [
  { id: 'toscreen', label: 'ToScreen', fill: '#111111', stroke: '#FFFFFF' },
  { id: 'system', label: 'System', fill: '#111111', stroke: '#FFFFFF' },
  { id: 'light', label: 'Light', fill: '#FFFFFF', stroke: '#111111' },
  { id: 'blue', label: 'Blue', fill: '#0D99FF', stroke: '#FFFFFF' },
  { id: 'yellow', label: 'Highlight', fill: '#FFD748', stroke: '#111111' },
  { id: 'pink', label: 'Pink', fill: '#F03CB6', stroke: '#FFFFFF' },
]

function cursorStyleOption(style?: CursorStylePreset): CursorStyleOption {
  const resolved = resolveCursorStyle(style, style !== 'system')
  return CURSOR_STYLE_OPTIONS.find(option => option.id === resolved) ?? CURSOR_STYLE_OPTIONS[0]
}

export type CursorVisualType = CursorCustomState | 'none'

export const SUPPORTED_CURSOR_VISUAL_TYPES: readonly CursorVisualType[] = [
  ...CURSOR_CUSTOMIZABLE_STATES,
  'none',
]

export function normalizeCursorVisualType(cursorType?: string): CursorVisualType {
  const normalized = String(cursorType || 'default').toLowerCase().replace(/_/g, '-')

  if (normalized === 'none') return 'none'
  if (normalized === 'pointer' || normalized === 'hand' || normalized === 'link') return 'pointer'
  if (normalized === 'text' || normalized === 'ibeam') return 'text'
  if (normalized === 'vertical-text' || normalized === 'vertical-ibeam') return 'vertical-text'
  if (normalized === 'grab' || normalized === 'open-hand') return 'grab'
  if (normalized === 'grabbing' || normalized === 'closed-hand') return 'grabbing'
  if (normalized === 'copy' || normalized === 'drag-copy') return 'copy'
  if (normalized === 'alias' || normalized === 'drag-link') return 'alias'
  if (normalized === 'context-menu' || normalized === 'contextual-menu') return 'context-menu'
  if (normalized === 'not-allowed' || normalized === 'no-drop' || normalized === 'forbidden') return 'not-allowed'
  if (normalized === 'help') return 'help'
  if (normalized === 'progress' || normalized === 'wait' || normalized === 'busy') return 'progress'
  if (normalized === 'crosshair' || normalized === 'cell') return 'crosshair'
  if (normalized === 'all-scroll' || normalized === 'move') return 'all-scroll'
  if (normalized === 'zoom-in') return 'zoom-in'
  if (normalized === 'zoom-out') return 'zoom-out'
  if (normalized === 'row-resize') return 'row-resize'
  if (normalized === 'ns-resize' || normalized === 'n-resize' || normalized === 's-resize') return 'ns-resize'
  if (normalized === 'col-resize' || normalized === 'ew-resize' || normalized === 'e-resize' || normalized === 'w-resize') return 'col-resize'
  if (normalized === 'nwse-resize' || normalized === 'nw-resize' || normalized === 'se-resize') return 'nwse-resize'
  if (normalized === 'nesw-resize' || normalized === 'ne-resize' || normalized === 'sw-resize') return 'nesw-resize'
  return 'default'
}

const arrowPath = '<path d="M0 0V40L11.4 28.6L21.4 48.6L28.6 44.2L18.6 24.2H36L0 0Z" fill="black" stroke="white" stroke-width="3" stroke-linejoin="round"/>'

function centeredSvg(type: CursorVisualType, body: string): string {
  return `<svg data-cursor-type="${type}" width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:-50%;top:-50%;display:block;overflow:visible;">${body}</svg>`
}

function arrowSvg(type: CursorVisualType, badge = ''): string {
  return `<svg data-cursor-type="${type}" width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;display:block;overflow:visible;">${arrowPath}${badge}</svg>`
}

function outlinedPath(path: string, outerWidth = 7, innerWidth = 3): string {
  return `<path d="${path}" stroke="white" stroke-width="${outerWidth}" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" stroke="black" stroke-width="${innerWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function arrowBadge(symbol: string): string {
  return `<g transform="translate(32 32)"><circle cx="0" cy="0" r="10" fill="white" stroke="black" stroke-width="2.5"/>${symbol}</g>`
}

function cursorSvgMarkupBase(cursorType?: string): string {
  const type = normalizeCursorVisualType(cursorType)

  if (type === 'none') return ''
  if (type === 'pointer') {
    return `<svg data-cursor-type="pointer" width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:-25%;top:0;display:block;overflow:visible;"><path d="M14 1C10.7 1 9 3.2 9 6.1V20L5.4 16.5C3.2 14.4 0 15.9 0 18.7C0 19.8 0.5 20.9 1.3 21.8L10.2 34.2C12.5 37.4 16.2 39.3 20.2 39.3H26.1C32 39.3 36.5 34.5 36.5 28.7V15.5C36.5 12.6 34.3 10.5 31.7 10.5C30.4 10.5 29.2 11 28.4 11.9C27.8 9.8 25.9 8.4 23.7 8.4C22.2 8.4 20.8 9.1 20 10.2V6.1C20 3.2 17.9 1 14 1Z" fill="black" stroke="white" stroke-width="3" stroke-linejoin="round"/></svg>`
  }
  if (type === 'text') return centeredSvg(type, outlinedPath('M18 7H38M28 7V49M18 49H38'))
  if (type === 'vertical-text') return centeredSvg(type, outlinedPath('M7 18V38M7 28H49M49 18V38'))
  if (type === 'grab') {
    return centeredSvg(type, '<path d="M11 29V22C11 19 14 17 17 18V13C17 10 20 8 23 10C24 6 29 6 31 10C34 8 38 10 38 14V18C41 17 45 19 45 23V30C45 41 38 48 28 48H25C17 48 11 40 11 29Z" fill="black" stroke="white" stroke-width="3" stroke-linejoin="round"/>')
  }
  if (type === 'grabbing') {
    return centeredSvg(type, '<path d="M12 27C12 23 16 21 19 23V18C19 14 24 13 26 16C28 12 33 13 34 17C38 15 42 18 42 22V31C42 41 36 47 27 47H24C17 47 12 39 12 31V27Z" fill="black" stroke="white" stroke-width="3" stroke-linejoin="round"/><path d="M19 24L19 31M26 18V30M34 19V30" stroke="white" stroke-width="2" stroke-linecap="round"/>')
  }
  if (type === 'copy') return arrowSvg(type, arrowBadge('<path d="M-5 0H5M0-5V5" stroke="black" stroke-width="2.5" stroke-linecap="round"/>'))
  if (type === 'alias') return arrowSvg(type, arrowBadge('<path d="M-5 3C-2-3 2-4 5-4M2-7L6-4L3 0" stroke="black" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'))
  if (type === 'context-menu') return arrowSvg(type, arrowBadge('<path d="M-5-4H5M-5 0H5M-5 4H2" stroke="black" stroke-width="2" stroke-linecap="round"/>'))
  if (type === 'not-allowed') return arrowSvg(type, arrowBadge('<path d="M-6-6L6 6" stroke="black" stroke-width="2.5" stroke-linecap="round"/>'))
  if (type === 'help') return arrowSvg(type, arrowBadge('<path d="M-3-3C-2-7 5-7 5-2C5 1 1 1 0 4M0 7H.1" stroke="black" stroke-width="2.2" fill="none" stroke-linecap="round"/>'))
  if (type === 'progress') {
    return arrowSvg(type, '<g transform="translate(34 34)"><circle r="9" fill="white" stroke="black" stroke-width="2"/><path d="M0-6V-9M4.2-4.2L6.4-6.4M6 0H9M4.2 4.2L6.4 6.4M0 6V9M-4.2 4.2L-6.4 6.4M-6 0H-9M-4.2-4.2L-6.4-6.4" stroke="black" stroke-width="2" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.8s" repeatCount="indefinite"/></path></g>')
  }
  if (type === 'crosshair') return centeredSvg(type, outlinedPath('M28 7V49M7 28H49', 6, 2))
  if (type === 'all-scroll') return centeredSvg(type, outlinedPath('M28 7V49M22 13L28 7L34 13M22 43L28 49L34 43M7 28H49M13 22L7 28L13 34M43 22L49 28L43 34', 6, 2))
  if (type === 'zoom-in' || type === 'zoom-out') {
    const sign = type === 'zoom-in' ? 'M18 28H34M26 20V36' : 'M18 28H34'
    return centeredSvg(type, outlinedPath(`M42 42L50 50M44 26C44 36 36 44 26 44C16 44 8 36 8 26C8 16 16 8 26 8C36 8 44 16 44 26${sign}`, 7, 3))
  }
  if (type === 'col-resize') return centeredSvg(type, outlinedPath('M7 28H49M14 20L6 28L14 36M42 20L50 28L42 36', 7, 3))
  if (type === 'row-resize' || type === 'ns-resize') return centeredSvg(type, outlinedPath('M28 7V49M20 14L28 6L36 14M20 42L28 50L36 42', 7, 3))
  if (type === 'nwse-resize') return centeredSvg(type, outlinedPath('M10 10L46 46M10 22V10H22M34 46H46V34', 7, 3))
  if (type === 'nesw-resize') return centeredSvg(type, outlinedPath('M46 10L10 46M34 10H46V22M10 34V46H22', 7, 3))
  return arrowSvg('default')
}

export function cursorSvgMarkup(
  cursorType?: string,
  cursorStyle: CursorStylePreset = 'toscreen',
): string {
  const markup = cursorSvgMarkupBase(cursorType)
  if (!markup) return markup

  const style = cursorStyleOption(cursorStyle)
  return markup
    .replace(/="black"/g, `="${style.fill}"`)
    .replace(/="white"/g, `="${style.stroke}"`)
}

export function cursorElementMarkup(
  cursorType?: string,
  cursorStyle: CursorStylePreset = 'toscreen',
  customImages: CursorCustomImageMap = {},
): string {
  const type = normalizeCursorVisualType(cursorType)
  const customImage = type === 'none' ? undefined : customImages[type]
  if (cursorStyle === 'custom' && customImage?.startsWith('data:image/')) {
    return `<img data-cursor-type="${type}" src="${customImage}" alt="" style="display:block;width:56px;height:56px;object-fit:contain;object-position:left top;"/>`
  }
  return cursorSvgMarkup(type, cursorStyle === 'custom' ? 'toscreen' : cursorStyle)
}

function strokeCurrentPath(
  ctx: CanvasRenderingContext2D,
  style: CursorStyleOption,
  outerWidth = 4,
  innerWidth = 1.8,
): void {
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = outerWidth
  ctx.stroke()
  ctx.strokeStyle = style.fill
  ctx.lineWidth = innerWidth
  ctx.stroke()
}

function drawArrow(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 20)
  ctx.lineTo(5.7, 14.3)
  ctx.lineTo(10.7, 24.3)
  ctx.lineTo(14.3, 22.1)
  ctx.lineTo(9.3, 12.1)
  ctx.lineTo(18, 12.1)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  type: CursorVisualType,
  animationTimeMs: number,
  style: CursorStyleOption,
): void {
  ctx.save()
  ctx.translate(16, 16)
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, Math.PI * 2)
  ctx.fillStyle = style.stroke
  ctx.fill()
  ctx.strokeStyle = style.fill
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = style.fill
  ctx.lineWidth = 1.3
  if (type === 'copy') {
    ctx.moveTo(-2.7, 0); ctx.lineTo(2.7, 0); ctx.moveTo(0, -2.7); ctx.lineTo(0, 2.7)
  } else if (type === 'not-allowed') {
    ctx.moveTo(-3, -3); ctx.lineTo(3, 3)
  } else if (type === 'context-menu') {
    ctx.moveTo(-3, -2.5); ctx.lineTo(3, -2.5); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(-3, 2.5); ctx.lineTo(1, 2.5)
  } else if (type === 'alias') {
    ctx.moveTo(-3, 2); ctx.bezierCurveTo(-1, -2, 1.5, -2.5, 3, -2.5); ctx.lineTo(1.5, -4); ctx.moveTo(3, -2.5); ctx.lineTo(1.5, -1)
  } else if (type === 'help') {
    ctx.arc(0, -1, 2.5, Math.PI * 0.9, Math.PI * 2.1); ctx.moveTo(0, 2.7); ctx.lineTo(0, 2.8)
  } else if (type === 'progress') {
    const angle = (animationTimeMs / 800) * Math.PI * 2
    for (let index = 0; index < 8; index += 1) {
      const spoke = angle + index * Math.PI / 4
      ctx.moveTo(Math.cos(spoke) * 2.5, Math.sin(spoke) * 2.5)
      ctx.lineTo(Math.cos(spoke) * 4, Math.sin(spoke) * 4)
    }
  }
  ctx.stroke()
  ctx.restore()
}

function drawPointingHand(ctx: CanvasRenderingContext2D): void {
  ctx.translate(-7, 0)
  ctx.beginPath()
  ctx.moveTo(7, 0.5)
  ctx.bezierCurveTo(5.35, 0.5, 4.5, 1.6, 4.5, 3.05)
  ctx.lineTo(4.5, 10)
  ctx.lineTo(2.7, 8.25)
  ctx.bezierCurveTo(1.6, 7.2, 0, 7.95, 0, 9.35)
  ctx.bezierCurveTo(0, 9.9, 0.25, 10.45, 0.65, 10.9)
  ctx.lineTo(5.1, 17.1)
  ctx.bezierCurveTo(6.25, 18.7, 8.1, 19.65, 10.1, 19.65)
  ctx.lineTo(13.05, 19.65)
  ctx.bezierCurveTo(16, 19.65, 18.25, 17.25, 18.25, 14.35)
  ctx.lineTo(18.25, 7.75)
  ctx.bezierCurveTo(18.25, 6.3, 17.15, 5.25, 15.85, 5.25)
  ctx.bezierCurveTo(15.2, 5.25, 14.6, 5.5, 14.2, 5.95)
  ctx.bezierCurveTo(13.9, 4.9, 12.95, 4.2, 11.85, 4.2)
  ctx.bezierCurveTo(11.1, 4.2, 10.4, 4.55, 10, 5.1)
  ctx.lineTo(10, 3.05)
  ctx.bezierCurveTo(10, 1.6, 8.95, 0.5, 7, 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawHand(ctx: CanvasRenderingContext2D, closed: boolean, style: CursorStyleOption): void {
  ctx.translate(-14, -14)
  ctx.beginPath()
  if (closed) {
    ctx.moveTo(6, 14); ctx.bezierCurveTo(6, 11, 9, 10, 11, 11); ctx.lineTo(11, 9); ctx.bezierCurveTo(11, 7, 14, 6, 15, 8); ctx.bezierCurveTo(17, 6, 20, 7, 20, 9); ctx.bezierCurveTo(22, 8, 24, 9, 24, 11); ctx.lineTo(24, 17); ctx.bezierCurveTo(24, 23, 20, 26, 14, 26); ctx.bezierCurveTo(9, 26, 6, 21, 6, 17); ctx.closePath()
  } else {
    ctx.moveTo(5, 15); ctx.lineTo(5, 11); ctx.bezierCurveTo(5, 9, 8, 8, 9, 10); ctx.lineTo(9, 6); ctx.bezierCurveTo(9, 4, 12, 3, 13, 5); ctx.bezierCurveTo(14, 2, 17, 3, 18, 5); ctx.bezierCurveTo(20, 4, 22, 5, 22, 7); ctx.lineTo(22, 9); ctx.bezierCurveTo(24, 8, 26, 9, 26, 11); ctx.lineTo(26, 16); ctx.bezierCurveTo(26, 23, 22, 27, 15, 27); ctx.bezierCurveTo(9, 27, 5, 22, 5, 15); ctx.closePath()
  }
  ctx.fill(); ctx.stroke()
  if (closed) {
    ctx.beginPath()
    ctx.moveTo(9.5, 13); ctx.lineTo(9.5, 17)
    ctx.moveTo(13, 9); ctx.lineTo(13, 16)
    ctx.moveTo(17, 9.5); ctx.lineTo(17, 16)
    ctx.strokeStyle = style.stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function drawLineCursor(ctx: CanvasRenderingContext2D, type: CursorVisualType, style: CursorStyleOption): void {
  ctx.beginPath()
  if (type === 'text') {
    ctx.moveTo(-5, -10.5); ctx.lineTo(5, -10.5); ctx.moveTo(0, -10.5); ctx.lineTo(0, 10.5); ctx.moveTo(-5, 10.5); ctx.lineTo(5, 10.5)
  } else if (type === 'vertical-text') {
    ctx.moveTo(-10.5, -5); ctx.lineTo(-10.5, 5); ctx.moveTo(-10.5, 0); ctx.lineTo(10.5, 0); ctx.moveTo(10.5, -5); ctx.lineTo(10.5, 5)
  } else if (type === 'crosshair') {
    ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-11, 0); ctx.lineTo(11, 0)
  } else if (type === 'all-scroll') {
    ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(-3, -8); ctx.lineTo(0, -11); ctx.lineTo(3, -8); ctx.moveTo(-3, 8); ctx.lineTo(0, 11); ctx.lineTo(3, 8); ctx.moveTo(-8, -3); ctx.lineTo(-11, 0); ctx.lineTo(-8, 3); ctx.moveTo(8, -3); ctx.lineTo(11, 0); ctx.lineTo(8, 3)
  } else if (type === 'col-resize') {
    ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(-7, -4); ctx.lineTo(-11, 0); ctx.lineTo(-7, 4); ctx.moveTo(7, -4); ctx.lineTo(11, 0); ctx.lineTo(7, 4)
  } else if (type === 'row-resize' || type === 'ns-resize') {
    ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-4, -7); ctx.lineTo(0, -11); ctx.lineTo(4, -7); ctx.moveTo(-4, 7); ctx.lineTo(0, 11); ctx.lineTo(4, 7)
  } else if (type === 'nwse-resize') {
    ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(-9, -3); ctx.lineTo(-9, -9); ctx.lineTo(-3, -9); ctx.moveTo(3, 9); ctx.lineTo(9, 9); ctx.lineTo(9, 3)
  } else if (type === 'nesw-resize') {
    ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.moveTo(3, -9); ctx.lineTo(9, -9); ctx.lineTo(9, -3); ctx.moveTo(-9, 3); ctx.lineTo(-9, 9); ctx.lineTo(-3, 9)
  }
  strokeCurrentPath(ctx, style)
}

function drawZoomCursor(
  ctx: CanvasRenderingContext2D,
  type: 'zoom-in' | 'zoom-out',
  style: CursorStyleOption,
): void {
  ctx.beginPath()
  ctx.arc(-1, -1, 8, 0, Math.PI * 2)
  ctx.moveTo(5, 5); ctx.lineTo(11, 11)
  ctx.moveTo(-5, -1); ctx.lineTo(3, -1)
  if (type === 'zoom-in') { ctx.moveTo(-1, -5); ctx.lineTo(-1, 3) }
  strokeCurrentPath(ctx, style)
}

export function drawCursorVisual(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  cursorType?: string,
  isVectorStyle = true,
  animationTimeMs = 0,
  cursorStyle: CursorStylePreset = 'toscreen',
  customImages: Partial<Record<CursorCustomState, CanvasImageSource>> = {},
): void {
  const type = normalizeCursorVisualType(cursorType)
  if (type === 'none') return
  const style = cursorStyleOption(cursorStyle)
  const customImage = cursorStyle === 'custom' ? customImages[type] : undefined

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.shadowColor = isVectorStyle ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = isVectorStyle ? 5 : 2
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = isVectorStyle ? 3 : 1
  ctx.fillStyle = style.fill
  ctx.strokeStyle = style.stroke
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (cursorStyle === 'custom' && customImage) {
    const source = customImage as CanvasImageSource & {
      naturalWidth?: number
      naturalHeight?: number
      width?: number
      height?: number
    }
    const sourceWidth = source.naturalWidth || source.width || 28
    const sourceHeight = source.naturalHeight || source.height || 28
    const fitScale = 28 / Math.max(sourceWidth, sourceHeight)
    ctx.drawImage(customImage, 0, 0, sourceWidth * fitScale, sourceHeight * fitScale)
    ctx.restore()
    return
  }

  if (type === 'pointer') drawPointingHand(ctx)
  else if (type === 'grab' || type === 'grabbing') drawHand(ctx, type === 'grabbing', style)
  else if (type === 'zoom-in' || type === 'zoom-out') drawZoomCursor(ctx, type, style)
  else if (['text', 'vertical-text', 'crosshair', 'all-scroll', 'row-resize', 'col-resize', 'ns-resize', 'nwse-resize', 'nesw-resize'].includes(type)) drawLineCursor(ctx, type, style)
  else {
    drawArrow(ctx)
    if (['copy', 'alias', 'context-menu', 'not-allowed', 'help', 'progress'].includes(type)) drawBadge(ctx, type, animationTimeMs, style)
  }

  ctx.restore()
}
