import { useEffect, useRef } from 'react';
import type { PresentationEffectRegion } from './types';
import { presenterObjectFit } from './presentationGeometry';

export function PresenterPreview({ effect, timeMs, playing }: { effect: Extract<PresentationEffectRegion, { kind: 'presenter' }>; timeMs: number; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current; if (!video || !effect.sourceUrl) return;
    const target = Math.max(0, ((effect.sourceStartMs ?? 0) + timeMs - effect.startMs) / 1000);
    if (Math.abs(video.currentTime - target) > .08) video.currentTime = Math.min(target, Number.isFinite(video.duration) ? video.duration : target);
    if (playing) void video.play().catch(() => {}); else video.pause();
  }, [effect.sourceUrl, effect.sourceStartMs, effect.startMs, playing, timeMs]);
  const style = { left: `${effect.bounds.x}%`, top: `${effect.bounds.y}%`, width: `${effect.bounds.width}%`, height: `${effect.bounds.height}%`, borderRadius: effect.shape === 'circle' ? '50%' : 12, objectFit: presenterObjectFit(effect.fit), opacity: effect.opacity ?? 1 } as const;
  if (effect.sourceUrl) return <video ref={ref} src={effect.sourceUrl} muted playsInline preload="auto" className="absolute" style={style} />;
  if (effect.posterDataUrl) return <img src={effect.posterDataUrl} className="absolute" style={style} />;
  return <div className="absolute grid place-items-center bg-neutral-900 text-xs text-white/60" style={style}>Camera asset missing</div>;
}
