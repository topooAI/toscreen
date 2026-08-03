import type { PresentationEffectRegion } from '../presentation/types';
import type { VideoEditorProject } from './types';

type PresenterEffect = Extract<PresentationEffectRegion, { kind: 'presenter' }>;

const percent = (value: unknown, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.abs(number) <= 1 ? number * 100 : number;
};

const mediaUrl = (filePath?: string, sourceUrl?: string) => {
  if (filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return encodeURI(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`);
  }
  return sourceUrl || undefined;
};

export function restorePresenterEffectsFromProjectModel(project: VideoEditorProject): PresenterEffect[] {
  return project.clips.flatMap((clip): PresenterEffect[] => {
    if (clip.type !== 'presenter') return [];
    const asset = project.assets.find(candidate => candidate.id === clip.assetId);
    const metadata = asset?.metadata ?? {};
    const props = clip.props as typeof clip.props & { shape?: 'circle' | 'rectangle'; fit?: 'cover' | 'contain'; fitMode?: 'cover' | 'contain'; visible?: boolean };
    const transform = props.transform;
    const track = project.tracks.find(candidate => candidate.id === clip.trackId);
    return [{
      id: clip.legacy?.regionId || clip.id,
      kind: 'presenter',
      startMs: clip.startMs,
      endMs: clip.endMs,
      sourceStartMs: clip.sourceStartMs ?? Number(metadata.sourceStartMs ?? 0),
      sourceUrl: mediaUrl(asset?.filePath, asset?.sourceUrl),
      posterDataUrl: typeof metadata.posterDataUrl === 'string' ? metadata.posterDataUrl : undefined,
      bounds: {
        x: percent(transform?.x, 76),
        y: percent(transform?.y, 68),
        width: percent(transform?.width, 18),
        height: percent(transform?.height, 24),
      },
      shape: props.shape ?? (Number(transform?.borderRadius ?? 0) >= 999 ? 'circle' : 'rectangle'),
      fit: props.fit ?? props.fitMode ?? (metadata.fit === 'contain' ? 'contain' : 'cover'),
      opacity: Number.isFinite(Number(transform?.opacity)) ? Number(transform.opacity) : 1,
      visible: props.visible ?? (track?.hidden !== true && transform?.opacity !== 0),
    }];
  });
}

export function presenterEffectFromCameraPath(cameraPath: string | undefined, durationMs: number, existing: PresentationEffectRegion[]): PresenterEffect | null {
  if (!cameraPath) return null;
  const sourceUrl = mediaUrl(cameraPath);
  if (existing.some(effect => effect.kind === 'presenter' && effect.sourceUrl === sourceUrl)) return null;
  return {
    id: 'presenter-recording-live', kind: 'presenter', startMs: 0, endMs: Math.max(1, durationMs),
    sourceStartMs: 0, sourceUrl, shape: 'circle', bounds: { x: 76, y: 68, width: 18, height: 24 }, visible: true, opacity: 1, fit: 'cover',
  };
}

export function expandPendingPresenterDuration(effects: PresentationEffectRegion[], durationMs: number): PresentationEffectRegion[] {
  const fullDurationMs = Math.max(1, Math.round(durationMs));
  if (fullDurationMs <= 1) return effects;
  let changed = false;
  const next = effects.map(effect => {
    if (effect.kind !== 'presenter' || effect.id !== 'presenter-recording-live' || effect.startMs !== 0 || effect.endMs !== 1) return effect;
    changed = true;
    return { ...effect, endMs: fullDurationMs };
  });
  return changed ? next : effects;
}

export function mergePresentationEffects(legacy: PresentationEffectRegion[], presenters: PresenterEffect[]): PresentationEffectRegion[] {
  const presenterClipIds = new Set(presenters.map(effect => effect.id));
  const presenterSources = new Set(presenters.map(effect => effect.sourceUrl).filter(Boolean));
  return [...legacy.filter(effect => effect.kind !== 'presenter' || (!presenterClipIds.has(effect.id) && !presenterSources.has(effect.sourceUrl))), ...presenters];
}
