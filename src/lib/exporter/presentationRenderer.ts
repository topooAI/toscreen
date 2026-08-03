import type { PresentationEffectRegion } from '@/components/video-editor/presentation/types';
import { isRegionActive, sampleEffectBounds } from '@/components/video-editor/presentation/presentationEffects';

const scratchByCanvas = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function scratchCanvas(source: HTMLCanvasElement) {
  let scratch = scratchByCanvas.get(source);
  if (!scratch) { scratch = document.createElement('canvas'); scratchByCanvas.set(source, scratch); }
  if (scratch.width !== source.width) scratch.width = source.width;
  if (scratch.height !== source.height) scratch.height = source.height;
  return scratch;
}

export type PresentationMediaMap = Map<string, CanvasImageSource>;
export function renderPresentationEffects(ctx: CanvasRenderingContext2D, effects: PresentationEffectRegion[], width: number, height: number, timeMs: number, media: PresentationMediaMap = new Map()) {
  for (const effect of effects.filter(item => isRegionActive(item, timeMs))) {
    if (effect.kind === 'cursor-visibility' || effect.kind === 'click-effect') continue;
    if (effect.kind === 'keystroke') {
      ctx.save(); ctx.font = `600 ${Math.max(18, width / 70)}px Inter, sans-serif`;
      const gap = width / 240; const pad = width / 100;
      const sizes = effect.keys.map(key => ctx.measureText(key).width + pad * 2);
      const totalWidth = sizes.reduce((a, b) => a + b, 0) + gap * (sizes.length - 1);
      let x = effect.placement === 'top-left' ? width * .05 : effect.placement === 'top-right' ? width * .95 - totalWidth : (width - totalWidth) / 2;
      const y = effect.placement === 'center' ? height * .47 : effect.placement.startsWith('top') ? height * .07 : height * .86; const keyHeight = height / 16;
      effect.keys.forEach((key, index) => { ctx.fillStyle = effect.style === 'light' ? 'rgba(255,255,255,.92)' : effect.style === 'accent' ? 'rgba(13,153,255,.92)' : 'rgba(10,10,12,.9)'; ctx.beginPath(); ctx.roundRect(x, y, sizes[index], keyHeight, 9); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.stroke(); ctx.fillStyle = effect.style === 'light' ? '#111' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(key, x + sizes[index] / 2, y + keyHeight / 2); x += sizes[index] + gap; });
      ctx.restore(); continue;
    }
    if (effect.kind === 'presenter') {
      if (!effect.visible) continue;
      const image = media.get(effect.id); if (!image) continue;
      const x = effect.bounds.x / 100 * width, y = effect.bounds.y / 100 * height, w = effect.bounds.width / 100 * width, h = effect.bounds.height / 100 * height; ctx.save(); ctx.beginPath(); if (effect.shape === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.roundRect(x, y, w, h, 12); ctx.clip(); ctx.drawImage(image, x, y, w, h); ctx.restore();
      continue;
    }
    const sampledBounds = effect.kind === 'mask' ? sampleEffectBounds(effect, timeMs) : effect.bounds;
    const x = sampledBounds.x / 100 * width; const y = sampledBounds.y / 100 * height;
    const w = sampledBounds.width / 100 * width; const h = sampledBounds.height / 100 * height;
    if (effect.kind === 'mask') {
      ctx.save(); ctx.globalAlpha = effect.opacity; ctx.beginPath(); ctx.roundRect(x, y, w, h, effect.radius); ctx.clip();
      if (effect.mode === 'cover') { ctx.fillStyle = effect.color; ctx.fillRect(x, y, w, h); }
      else {
        const scratch = scratchCanvas(ctx.canvas); const scratchCtx = scratch.getContext('2d');
        if (scratchCtx) { scratchCtx.clearRect(0, 0, scratch.width, scratch.height); scratchCtx.drawImage(ctx.canvas, 0, 0); ctx.filter = `blur(${effect.blurPx}px)`; ctx.drawImage(scratch, x, y, w, h, x, y, w, h); }
      }
      ctx.restore(); continue;
    }
    ctx.save(); ctx.globalAlpha = effect.opacity; ctx.fillStyle = `rgba(0,0,0,${effect.dimOpacity})`; ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.roundRect(x, y, w, h, effect.radius); ctx.fill('evenodd'); ctx.strokeStyle = effect.color; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); ctx.restore();
  }
}
