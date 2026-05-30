import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import useWaveformCache
if 'useWaveformCache' not in content:
    content = content.replace(
        "import { useTimelineContext, Row as BaseRow } from 'dnd-timeline';",
        "import { useTimelineContext, Row as BaseRow } from 'dnd-timeline';\nimport { useWaveformCache } from '../hooks/useWaveformCache';"
    )

# 2. Add audio fields to TimelineRenderItem
content = re.sub(
    r'interface TimelineRenderItem \{[\s\S]*?\}',
    """interface TimelineRenderItem {
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
}""",
    content
)

# 3. Update audios mapping
content = re.sub(
    r'const audios: TimelineRenderItem\[\] = \(audioRegions \|\| \[\]\)\.map\(\(region\) => \(\{[\s\S]*?\}\)\);',
    """const audios: TimelineRenderItem[] = (audioRegions || []).map((region) => ({
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
    }));""",
    content
)

# 4. Pass waveformCache to Timeline props
if 'waveformCache?: any;' not in content:
    content = content.replace(
        "onSelectAudio?: (id: string | null) => void;",
        "onSelectAudio?: (id: string | null) => void;\n  waveformCache?: any;\n  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;"
    )

# 5. Update Timeline function signature
if 'waveformCache,' not in content:
    content = content.replace(
        "onSelectAudio,\n}:",
        "onSelectAudio,\n  waveformCache,\n  onAudioVolumeKeyframesChange,\n}:"
    )

# 6. Update Audio Item render in Timeline
content = re.sub(
    r'<Item\s+id=\{item\.id\}\s+key=\{item\.id\}\s+rowId=\{item\.rowId\}\s+span=\{item\.span\}\s+isSelected=\{item\.id === selectedAudioId\}\s+onSelect=\{\(\) => onSelectAudio\?\.\(item\.id\)\}\s+variant="audio"\s*>\s*\{item\.label\}\s*</Item>',
    """<Item
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
          </Item>""",
    content
)

# 7. Pass waveformCache and onAudioVolumeKeyframesChange from TimelineEditor to Timeline
if 'const audioItemsToCache' not in content:
    content = content.replace(
        "const timelineItems = useMemo<TimelineRenderItem[]>(() => {",
        "const audioItemsToCache = useMemo(() => audioRegions || [], [audioRegions]);\n  const waveformCache = useWaveformCache(audioItemsToCache);\n\n  const timelineItems = useMemo<TimelineRenderItem[]>(() => {"
    )

if 'waveformCache={waveformCache}' not in content:
    content = re.sub(
        r'onSelectAudio=\{onSelectAudio\}\s*/>',
        "onSelectAudio={onSelectAudio}\n            waveformCache={waveformCache}\n            onAudioVolumeKeyframesChange={onAudioVolumeKeyframesChange}\n          />",
        content
    )

# 8. Add onAudioVolumeKeyframesChange to TimelineEditor props
if 'onAudioVolumeKeyframesChange,' not in content:
    content = content.replace(
        "onSelectAudio,",
        "onSelectAudio,\n  onAudioVolumeKeyframesChange,"
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("TimelineEditor patched successfully!")
