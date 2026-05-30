import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the duplicated chunk
target = """            sourceUrl={item.sourceUrl}
            volume={item.volume}
            volumeKeyframes={item.volumeKeyframes}
            audioPeaks={item.audioPeaks}
            audioPeaks={item.sourceUrl && waveformCache instanceof Map ? waveformCache.get(item.id)?.peaks : undefined}
            volume={item.volume}
            volumeKeyframes={item.volumeKeyframes}"""

replacement = """            sourceUrl={item.sourceUrl}
            audioPeaks={item.audioPeaks}
            volume={item.volume}
            volumeKeyframes={item.volumeKeyframes}"""

content = content.replace(target, replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed duplicate JSX attributes!")
