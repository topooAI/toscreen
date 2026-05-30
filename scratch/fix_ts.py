import re

# 1. Fix TimelineEditor.tsx
file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

props_to_add = """
  audioRegions?: any[];
  onAudioAdded?: (region: any) => void;
  onAudioSpanChange?: (id: string, span: any) => void;
  onAudioVolumeChange?: (id: string, volume: number) => void;
  onAudioVolumeKeyframesChange?: (id: string, keyframes: any[]) => void;
  onAudioDelete?: (id: string) => void;
  selectedAudioId?: string | null;
  onSelectAudio?: (id: string | null) => void;
"""

# add to interface TimelineEditorProps if missing (we don't have interface, it's just inline type in function)
if 'onAudioDelete,' not in content:
    content = content.replace(
        "onSelectAudio,\n  onAudioVolumeKeyframesChange,",
        "onSelectAudio,\n  onAudioVolumeKeyframesChange,\n  audioRegions,\n  onAudioAdded,\n  onAudioSpanChange,\n  onAudioVolumeChange,\n  onAudioDelete,\n  selectedAudioId,"
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Fix VideoEditor.tsx
file_path2 = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

# Remove audioRegions from VideoPlayback
content2 = re.sub(r'\s*audioRegions=\{audioRegions\}', '', content2)
with open(file_path2, 'w', encoding='utf-8') as f:
    f.write(content2)

print("TS errors fixed!")
