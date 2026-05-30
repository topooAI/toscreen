import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix TimelineEditor props destructuring
if 'onAudioVolumeKeyframesChange,' not in content.split('}: TimelineEditorProps) {')[0]:
    content = content.replace(
        "  onSelectAudio,\n  aspectRatio,",
        "  onSelectAudio,\n  onAudioAdded,\n  onAudioVolumeChange,\n  onAudioVolumeKeyframesChange,\n  aspectRatio,"
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Timeline props patched successfully again!")
