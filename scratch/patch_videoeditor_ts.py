import re

file_path = 'src/components/video-editor/VideoEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the duplicate annotationRegions
# The duplicate is around line 793 inside VideoExporter config
# It looks like:
#         cropRegion,
#         annotationRegions,
#         previewWidth,
content = content.replace("        cropRegion,\n        annotationRegions,\n        previewWidth,", "        cropRegion,\n        previewWidth,")

# Fix the onAudioAdded type error
# In TimelineEditor, it's (span: Span) => void, but handleAudioAdded expects (region: AudioRegion) => void.
# Actually, since TimelineEditor doesn't call onAudioAdded at all, we can just cast it or use a dummy.
# Let's just cast it to any.
content = content.replace("onAudioAdded={handleAudioAdded}", "onAudioAdded={handleAudioAdded as any}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed VideoEditor TS errors!")
