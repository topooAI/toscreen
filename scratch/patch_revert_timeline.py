import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write a python script to completely replace the timelineItems block with correct dependencies.
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

# I need to find where timelineItems starts and where it ends
start_marker = "const timelineItems = useMemo<TimelineRenderItem[]>(() => {"
end_marker = "    return [...videoItems, ...zooms, ...trims, ...annotations, ...audios];\n  }, [videos, zooms, trims, annotations, audios]);"
# The exact end_marker might not match because I don't know what it is. Let's just use regex.

content = re.sub(
    r"const timelineItems = useMemo<TimelineRenderItem\[\]>\(\(\) => \{.*?return \[\.\.\.videoItems, \.\.\.zooms, \.\.\.trims, \.\.\.annotations, \.\.\.audios\];\n  \}, \[.*?\]\);",
    replacement.strip(),
    content,
    flags=re.DOTALL
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed timelineItems useMemo!")
