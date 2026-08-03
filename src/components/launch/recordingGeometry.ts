export type Rectangle = { x: number; y: number; width: number; height: number }

export function clampSelection(rect: Rectangle, viewport: Rectangle, minimum = 32): Rectangle {
  const width = Math.min(viewport.width, Math.max(minimum, rect.width))
  const height = Math.min(viewport.height, Math.max(minimum, rect.height))
  return {
    x: Math.min(viewport.width - width, Math.max(0, rect.x)),
    y: Math.min(viewport.height - height, Math.max(0, rect.y)),
    width,
    height,
  }
}

export function selectionToGlobalBounds(selection: Rectangle, preview: Rectangle, display: Rectangle): Rectangle {
  const normalized = clampSelection(selection, preview)
  const scaleX = display.width / preview.width
  const scaleY = display.height / preview.height
  return {
    x: Math.round(display.x + normalized.x * scaleX),
    y: Math.round(display.y + normalized.y * scaleY),
    width: Math.max(1, Math.round(normalized.width * scaleX)),
    height: Math.max(1, Math.round(normalized.height * scaleY)),
  }
}
