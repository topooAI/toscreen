import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const mapTime = (time: number) => isTrimTrackVisible ? time : mapSourceToEffective(time);

    const videos: TimelineRenderItem[] = [{
      id: VIDEO_TRACK_ID,
      rowId: VIDEO_ROW_ID,
      span: { start: 0, end: mapTime(videoDurationMs) },
      label: 'Main Track'
    }];
    
    const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
      id: region.id,
      rowId: ZOOM_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: `Zoom ${index + 1}`,
      zoomDepth: region.depth,
      variant: 'zoom',
    }));

    const trims: TimelineRenderItem[] = isTrimTrackVisible ? trimRegions.map((region, index) => ({
      id: region.id,
      rowId: TRIM_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: `Trim ${index + 1}`,
      variant: 'trim',
    })) : [];

    const annotations: TimelineRenderItem[] = (annotationRegions || []).map((region) => {
      let label: string;
      
      if (region.type === 'text') {
        const preview = region.content.trim() || 'Empty text';
        label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
      } else if (region.type === 'image') {
        label = 'Image';
      } else {
        label = 'Annotation';
      }
      
      return {
        id: region.id,
        rowId: ANNOTATION_ROW_ID,
        span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
        label,
        variant: 'annotation',
      };
    });

    const audios: TimelineRenderItem[] = (audioRegions || []).map((region) => ({
      id: region.id,
      rowId: AUDIO_ROW_ID,
      span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },
      label: 'Audio Track',
      variant: 'audio',
      sourceUrl: region.sourceUrl,
      sourceStartMs: region.sourceStartMs,
      sourceEndMs: region.sourceEndMs,
      totalDurationMs: region.totalDurationMs,
      startMs: region.startMs,
      volume: region.volume,
      volumeKeyframes: region.volumeKeyframes,
    }));

    const mainClips: TimelineRenderItem[] = [];
    if (!isTrimTrackVisible) {
      const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
      let currentSourceStart = 0;
      sortedTrims.forEach((trim, index) => {
        if (currentSourceStart < trim.startMs) {
           mainClips.push({
             id: `main-clip-${index}`,
             rowId: VIDEO_ROW_ID,
             span: { start: mapTime(currentSourceStart), end: mapTime(trim.startMs) },
             label: 'Main Clip',
             variant: 'zoom'
           });
        }
        currentSourceStart = trim.endMs;
      });
      if (currentSourceStart < totalMs) {
         mainClips.push({
             id: `main-clip-final`,
             rowId: VIDEO_ROW_ID,
             span: { start: mapTime(currentSourceStart), end: mapTime(totalMs) },
             label: 'Main Clip',
             variant: 'zoom'
         });
      }
    }

    const videoItems = isTrimTrackVisible ? videos : mainClips;
    return [...videoItems, ...zooms, ...trims, ...annotations, ...audios];
  }, [
    isTrimTrackVisible, mapSourceToEffective, videoDurationMs, zoomRegions, 
    trimRegions, annotationRegions, audioRegions, totalMs
  ]);
"""

# Use string finding to locate the start and end of the block
start_index = content.find("const timelineItems = useMemo<TimelineRenderItem[]>(() => {")
end_index = content.find("  }, [videos, zooms, trims, annotations, audios]);", start_index)
if end_index != -1:
    end_index += len("  }, [videos, zooms, trims, annotations, audios]);")
    content = content[:start_index] + replacement.strip() + content[end_index:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed timelineItems useMemo AGAIN!")
else:
    print("Could not find end index!")
    # Let's search for the actual ending if it's different.
    import re
    match = re.search(r"const timelineItems = useMemo<TimelineRenderItem\[\]>\(\(\) => \{.*?\n  \}, \[.*?\]\);", content, re.DOTALL)
    if match:
        content = content[:match.start()] + replacement.strip() + content[match.end():]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed via regex fallback!")
    else:
        print("Regex fallback failed too!")

