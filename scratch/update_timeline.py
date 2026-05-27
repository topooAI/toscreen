import sys

def modify_timeline_editor(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. 替换 totalMs 和 videoDurationMs 等级的基础使用
    content = content.replace("totalMs === 0", "activeDurationMs === 0")
    content = content.replace("totalMs > 0", "activeDurationMs > 0")
    
    # 2. 替换 TimelineWrapper 中的参数
    wrapper_old = """        <TimelineWrapper
          range={clampedRange}
          videoDuration={videoDuration}"""
    wrapper_new = """        <TimelineWrapper
          range={clampedRange}
          videoDuration={activeDurationMs / 1000}"""
    content = content.replace(wrapper_old, wrapper_new)

    # 3. 替换 Timeline 的参数
    timeline_old = """          <Timeline
            items={timelineItems}
            videoDurationMs={totalMs}
            intervalMs={timelineScale.intervalMs}
            currentTimeMs={currentTimeMs}"""
    timeline_new = """          <Timeline
            items={timelineItems}
            videoDurationMs={activeDurationMs}
            intervalMs={timelineScale.intervalMs}
            currentTimeMs={activeCurrentTimeMs}"""
    content = content.replace(timeline_old, timeline_new)

    # 4. 替换 useEffect 中 setRange(createInitialRange(totalMs))
    content = content.replace("setRange(createInitialRange(totalMs));", "setRange(createInitialRange(activeDurationMs));")

    # 5. 修改 timelineItems 生成逻辑
    items_old = """  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
      id: region.id,
      rowId: ZOOM_ROW_ID,
      span: { start: region.startMs, end: region.endMs },
      label: `Zoom ${index + 1}`,
      zoomDepth: region.depth,
      variant: 'zoom',
    }));

    const trims: TimelineRenderItem[] = trimRegions.map((region, index) => ({
      id: region.id,
      rowId: TRIM_ROW_ID,
      span: { start: region.startMs, end: region.endMs },
      label: `Trim ${index + 1}`,
      variant: 'trim',
    }));

    const annotations: TimelineRenderItem[] = annotationRegions.map((region) => {"""
    
    items_new = """  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    const mapTime = (time: number) => isTrimTrackVisible ? time : mapSourceToEffective(time);
    
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
      span: { start: region.startMs, end: region.endMs },
      label: `Trim ${index + 1}`,
      variant: 'trim',
    })) : [];

    const annotations: TimelineRenderItem[] = annotationRegions.map((region) => {"""
    content = content.replace(items_old, items_new)
    
    # 6. 继续替换 annotations 里的 span
    ann_span_old = "span: { start: region.startMs, end: region.endMs },"
    ann_span_new = "span: { start: mapTime(region.startMs), end: mapTime(region.endMs) },"
    content = content.replace(ann_span_old, ann_span_new, 1)

    # 7. 添加双模 UI 按钮在 Toolbar
    toolbar_btn_old = """          <Button
            onClick={handleAddAnnotation}"""
    toolbar_btn_new = """          <div className="w-px h-4 bg-white/10 mx-1" />
          <Button
            onClick={() => setIsTrimTrackVisible(!isTrimTrackVisible)}
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 transition-all",
              !isTrimTrackVisible ? "text-[#34B27B] bg-[#34B27B]/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/10"
            )}
            title={!isTrimTrackVisible ? "Magnetic Mode On (Trims folded)" : "Source Mode On (Trims visible)"}
          >
            {!isTrimTrackVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            onClick={handleAddAnnotation}"""
    content = content.replace(toolbar_btn_old, toolbar_btn_new)

    # 8. 修改 Row 显示：在非显示模式下隐藏 Trim Row
    row_trim_old = """      <Row id={TRIM_ROW_ID} onAddClick={onAddTrim}>
        {trimItems.map((item) => ("""
    row_trim_new = """      <Row id={TRIM_ROW_ID} onAddClick={onAddTrim} className={!isTrimTrackVisible ? "hidden" : ""}>
        {trimItems.map((item) => ("""
    
    # Let's fix Timeline component definition (at the top)
    # the function Timeline(...) {
    # wait, the component Timeline is defined at the top. Let's find its props.
    
    # 9. Handle handleItemSpanChange to map back
    span_change_old = """  const handleItemSpanChange = useCallback((id: string, span: Span) => {
    // Check if it's a zoom or trim item
    if (zoomRegions.some(r => r.id === id)) {
      onZoomSpanChange(id, span);
    } else if (trimRegions.some(r => r.id === id)) {
      onTrimSpanChange?.(id, span);
    } else if (annotationRegions.some(r => r.id === id)) {
      onAnnotationSpanChange?.(id, span);
    }
  }, [zoomRegions, trimRegions, annotationRegions, onZoomSpanChange, onTrimSpanChange, onAnnotationSpanChange]);"""
    
    span_change_new = """  const handleItemSpanChange = useCallback((id: string, span: Span) => {
    const targetSpan = isTrimTrackVisible 
      ? span 
      : { start: mapEffectiveToSource(span.start), end: mapEffectiveToSource(span.end) };
      
    // Check if it's a zoom or trim item
    if (zoomRegions.some(r => r.id === id)) {
      onZoomSpanChange(id, targetSpan);
    } else if (trimRegions.some(r => r.id === id)) {
      onTrimSpanChange?.(id, targetSpan);
    } else if (annotationRegions.some(r => r.id === id)) {
      onAnnotationSpanChange?.(id, targetSpan);
    }
  }, [zoomRegions, trimRegions, annotationRegions, onZoomSpanChange, onTrimSpanChange, onAnnotationSpanChange, isTrimTrackVisible, mapEffectiveToSource]);"""
    content = content.replace(span_change_old, span_change_new)

    # Write back
    with open(filepath, 'w') as f:
        f.write(content)
        
if __name__ == '__main__':
    modify_timeline_editor(sys.argv[1])
