import re

file_path = 'src/components/video-editor/timeline/TimelineEditor.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Instead of re-rendering all rows 60fps, we memoize the track rendering inside Timeline
replacement = """
  const trackRenderer = useMemo(() => (
    <>
      {/* Base Video Track */}
      <Row id={VIDEO_ROW_ID}>
        {items.filter(item => item.rowId === VIDEO_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={false}
            variant="video"
          >
            {item.label}
          </Item>
        ))}
      </Row>
      
      <Row id={ZOOM_ROW_ID} onAddClick={onAddZoom}>
        {items.filter(item => item.rowId === ZOOM_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedZoomId}
            onSelect={() => onSelectZoom?.(item.id)}
            variant="zoom"
          >
            {item.label}
          </Item>
        ))}
      </Row>

      <Row id={TRIM_ROW_ID} onAddClick={onAddTrim}>
        {items.filter(item => item.rowId === TRIM_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedTrimId}
            onSelect={() => onSelectTrim?.(item.id)}
            variant="trim"
          >
            {item.label}
          </Item>
        ))}
      </Row>

      <Row id={ANNOTATION_ROW_ID} onAddClick={onAddAnnotation}>
        {items.filter(item => item.rowId === ANNOTATION_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedAnnotationId}
            onSelect={() => onSelectAnnotation?.(item.id)}
            variant="annotation"
          >
            {item.label}
          </Item>
        ))}
      </Row>
      
      <Row id={AUDIO_ROW_ID} onAddClick={() => toast.info('请将音频文件直接拖拽到画面中添加')}>
        {items.filter(item => item.rowId === AUDIO_ROW_ID).map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedAudioId}
            onSelect={() => onSelectAudio?.(item.id)}
            variant="audio"
            sourceStartMs={item.sourceStartMs}
            sourceEndMs={item.sourceEndMs}
            totalDurationMs={item.totalDurationMs}
            audioPeaks={item.sourceUrl ? waveformCache?.[item.id]?.peaks : undefined}
            volume={item.volume}
            volumeKeyframes={item.volumeKeyframes}
            onVolumeKeyframesChange={(keyframes) => onAudioVolumeKeyframesChange?.(item.id, keyframes)}
          >
            {item.label}
          </Item>
        ))}
      </Row>
    </>
  ), [items, selectedZoomId, selectedTrimId, selectedAnnotationId, selectedAudioId, waveformCache]);

"""

# Extract the block to replace
start_idx = content.find("{/* Base Video Track */}")
end_idx = content.find("</div>", start_idx)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + "{trackRenderer}\n    " + content[end_idx:]
    
    # insert useMemo at the beginning of Timeline function
    memo_start = content.find("const { setTimelineRef")
    content = content[:memo_start] + replacement + content[memo_start:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Timeline tracks memoized!")
else:
    print("Could not find blocks")
