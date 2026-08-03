export interface MediaDrawRect { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }

export const presenterObjectFit = (fit: 'cover' | 'contain') => fit;

export function calculateMediaDrawRect(sourceWidth: number, sourceHeight: number, x: number, y: number, width: number, height: number, fit: 'cover' | 'contain'): MediaDrawRect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return { sx: 0, sy: 0, sw: Math.max(0, sourceWidth), sh: Math.max(0, sourceHeight), dx: x, dy: y, dw: width, dh: height };
  const sourceRatio = sourceWidth / sourceHeight; const targetRatio = width / height;
  if (fit === 'cover') {
    if (sourceRatio > targetRatio) { const sw = sourceHeight * targetRatio; return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight, dx: x, dy: y, dw: width, dh: height }; }
    const sh = sourceWidth / targetRatio; return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh, dx: x, dy: y, dw: width, dh: height };
  }
  if (sourceRatio > targetRatio) { const dh = width / sourceRatio; return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: x, dy: y + (height - dh) / 2, dw: width, dh }; }
  const dw = height * sourceRatio; return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: x + (width - dw) / 2, dy: y, dw, dh: height };
}
