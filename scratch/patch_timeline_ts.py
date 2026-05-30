import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("id: VIDEO_TRACK_ID,", "id: 'video-track',")
content = content.replace("span: { start: 0, end: mapTime(videoDurationMs) },", "span: { start: 0, end: mapTime(totalMs) },")
content = content.replace("label: 'Main Track'\n    }];", "label: 'Main Track',\n      variant: 'video'\n    }];")
content = content.replace("isTrimTrackVisible, mapSourceToEffective, videoDurationMs, zoomRegions,", "isTrimTrackVisible, mapSourceToEffective, totalMs, zoomRegions,")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("TypeScript errors fixed!")
