import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Map access syntax
content = content.replace(
    "audioPeaks={item.sourceUrl ? waveformCache?.[item.id]?.peaks : undefined}",
    "audioPeaks={item.sourceUrl && waveformCache instanceof Map ? waveformCache.get(item.id)?.peaks : undefined}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Map access syntax patched!")
