import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add audioPeaks to TimelineRenderItem
content = content.replace("volumeKeyframes?: any[];", "volumeKeyframes?: any[];\n  audioPeaks?: number[];")

# Map waveformCache into audios
content = content.replace(
    "variant: 'audio',",
    "variant: 'audio',\n      audioPeaks: region.sourceUrl ? waveformCache.get(region.sourceUrl)?.peaks : undefined,"
)

# And make sure waveformCache is in the dependency array of timelineItems
content = content.replace(
    "trimRegions, annotationRegions, audioRegions, totalMs",
    "trimRegions, annotationRegions, audioRegions, totalMs, waveformCache"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated TimelineEditor props to pass audioPeaks!")
