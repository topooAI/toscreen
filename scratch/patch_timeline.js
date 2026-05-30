const fs = require('fs');

const file = 'src/components/video-editor/timeline/TimelineEditor.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Import useWaveformCache
if (!content.includes('useWaveformCache')) {
    content = content.replace(
        "import { useTimelineContext, Row as BaseRow } from 'dnd-timeline';",
        "import { useTimelineContext, Row as BaseRow } from 'dnd-timeline';\nimport { useWaveformCache } from '../hooks/useWaveformCache';"
    );
}

// 2. Add audio fields to TimelineRenderItem
content = content.replace(
    /interface TimelineRenderItem \{[\s\S]*?\}/,
    `interface TimelineRenderItem {
  id: string;
  rowId: string;
  span: Span;
  label: string;
  zoomDepth?: number;
  variant: 'zoom' | 'trim' | 'annotation' | 'audio';
  sourceUrl?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  totalDurationMs?: number;
  startMs?: number;
  volume?: number;
  volumeKeyframes?: any[];
}`
);

// 3. Update audios mapping
content = content.replace(
    /const audios: TimelineRenderItem\[\] = \(audioRegions \|\| \[\]\).map\(\(region\) => \(\{[\s\S]*?\}\)\);/,
    `const audios: TimelineRenderItem[] = (audioRegions || []).map((region) => ({
      id: region.id,
      rowId: AUDIO_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: 'Audio Track',
      variant: 'audio',
      sourceUrl: region.sourceUrl,
      sourceStartMs: region.sourceStartMs,
      sourceEndMs: region.sourceEndMs,
      totalDurationMs: region.totalDurationMs,
      startMs: region.startMs,
      volume: region.volume,
      volumeKeyframes: region.volumeKeyframes,
    }));`
);

// 4. Pass waveformCache to Timeline props
content = content.replace(
    "onSelectAudio?: (id: string | null) => void;",
    "onSelectAudio?: (id: string | null) => void;\n  waveformCache?: any;\n  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;"
);

// 5. Update Timeline function signature
content = content.replace(
    "onSelectAudio,",
    "onSelectAudio,\n  waveformCache,\n  onAudioVolumeKeyframesChange,"
);

// 6. Update Audio Item render in Timeline
content = content.replace(
    /<Item\s+id=\{item\.id\}\s+key=\{item\.id\}\s+rowId=\{item\.rowId\}\s+span=\{item\.span\}\s+isSelected=\{item\.id === selectedAudioId\}\s+onSelect=\{\(\) => onSelectAudio\?\.([^\}]+)\}\s+variant="audio"\s*>\s*\{item\.label\}\s*<\/Item>/g,
    `<Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedAudioId}
            onSelect={() => onSelectAudio?.(item.id)}
            variant="audio"
            sourceStartMs={item.sourceStartMs}
            sourceEndMs={item.sourceEndMs}
            totalDurationMs={item.totalDurationMs}
            audioPeaks={item.sourceUrl ? waveformCache?.[item.sourceUrl] : undefined}
            volume={item.volume}
            volumeKeyframes={item.volumeKeyframes}
            onVolumeKeyframesChange={(keyframes) => onAudioVolumeKeyframesChange?.(item.id, keyframes)}
          >
            {item.label}
          </Item>`
);

// 7. Pass waveformCache and onAudioVolumeKeyframesChange from TimelineEditor to Timeline
content = content.replace(
    "const timelineItems = useMemo<TimelineRenderItem[]>(() => {",
    "const audioItemsToCache = useMemo(() => audioRegions || [], [audioRegions]);\n  const waveformCache = useWaveformCache(audioItemsToCache);\n\n  const timelineItems = useMemo<TimelineRenderItem[]>(() => {"
);

content = content.replace(
    /onSelectAudio=\{onSelectAudio\}\s*\/>/g,
    "onSelectAudio={onSelectAudio}\n            waveformCache={waveformCache}\n            onAudioVolumeKeyframesChange={onAudioVolumeKeyframesChange}\n          />"
);

// 8. Add onAudioVolumeKeyframesChange to TimelineEditor props
content = content.replace(
    "onSelectAudio,",
    "onSelectAudio,\n  onAudioVolumeKeyframesChange,"
);

fs.writeFileSync(file, content);
console.log("TimelineEditor patched.");
