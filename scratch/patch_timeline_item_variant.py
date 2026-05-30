import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "variant: 'zoom' | 'trim' | 'annotation' | 'audio';",
    "variant: 'zoom' | 'trim' | 'annotation' | 'audio' | 'video';"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added video variant!")
