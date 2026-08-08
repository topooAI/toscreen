export interface ProjectCoverFocus {
  x: number
  y: number
}

export function locateProjectCoverContent(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  preferredFocus: ProjectCoverFocus = { x: 50, y: 46 },
): ProjectCoverFocus {
  if (width < 8 || height < 8 || pixels.length < width * height * 4) return { x: 50, y: 46 }
  const luminance = new Float32Array(width * height)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    luminance[index] = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722
  }

  const windowWidth = Math.max(8, Math.round(width * .18))
  const windowHeight = Math.max(8, Math.round(height * .18))
  const xStep = Math.max(2, Math.round(width / 28))
  const yStep = Math.max(2, Math.round(height / 22))
  const evaluate = (centerX: number, centerY: number) => {
    const left = Math.max(1, Math.round(centerX - windowWidth / 2))
    const right = Math.min(width - 2, left + windowWidth)
    const top = Math.max(1, Math.round(centerY - windowHeight / 2))
    const bottom = Math.min(height - 2, top + windowHeight)
    let ink = 0
    let blank = 0
    let edge = 0
    let sum = 0
    let sumSquares = 0
    let samples = 0
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const value = luminance[y * width + x]
        sum += value
        sumSquares += value * value
        if (value < 226) ink += 1
        if (value > 247) blank += 1
        const gradient = Math.abs(value - luminance[y * width + x + 1])
          + Math.abs(value - luminance[(y + 1) * width + x])
        if (gradient > 22) edge += 1
        samples += 1
      }
    }
    const mean = sum / samples
    const variance = Math.max(0, sumSquares / samples - mean * mean)
    const inkRatio = ink / samples
    const blankRatio = blank / samples
    const edgeRatio = edge / samples
    const centerDistance = Math.hypot(centerX / width - .48, centerY / height - .4)
    return {
      x: centerX,
      y: centerY,
      blankRatio,
      score: edgeRatio * 2.2
        + inkRatio * 1.05
        + Math.min(1, variance / 2200) * .72
        - Math.max(0, blankRatio - .68) * 1.8
        - centerDistance * .3,
    }
  }
  let best = evaluate(width / 2, height * .46)

  for (let centerY = Math.round(height * .24); centerY <= height * .64; centerY += yStep) {
    for (let centerX = Math.round(width * .34); centerX <= width * .62; centerX += xStep) {
      const candidate = evaluate(centerX, centerY)
      if (candidate.score > best.score) best = candidate
    }
  }
  const preferred = evaluate(
    Math.min(width * .62, Math.max(width * .34, width * preferredFocus.x / 100)),
    Math.min(height * .64, Math.max(height * .24, height * preferredFocus.y / 100)),
  )
  const selected = preferred.blankRatio < .72 && preferred.score >= best.score - .08 ? preferred : best
  const isDetectedFocus = selected === best
  const selectedY = selected.y / height
  const projectionCompensation = isDetectedFocus ? (selectedY < .3 ? 20 : 7) : 0
  return {
    x: Number((selected.x / width * 100).toFixed(2)),
    y: Number(Math.min(72, selectedY * 100 + projectionCompensation).toFixed(2)),
  }
}

export function locateProjectCoverImage(image: HTMLImageElement, preferredFocus?: ProjectCoverFocus): ProjectCoverFocus | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 72
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const frame = context.getImageData(0, 0, canvas.width, canvas.height)
    return locateProjectCoverContent(frame.data, frame.width, frame.height, preferredFocus)
  } catch {
    return null
  }
}
