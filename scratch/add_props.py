import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add onAudioVolumeChange
pattern = r'(onAudioVolumeKeyframesChange\?: \(id: string, keyframes: any\[\]\) => void;)'
match = re.search(pattern, content)
if match:
    insertion = "\n  onAudioVolumeChange?: (id: string, volume: number) => void;"
    content = content[:match.end()] + insertion + content[match.end():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added onAudioVolumeChange to TimelineEditorProps!")
