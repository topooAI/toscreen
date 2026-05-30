import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "            totalDurationMs={item.totalDurationMs}",
    "            totalDurationMs={item.totalDurationMs}\n            sourceUrl={item.sourceUrl}\n            volume={item.volume}\n            volumeKeyframes={item.volumeKeyframes}\n            audioPeaks={item.audioPeaks}"
)

# And delete keyboard Backspace and Delete keys
content = content.replace(
    "if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {",
    "if (((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace' || e.key === 'Delete') {"
)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated TimelineEditor passing audioPeaks and added Backspace support!")
