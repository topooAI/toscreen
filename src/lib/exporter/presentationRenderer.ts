import type { PresentationEffectRegion } from '@/components/video-editor/presentation/types';
import { isRegionActive } from '@/components/video-editor/presentation/presentationEffects';

const scratchByCanvas = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function scratchCanvas(source: HTMLCanvasElement) {
  let scratch = scratchByCanvas.get(source);
  if (!scratch) { scratch = document.createElement('canvas'); scratchByCanvas.set(source, scratch); }
  if (scratch.width !== source.width) scratch.width = source.width;
  if (scratch.height !== source.height) scratch.height = source.height;
  return scratch;
}

export function renderPresentationEffects(ctx: CanvasRenderingContext2D, effects: PresentationEffectRegion[], width: number, height: number, timeMs: number) {
  for (const effect of effects.filter(item => isRegionActive(item, timeMs))) {
    if (effect.kind === 'cursor-hide') continue;
    if (effect.kind === 'keystroke') {
      ctx.save(); ctx.font = `600 ${Math.max(18, width / 70)}px Inter, sans-serif`;
      const gap = width / 240; const pad = width / 100;
      const sizes = effect.keys.map(key => ctx.measureText(key).width + pad * 2);
      let x = (width - sizes.reduce((a, b) => a + b, 0) - gap * (sizes.length - 1)) / 2;
      const y = effect.placement === 'center' ? height * .47 : height * .86; const keyHeight = height / 16;
      effect.keys.forEach((key, index) => { ctx.fillStyle = 'rgba(10,10,12,.9)'; ctx.beginPath(); ctx.roundRect(x, y, sizes[index], keyHeight, 9); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(key, x + sizes[index] / 2, y + keyHeight / 2); x += sizes[index] + gap; });
      ctx.restore(); continue;
    }
    const x = effect.bounds.x / 100 * width; const y = effect.bounds.y / 100 * height;
    const w = effect.bounds.width / 100 * width; const h = effect.bounds.height / 100 * height;
    if (effect.kind === 'mask') {
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, effect.radius); ctx.clip();
      if (effect.mode === 'cover') { ctx.fillStyle = effect.color; ctx.fillRect(x, y, w, h); }
      else {
        const scratch = scratchCanvas(ctx.canvas); const scratchCtx = scratch.getContext('2d');
        if (scratchCtx) { scratchCtx.clearRect(0, 0, scratch.width, scratch.height); scratchCtx.drawImage(ctx.canvas, 0, 0); ctx.filter = `blur(${effect.blurPx}px)`; ctx.drawImage(scratch, x, y, w, h, x, y, w, h); }
      }
      ctx.restore(); continue;
    }
    ctx.save(); ctx.fillStyle = `rgba(0,0,0,${effect.dimOpacity})`; ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.roundRect(x, y, w, h, effect.radius); ctx.fill('evenodd'); ctx.strokeStyle = effect.color; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); ctx.restore();
  }
}
