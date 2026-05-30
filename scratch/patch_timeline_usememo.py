import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const trackRenderer = (",
    "const trackRenderer = useMemo(() => ("
)

content = content.replace(
    "      </Row>\n    </>\n  );",
    "      </Row>\n    </>\n  ), [items, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedAudioId, waveformCache]);"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("trackRenderer useMemo added!")
