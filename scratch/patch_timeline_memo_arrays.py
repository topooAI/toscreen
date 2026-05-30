import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Memoize videos
content = content.replace(
    "  const videos: TimelineRenderItem[] = [{",
    "  const videos = useMemo<TimelineRenderItem[]>(() => ([{"
)
content = content.replace(
    "    label: 'Main Track'\n  }];",
    "    label: 'Main Track'\n  }]), [videoDurationMs, mapTime]);"
)

# Memoize zooms
content = content.replace(
    "  const zooms: TimelineRenderItem[] = (zoomRegions || []).map((region) => ({",
    "  const zooms = useMemo<TimelineRenderItem[]>(() => (zoomRegions || []).map((region) => ({"
)
content = content.replace(
    "    label: `Zoom ${(region.scale || 1.25)}x`,\n  }));",
    "    label: `Zoom ${(region.scale || 1.25)}x`,\n  })), [zoomRegions, mapTime]);"
)

# Memoize trims
content = content.replace(
    "  const trims: TimelineRenderItem[] = (trimRegions || []).map((region) => ({",
    "  const trims = useMemo<TimelineRenderItem[]>(() => (trimRegions || []).map((region) => ({"
)
content = content.replace(
    "    label: 'Trim',\n  }));",
    "    label: 'Trim',\n  })), [trimRegions, mapTime]);"
)

# Memoize annotations
content = content.replace(
    "  const annotations: TimelineRenderItem[] = (annotationRegions || []).map((region) => ({",
    "  const annotations = useMemo<TimelineRenderItem[]>(() => (annotationRegions || []).map((region) => ({"
)
content = content.replace(
    "    label: 'Annotation',\n  }));",
    "    label: 'Annotation',\n  })), [annotationRegions, mapTime]);"
)

# Memoize audios
content = content.replace(
    "  const audios: TimelineRenderItem[] = (audioRegions || []).map((region) => ({",
    "  const audios = useMemo<TimelineRenderItem[]>(() => (audioRegions || []).map((region) => ({"
)
content = content.replace(
    "    volumeKeyframes: region.volumeKeyframes,\n  }));",
    "    volumeKeyframes: region.volumeKeyframes,\n  })), [audioRegions, mapTime]);"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Timeline arrays memoized!")
