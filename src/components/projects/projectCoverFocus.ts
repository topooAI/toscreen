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

  const windowWidth = Math.max(8, Math.round(width * .13))
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
    const columnEdges = new Uint16Array(right - left + 1)
    const edgeCells = new Uint16Array(24)
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const value = luminance[y * width + x]
        sum += value
        sumSquares += value * value
        if (value < 226) ink += 1
        if (value > 247) blank += 1
        const gradient = Math.abs(value - luminance[y * width + x + 1])
          + Math.abs(value - luminance[(y + 1) * width + x])
        if (gradient > 22) {
          edge += 1
          columnEdges[x - left] += 1
          const cellX = Math.min(5, Math.floor((x - left) / Math.max(1, right - left + 1) * 6))
          const cellY = Math.min(3, Math.floor((y - top) / Math.max(1, bottom - top + 1) * 4))
          edgeCells[cellY * 6 + cellX] += 1
        }
        samples += 1
      }
    }
    const mean = sum / samples
    const variance = Math.max(0, sumSquares / samples - mean * mean)
    const inkRatio = ink / samples
    const blankRatio = blank / samples
    const edgeRatio = edge / samples
    const activeColumnThreshold = Math.max(1, Math.round((bottom - top + 1) * .08))
    const horizontalEdgeSpread = columnEdges.filter(value => value >= activeColumnThreshold).length / columnEdges.length
    const cellArea = samples / edgeCells.length
    const occupiedEdgeCells = edgeCells.filter(value => value >= Math.max(2, cellArea * .025)).length / edgeCells.length
    let strongestThreeColumnBand = 0
    for (let index = 0; index < columnEdges.length; index += 1) {
      strongestThreeColumnBand = Math.max(
        strongestThreeColumnBand,
        columnEdges[index] + (columnEdges[index + 1] || 0) + (columnEdges[index + 2] || 0),
      )
    }
    const narrowEdgeConcentration = edge ? strongestThreeColumnBand / edge : 0
    const centerDistance = Math.hypot(centerX / width - .48, centerY / height - .44)
    return {
      x: centerX,
      y: centerY,
      blankRatio,
      score: edgeRatio * 2.2
        + inkRatio * 1.05
        + Math.min(1, variance / 2200) * .72
        + horizontalEdgeSpread * .62
        + occupiedEdgeCells * .84
        - Math.max(0, blankRatio - .68) * 1.8
        - Math.max(0, inkRatio - .08) * 18
        - Math.max(0, narrowEdgeConcentration - .44) * 1.5
        - centerDistance * .72,
    }
  }
  let best = evaluate(width / 2, height * .46)
  const preferredX = Math.min(.68, Math.max(.24, preferredFocus.x / 100))
  const preferredY = Math.min(.68, Math.max(.26, preferredFocus.y / 100))
  const minSearchX = Math.max(.24, preferredX - .16)
  const maxSearchX = Math.min(.68, preferredX + .16)
  const minSearchY = Math.max(.26, preferredY - .16)
  const maxSearchY = Math.min(.68, preferredY + .16)

  for (let centerY = Math.round(height * minSearchY); centerY <= height * maxSearchY; centerY += yStep) {
    for (let centerX = Math.round(width * minSearchX); centerX <= width * maxSearchX; centerX += xStep) {
      const candidate = evaluate(centerX, centerY)
      if (candidate.score > best.score) best = candidate
    }
  }
  const preferred = evaluate(
    Math.min(width * .68, Math.max(width * .24, width * preferredFocus.x / 100)),
    Math.min(height * .66, Math.max(height * .26, height * preferredFocus.y / 100)),
  )
  const preferredIsContent = preferred.blankRatio < .9
  const selected = preferredIsContent
    ? {
        x: preferred.x * .55 + best.x * .45,
        y: preferred.y * .55 + best.y * .45,
      }
    : best
  return {
    x: Number((selected.x / width * 100).toFixed(2)),
    y: Number((selected.y / height * 100).toFixed(2)),
  }
}

export function locateProjectCoverImage(image: HTMLImageElement, preferredFocus?: ProjectCoverFocus): ProjectCoverFocus | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const frame = context.getImageData(0, 0, canvas.width, canvas.height)
    return locateProjectCoverContent(frame.data, frame.width, frame.height, preferredFocus)
  } catch {
    return null
  }
}
