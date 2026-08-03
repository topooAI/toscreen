import { useEffect, useRef } from 'react';
import type { CursorDataPoint } from '../types';
import type { PresentationEffectRegion } from './types';
import { activeClickEffect } from './presentationEffects';

export function useClickSound(points: CursorDataPoint[], effects: PresentationEffectRegion[], timeMs: number, playing: boolean) {
  const lastPlayedRef = useRef(-1);
  useEffect(() => {
    if (!playing) return;
    const config = activeClickEffect(effects, timeMs);
    if (!config?.soundEnabled) return;
    let event: CursorDataPoint | undefined;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      const timestamp = point.timestamp ?? (point as CursorDataPoint & { timestampMs?: number }).timestampMs ?? -1;
      if ((point.isClick || point.type === 'click' || point.type === 'mousedown') && timestamp <= timeMs && timeMs - timestamp < 90) { event = point; break; }
    }
    if (!event) return;
    const timestamp = event.timestamp ?? (event as CursorDataPoint & { timestampMs?: number }).timestampMs ?? -1;
    if (timestamp === lastPlayedRef.current) return;
    lastPlayedRef.current = timestamp;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(1150, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + .045);
    gain.gain.setValueAtTime(.12 * config.soundVolume, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .055);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .06); oscillator.onended = () => void context.close();
  }, [effects, playing, points, timeMs]);
}
